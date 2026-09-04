/**
 * Inspect espejo_src foreign tables → reports/espejo-shapes.md
 * No normalize. Read-only. Filter empresa=3 when column is found.
 */
import fs from "node:fs";
import path from "node:path";
import { PATHS, ROOT } from "../../src/config.js";
import { commercialSql } from "./db.js";

const VIEWS = [
  "articulos",
  "clientes",
  "precios_por_articulo",
  "stock",
  "listas_precios",
  "vendedores",
  "ventas",
] as const;

type Col = { column_name: string; data_type: string };

function pickCol(cols: Col[], candidates: string[]): string | null {
  const lower = new Map(cols.map((c) => [c.column_name.toLowerCase(), c.column_name]));
  for (const cand of candidates) {
    const hit = lower.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function mdEscapeCell(v: unknown): string {
  if (v == null) return "∅";
  const s = String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function tableMd(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "_sin filas_\n";
  const keys = Object.keys(rows[0]!);
  const head = `| ${keys.join(" | ")} |`;
  const sep = `| ${keys.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${keys.map((k) => mdEscapeCell(r[k])).join(" | ")} |`)
    .join("\n");
  return `${head}\n${sep}\n${body}\n`;
}

async function main() {
  const sql = commercialSql();
  const lines: string[] = [
    "# Espejo shapes (`espejo_src`)",
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
    "Fuente: foreign schema importado desde el Supabase del cliente (solo lectura).",
    "Reglas del cliente: filtrar **empresa = 3** (Sure Rain); todo llega como texto; trim/cast en normalize (no acá).",
    "",
  ];

  try {
    const summary: Array<{
      view: string;
      empresaCol: string | null;
      countEmpresa3: string | null;
      distinctEmpresas: string;
    }> = [];

    for (const view of VIEWS) {
      lines.push(`## \`${view}\``, "");

      const cols = await sql<Col[]>`
        select column_name, data_type
        from information_schema.columns
        where table_schema = 'espejo_src'
          and table_name = ${view}
        order by ordinal_position
      `;

      if (!cols.length) {
        lines.push("_Tabla/vista no encontrada en `espejo_src`._", "");
        summary.push({
          view,
          empresaCol: null,
          countEmpresa3: null,
          distinctEmpresas: "n/a",
        });
        continue;
      }

      lines.push("### Columnas", "");
      lines.push("| column_name | data_type |");
      lines.push("| --- | --- |");
      for (const c of cols) {
        lines.push(`| \`${c.column_name}\` | ${c.data_type} |`);
      }
      lines.push("");

      const empresaCol = pickCol(cols, [
        "empresa",
        "cod_empresa",
        "id_empresa",
        "nro_empresa",
        "emp",
        "empresa_id",
      ]);

      let distinctEmpresas = "sin columna empresa detectada";
      let countEmpresa3: string | null = null;
      let samples: Record<string, unknown>[] = [];

      if (empresaCol) {
        const dist = await sql.unsafe(
          `select ${quoteIdent(empresaCol)} as empresa, count(*)::text as n
           from espejo_src.${quoteIdent(view)}
           group by 1
           order by 1
           limit 20`,
        );
        distinctEmpresas = (dist as Array<{ empresa: unknown; n: string }>)
          .map((r) => `${String(r.empresa)}=${r.n}`)
          .join(", ");

        const cnt = await sql.unsafe(
          `select count(*)::text as n from espejo_src.${quoteIdent(view)}
           where ${quoteIdent(empresaCol)} = '3'`,
        );
        countEmpresa3 = (cnt as Array<{ n: string }>)[0]?.n ?? null;

        samples = (await sql.unsafe(
          `select * from espejo_src.${quoteIdent(view)}
           where ${quoteIdent(empresaCol)} = '3'
           limit 3`,
        )) as Record<string, unknown>[];
      } else {
        samples = (await sql.unsafe(
          `select * from espejo_src.${quoteIdent(view)} limit 3`,
        )) as Record<string, unknown>[];
        const total = await sql.unsafe(
          `select count(*)::text as n from espejo_src.${quoteIdent(view)}`,
        );
        countEmpresa3 = `total_sin_filtro=${(total as Array<{ n: string }>)[0]?.n}`;
      }

      lines.push("### Columna empresa", "");
      lines.push(
        empresaCol
          ? `- Detectada: \`${empresaCol}\``
          : "- **No detectada** entre candidatos (`empresa`, `cod_empresa`, …).",
      );
      lines.push(`- Valores distintos (muestra): ${distinctEmpresas}`);
      lines.push(
        `- Conteo empresa = '3': **${countEmpresa3 ?? "n/a"}**`,
      );
      lines.push("");

      lines.push("### 3 filas de muestra (empresa = 3 si aplica)", "");
      lines.push(tableMd(samples));
      lines.push("");

      // Field hints for the normalize prompt
      lines.push("### Claves candidatas (heurística)", "");
      const hints = fieldHints(view, cols);
      for (const h of hints) lines.push(`- ${h}`);
      lines.push("");

      summary.push({
        view,
        empresaCol,
        countEmpresa3,
        distinctEmpresas,
      });
    }

    lines.push("## Resumen ejecutivo", "");
    lines.push("| vista | col empresa | count emp=3 | empresas vistas |");
    lines.push("| --- | --- | --- | --- |");
    for (const s of summary) {
      lines.push(
        `| ${s.view} | ${s.empresaCol ?? "—"} | ${s.countEmpresa3 ?? "—"} | ${s.distinctEmpresas} |`,
      );
    }
    lines.push("");
    lines.push("## Identificación explícita (para normalize)", "");
    lines.push(
      "_Completado automáticamente con heurística sobre nombres de columna; validar contra las muestras._",
      "",
    );
    lines.push(await explicitIds(sql));
    lines.push("");
    lines.push("## STOP", "");
    lines.push(
      "No se escribió normalize. Con este reporte se arma el mapeo real (empresa 3, trim/cast, upsert por códigos Tango).",
      "",
    );

    fs.mkdirSync(PATHS.reports, { recursive: true });
    const out = path.join(PATHS.reports, "espejo-shapes.md");
    fs.writeFileSync(out, lines.join("\n"), "utf8");
    console.log(`Wrote ${path.relative(ROOT, out)}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function quoteIdent(ident: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`Unsafe identifier: ${ident}`);
  }
  return `"${ident}"`;
}

function fieldHints(view: string, cols: Col[]): string[] {
  const names = cols.map((c) => c.column_name);
  const find = (...cands: string[]) =>
    pickCol(
      cols,
      cands,
    );

  const out: string[] = [];
  if (view === "articulos") {
    out.push(`código artículo: \`${find("cod_articulo", "codigo", "cod_art", "articulo") ?? "?"}\``);
    out.push(
      `código de barras: \`${find("cod_barra", "cod_barras", "barcode", "ean", "barra") ?? "?"}\``,
    );
  }
  if (view === "clientes") {
    out.push(`código cliente: \`${find("cod_cliente", "cod_gva14", "codigo", "cliente") ?? "?"}\``);
    out.push(
      `vendedor asignado: \`${find("cod_vendedor", "vendedor", "gva23", "id_vendedor") ?? "?"}\``,
    );
    out.push(`lista: \`${find("nro_lista", "cod_lista", "lista", "lista_precios") ?? "?"}\``);
  }
  if (view === "vendedores") {
    out.push(`código vendedor: \`${find("cod_vendedor", "cod_gva23", "codigo", "vendedor") ?? "?"}\``);
  }
  if (view === "listas_precios") {
    out.push(`código/nro lista: \`${find("nro_de_lis", "nro_lista", "cod_lista", "lista") ?? "?"}\``);
  }
  if (view === "precios_por_articulo") {
    out.push(`lista: \`${find("nro_lista", "cod_lista", "lista", "nro_de_lis") ?? "?"}\``);
    out.push(`precio: \`${find("precio", "importe", "precio_lista") ?? "?"}\``);
    out.push(
      `moneda/IVA: \`${find("moneda", "cod_moneda", "iva", "porc_iva", "incluye_iva") ?? "?"}\``,
    );
    out.push(
      `artículo: \`${find("cod_articulo", "articulo", "codigo") ?? "?"}\``,
    );
  }
  if (view === "stock") {
    out.push(`artículo: \`${find("cod_articulo", "articulo", "codigo") ?? "?"}\``);
    out.push(`cantidad: \`${find("cantidad", "stock", "saldo", "cant") ?? "?"}\``);
  }
  if (view === "ventas") {
    out.push(`cliente: \`${find("cod_cliente", "cliente") ?? "?"}\``);
    out.push(`vendedor: \`${find("cod_vendedor", "vendedor") ?? "?"}\``);
    out.push(`artículo: \`${find("cod_articulo", "articulo") ?? "?"}\``);
  }
  out.push(`columnas totales: ${names.length}`);
  return out;
}

async function explicitIds(sql: ReturnType<typeof commercialSql>): Promise<string> {
  const chunks: string[] = [];

  async function colsOf(view: string) {
    return sql<Col[]>`
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'espejo_src' and table_name = ${view}
      order by ordinal_position
    `;
  }

  const art = await colsOf("articulos");
  const cli = await colsOf("clientes");
  const prec = await colsOf("precios_por_articulo");
  const lis = await colsOf("listas_precios");
  const ven = await colsOf("vendedores");

  const empresa =
    pickCol(art, ["empresa", "cod_empresa", "id_empresa", "nro_empresa"]) ||
    pickCol(cli, ["empresa", "cod_empresa", "id_empresa", "nro_empresa"]);

  chunks.push(`- **Columna empresa:** \`${empresa ?? "NO ENCONTRADA"}\``);
  chunks.push(
    `- **Código artículo:** \`${pickCol(art, ["cod_articulo", "codigo", "cod_art"]) ?? "?"}\``,
  );
  chunks.push(
    `- **Código barras (articulos):** \`${pickCol(art, ["cod_barra", "cod_barras", "barcode", "ean", "barra"]) ?? "?"}\``,
  );
  chunks.push(
    `- **Código cliente:** \`${pickCol(cli, ["cod_cliente", "cod_gva14", "codigo"]) ?? "?"}\``,
  );
  chunks.push(
    `- **Código vendedor:** \`${pickCol(ven, ["cod_vendedor", "cod_gva23", "codigo"]) ?? "?"}\``,
  );
  chunks.push(
    `- **Código lista:** \`${pickCol(lis, ["nro_de_lis", "nro_lista", "cod_lista", "lista"]) ?? pickCol(prec, ["nro_lista", "cod_lista", "lista"]) ?? "?"}\``,
  );
  chunks.push(
    `- **precios_por_articulo → lista:** \`${pickCol(prec, ["nro_lista", "cod_lista", "lista", "nro_de_lis"]) ?? "?"}\``,
  );
  chunks.push(
    `- **precios_por_articulo → precio:** \`${pickCol(prec, ["precio", "importe", "precio_lista"]) ?? "?"}\``,
  );
  chunks.push(
    `- **precios_por_articulo → moneda/IVA:** \`${pickCol(prec, ["moneda", "cod_moneda", "iva", "porc_iva", "incluye_iva", "desc_iva"]) ?? "?"}\``,
  );

  // How to find lista 29
  const listaCol = pickCol(lis, ["nro_de_lis", "nro_lista", "cod_lista", "lista"]);
  if (listaCol && empresa) {
    try {
      const rows = await sql.unsafe(
        `select * from espejo_src.listas_precios
         where ${quoteIdent(empresa)} = '3'
           and (
             ${quoteIdent(listaCol)} = '29'
             or trim(${quoteIdent(listaCol)}) = '29'
           )
         limit 5`,
      );
      chunks.push(
        `- **Lista 29 (empresa 3):** ${
          (rows as unknown[]).length
            ? `encontrada por \`${listaCol}\`='29' — ver muestra abajo`
            : `no hay fila con \`${listaCol}\`='29' (probar otras columnas / padding)`
        }`,
      );
      if ((rows as unknown[]).length) {
        chunks.push("", "### Muestra lista 29", "", tableMd(rows as Record<string, unknown>[]));
      }
    } catch (e) {
      chunks.push(`- **Lista 29:** error al consultar (${e instanceof Error ? e.message : e})`);
    }
  } else {
    chunks.push("- **Lista 29:** no se pudo resolver columna lista/empresa en `listas_precios`");
  }

  const vendCli = pickCol(cli, ["cod_vendedor", "vendedor", "gva23"]);
  const listaCli = pickCol(cli, ["nro_lista", "cod_lista", "lista"]);
  chunks.push(
    `- **clientes.vendedor asignado:** \`${vendCli ?? "no aparece"}\``,
  );
  chunks.push(`- **clientes.lista embebida:** \`${listaCli ?? "no aparece"}\``);

  return chunks.join("\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
