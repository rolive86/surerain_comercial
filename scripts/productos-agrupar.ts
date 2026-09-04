/**
 * Agrupa products_tango activos en product_groups + product_variants
 * por heurística de descripción (raíz hasta antes de la primera medida/número).
 *
 * Idempotente: no pisa grupos/códigos con source='manual'.
 *
 *   npm run productos:agrupar
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { commercialSql } from "./espejo/db.js";
import { ROOT } from "../src/config.js";

/** Raíz = descripción hasta antes del primer token que empieza con dígito. */
export function productRoot(descripcion: string): string {
  const d = descripcion.trim();
  if (!d) return "";
  const cut = d.replace(/\s+[0-9].*$/, "").trim();
  return cut || d;
}

/** Todo lo que sigue a la raíz (medida/rosca/ángulo completo). */
export function variantSuffix(descripcion: string, root: string): string {
  const d = descripcion.trim();
  const r = root.trim();
  if (!r) return d;
  if (d.toLocaleLowerCase("es").startsWith(r.toLocaleLowerCase("es"))) {
    return d.slice(r.length).trim();
  }
  const m = d.match(/\s+[0-9].*$/);
  return m ? m[0].trim() : d;
}

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || "grupo";
}

function majorityFamilia(familias: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const f of familias) {
    const key = (f ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}

type PtRow = {
  cod_articulo: string;
  descripcion: string | null;
  familia: string | null;
};

type GroupRow = {
  id: string;
  slug: string | null;
  name: string;
  familia: string | null;
  needs_review: boolean;
  source: string;
};

async function main() {
  const sql = commercialSql();

  try {
    const products = (await sql`
      select cod_articulo, descripcion, familia
      from public.products_tango
      where active
    `) as PtRow[];

    const groups = (await sql`
      select id, slug, name, familia, needs_review, source
      from public.product_groups
    `) as GroupRow[];

    const variants = await sql`
      select cod_articulo, group_id, variant_label, sort_order
      from public.product_variants
    `;

    const manualGroupIds = new Set(
      groups.filter((g) => g.source === "manual").map((g) => g.id),
    );
    const lockedCodes = new Set<string>();
    for (const v of variants) {
      if (v.group_id && manualGroupIds.has(String(v.group_id))) {
        lockedCodes.add(String(v.cod_articulo));
      }
    }

    const buckets = new Map<string, PtRow[]>();
    for (const p of products) {
      if (lockedCodes.has(p.cod_articulo)) continue;
      const desc = (p.descripcion ?? "").trim();
      if (!desc) continue;
      const root = productRoot(desc);
      if (!root) continue;
      const list = buckets.get(root) ?? [];
      list.push(p);
      buckets.set(root, list);
    }

    const multiRoots = [...buckets.entries()].filter(([, rows]) => rows.length > 1);
    const activeAutoNames = new Set(multiRoots.map(([r]) => r));

    const autoGroupsByName = new Map(
      groups.filter((g) => g.source === "auto").map((g) => [g.name, g]),
    );
    const usedSlugs = new Set(
      groups.map((g) => g.slug).filter((s): s is string => Boolean(s)),
    );

    function allocSlug(name: string, prefer?: string | null): string {
      if (prefer) {
        usedSlugs.add(prefer);
        return prefer;
      }
      const base = slugify(name);
      if (!usedSlugs.has(base)) {
        usedSlugs.add(base);
        return base;
      }
      let i = 2;
      while (usedSlugs.has(`${base}-${i}`)) i += 1;
      const s = `${base}-${i}`;
      usedSlugs.add(s);
      return s;
    }

    // Quitar variantes auto no locked (rebuild); conservar manuales
    await sql.begin(async (tx) => {
      await tx`
        delete from public.product_variants pv
        using public.product_groups g
        where pv.group_id = g.id
          and g.source = 'auto'
      `;

      await tx`
        delete from public.product_groups
        where source = 'auto'
          and id not in (
            select distinct group_id from public.product_variants where group_id is not null
          )
      `;

      // Re-load auto groups that somehow still exist (shouldn't)
      const remainingAuto = (await tx`
        select id, slug, name, familia, needs_review, source
        from public.product_groups
        where source = 'auto'
      `) as GroupRow[];
      autoGroupsByName.clear();
      for (const g of remainingAuto) autoGroupsByName.set(g.name, g);

      const variantRows: Array<{
        cod_articulo: string;
        group_id: string;
        variant_label: string;
        sort_order: number;
      }> = [];

      let created = 0;
      let updated = 0;

      for (const [root, rows] of multiRoots) {
        rows.sort((a, b) => a.cod_articulo.localeCompare(b.cod_articulo));

        const descCounts = new Map<string, number>();
        for (const r of rows) {
          const d = (r.descripcion ?? "").trim();
          descCounts.set(d, (descCounts.get(d) ?? 0) + 1);
        }
        const hasDupDesc = [...descCounts.values()].some((c) => c > 1);
        const familia = majorityFamilia(rows.map((r) => r.familia));

        let group = autoGroupsByName.get(root);
        if (!group) {
          const slug = allocSlug(root);
          const inserted = (await tx`
            insert into public.product_groups (name, slug, familia, needs_review, source)
            values (${root}, ${slug}, ${familia}, ${hasDupDesc}, 'auto')
            returning id, slug, name, familia, needs_review, source
          `) as GroupRow[];
          group = inserted[0];
          autoGroupsByName.set(root, group);
          created += 1;
        } else {
          const slug = allocSlug(root, group.slug);
          const updatedRows = (await tx`
            update public.product_groups
            set familia = ${familia},
                needs_review = ${hasDupDesc},
                slug = ${slug},
                updated_at = now()
            where id = ${group.id}::uuid and source = 'auto'
            returning id, slug, name, familia, needs_review, source
          `) as GroupRow[];
          group = updatedRows[0];
          autoGroupsByName.set(root, group);
          updated += 1;
        }

        const dupCounters = new Map<string, number>();
        let sort = 0;
        for (const row of rows) {
          const desc = (row.descripcion ?? "").trim();
          let label = variantSuffix(desc, root);
          if (hasDupDesc && (descCounts.get(desc) ?? 0) > 1) {
            const n = (dupCounters.get(desc) ?? 0) + 1;
            dupCounters.set(desc, n);
            label = `Variante ${n}`;
          } else if (!label) {
            label = row.cod_articulo;
          }
          variantRows.push({
            cod_articulo: row.cod_articulo,
            group_id: group.id,
            variant_label: label,
            sort_order: sort++,
          });
        }
      }

      // Delete orphan auto groups whose name is no longer a multi-root
      await tx`
        delete from public.product_groups g
        where g.source = 'auto'
          and not (g.name = any(${[...activeAutoNames]}))
      `;

      if (variantRows.length) {
        // Batch insert in chunks
        const chunk = 500;
        for (let i = 0; i < variantRows.length; i += chunk) {
          const slice = variantRows.slice(i, i + chunk);
          await tx`
            insert into public.product_variants ${tx(
              slice,
              "cod_articulo",
              "group_id",
              "variant_label",
              "sort_order",
            )}
            on conflict (cod_articulo) do update set
              group_id = excluded.group_id,
              variant_label = excluded.variant_label,
              sort_order = excluded.sort_order
            where not exists (
              select 1 from public.product_groups mg
              where mg.id = public.product_variants.group_id
                and mg.source = 'manual'
            )
          `;
        }
      }

      console.log(`created=${created} updated=${updated} variants=${variantRows.length}`);
    });

    const fg = await sql`
      select id, name, familia, needs_review, source, slug
      from public.product_groups
      order by name
    `;
    const fv = await sql`
      select cod_articulo, group_id, variant_label, sort_order
      from public.product_variants
    `;
    const review = fg.filter((g) => g.needs_review);

    const adap = fg.find((g) => g.name === "ADAP. LAY FLAT RM");
    const adapVars = fv
      .filter((v) => String(v.group_id) === String(adap?.id))
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));

    const reportLines = [
      "# Product groups (auto)",
      "",
      `Generado: ${new Date().toISOString()}`,
      "",
      "## Resumen",
      "",
      `| Métrica | Valor |`,
      `|---|---|`,
      `| Artículos activos | ${products.length} |`,
      `| Grupos totales | ${fg.length} |`,
      `| Grupos needs_review | ${review.length} |`,
      `| Variantes colgadas | ${fv.length} |`,
      `| Singles (sin grupo) | ${products.length - fv.length} |`,
      "",
      "## Heurística",
      "",
      "- Raíz: descripción hasta antes de `\\\\s+[0-9]`",
      "- Label: sufijo tras la raíz; descripciones idénticas → `Variante N` + `needs_review`",
      "- `source=manual` no se pisa",
      "",
      "Nota: el catálogo pedible actual tiene ~1.8k artículos (no 2.9k); por eso hay menos grupos que el estimado ~992.",
      "",
      "## Spot-check: ADAP. LAY FLAT RM",
      "",
    ];

    if (adap) {
      reportLines.push(
        `- slug: \`${adap.slug}\``,
        `- familia: ${adap.familia ?? "—"}`,
        `- needs_review: ${adap.needs_review}`,
        `- variantes (${adapVars.length}):`,
        ...adapVars.map(
          (v) => `  - \`${v.cod_articulo}\` → ${v.variant_label ?? "—"}`,
        ),
        "",
      );
    } else {
      reportLines.push("- (no encontrado)", "");
    }

    reportLines.push("## Ejemplos needs_review", "");
    for (const g of review.slice(0, 20)) {
      const vs = fv.filter((v) => String(v.group_id) === String(g.id));
      reportLines.push(
        `- **${g.name}** (${vs.length} vars): ${vs
          .slice(0, 8)
          .map((v) => v.variant_label)
          .join(", ")}${vs.length > 8 ? "…" : ""}`,
      );
    }

    const outDir = path.join(ROOT, "reports");
    mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "product-groups.md");
    writeFileSync(outFile, reportLines.join("\n") + "\n", "utf8");

    console.log(
      JSON.stringify(
        {
          articulos: products.length,
          grupos: fg.length,
          needs_review: review.length,
          variantes: fv.length,
          report: outFile,
          adap_lay_flat_rm: adap
            ? {
                slug: adap.slug,
                n: adapVars.length,
                labels: adapVars.map((v) => v.variant_label),
              }
            : null,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
