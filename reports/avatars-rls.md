# Avatars bucket — RLS negativa (vivo)

- Staff: `vendedor.demo@surerain.test` (`c8e8427a-b9be-4765-8f78-b6e8612d6849`)
- Cliente path: `f6292bdd-5e3b-407f-84eb-5b58c51fe0ca/avatar.png`
- Own path: `c8e8427a-b9be-4765-8f78-b6e8612d6849/avatar.png`

| Caso | Esperado | Resultado | Detalle |
|---|---|---|---|
| staff upload to cliente.demo folder | FAIL with 403 / RLS | PASS | status=403 message=new row violates row-level security policy |
| staff upload to own folder | SUCCESS | PASS | uploaded c8e8427a-b9be-4765-8f78-b6e8612d6849/avatar.png |

**Overall: PASS**
