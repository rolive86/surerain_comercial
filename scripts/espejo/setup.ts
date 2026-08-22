/**
 * Mount postgres_fdw → client espejo schema as espejo_src.
 * Reads ESPEJO_* + COMMERCIAL_DATABASE_URL from .env.local. Never logs passwords.
 * Idempotent. SELECT-only against remote after import.
 */
import { commercialSql, espejoRemoteOptions, sqlLiteral } from "./db.js";

async function main() {
  const remote = espejoRemoteOptions();
  if (remote.port === "6543") {
    throw new Error("ESPEJO_PORT=6543 is transaction mode; use 5432 for FDW");
  }

  const sql = commercialSql();
  try {
    await sql.unsafe(`create extension if not exists postgres_fdw`);

    await sql.unsafe(`
do $setup$
begin
  if not exists (select 1 from pg_foreign_server where srvname = 'surerain_espejo') then
    create server surerain_espejo
      foreign data wrapper postgres_fdw
      options (
        host ${sqlLiteral(remote.host)},
        port ${sqlLiteral(remote.port)},
        dbname ${sqlLiteral(remote.db)}
      );
  else
    alter server surerain_espejo options (
      set host ${sqlLiteral(remote.host)},
      set port ${sqlLiteral(remote.port)},
      set dbname ${sqlLiteral(remote.db)}
    );
  end if;
end
$setup$;
`);

    // Mapping for the connecting role (usually postgres). Password from env only.
    await sql.unsafe(`drop user mapping if exists for current_user server surerain_espejo`);
    await sql.unsafe(`
create user mapping for current_user
  server surerain_espejo
  options (
    user ${sqlLiteral(remote.user)},
    password ${sqlLiteral(remote.password)}
  )
`);

    await sql.unsafe(`drop schema if exists espejo_src cascade`);
    await sql.unsafe(`create schema espejo_src`);
    await sql.unsafe(`
import foreign schema espejo
  from server surerain_espejo
  into espejo_src
`);

    const [{ count }] = await sql<{ count: string }[]>`
      select count(*)::text as count from espejo_src.articulos
    `;
    const n = Number(count);
    console.log(
      JSON.stringify(
        {
          ok: true,
          server: "surerain_espejo",
          schema: "espejo_src",
          articulos_count: n,
          gate: n >= 5000 ? "pass" : "warn_below_5677",
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
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
