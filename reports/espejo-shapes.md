# Espejo shapes (`espejo_src`)

Generado: 2026-08-21T19:20:00.000Z

Fuente: foreign schema `espejo` importado vía `postgres_fdw` (`server surerain_espejo`) en `sure_rain_commercial_db`. Solo lectura.

Reglas del cliente: filtrar **siempre `empresa = '3'`** (Sure Rain; `5` = Angus); todo llega como **text** (más meta `id`/`_sync_at`/timestamps); trim/cast en normalize (no acá); preservar originales.

**GATE FDW:** `select count(*) from espejo_src.articulos` → **5677** ✓

---

## Resumen ejecutivo

| vista | col empresa | count emp=3 | empresas |
| --- | --- | --- | --- |
| articulos | `empresa` | **2890** | 3=2890, 5=2787 |
| clientes | `empresa` | **3744** | 3=3744, 5=2134 |
| precios_por_articulo | `empresa` | **39696** | 3=39696, 5=34888 |
| stock | `empresa` | **2770** | 3=2770, 5=18 |
| listas_precios | `empresa` | **30** | 3=30, 5=30 |
| vendedores | `empresa` | **23** | 3=23, 5=20 |
| ventas | `empresa` | **102534** | 3=102534, 5=3085 |

Extras útiles:
- Precios lista **29** (emp 3): **1670** filas
- Artículos emp 3 con `cod_barra` no vacío: **2740 / 2890**
- Clientes emp 3 con `gva10_nro_de_lis` no vacío: **solo 3** (la lista casi no viene embebida)
- Vendedores distintos referenciados en clientes emp 3 (`gva23_codigo`): **17**

---

## Identificación explícita (para normalize)

- **Columna empresa:** `empresa` (text; valores `'3'` y `'5'`)
- **Código artículo:** `cod_sta11` en `articulos` / `precios_por_articulo`; en `stock` y `ventas` se llama `cod_articulo` (mismo significado)
- **Código de barras (articulos):** `cod_barra`
- **Código cliente:** `cod_gva14` (+ `id_gva14`)
- **Código vendedor:** `cod_gva23` (+ `id_gva23`); en clientes: `gva23_codigo` / `gva23_descripcion`
- **Código lista:** `nro_de_lis` (+ `id_gva10`, `nombre_lis`)
- **precios_por_articulo → lista:** `nro_de_lis`
- **precios_por_articulo → precio:** `precio` (text, ej. `"27.3"`)
- **precios_por_articulo → moneda/IVA:** `moneda_corriente` (ej. `"U$S - DOLARES"`), `incluy_iva`, `incluy_imp` (text `"true"`/`"false"`)
- **Lista 29:** `nro_de_lis = '29'` → nombre `ABRIL 2025`, `habilitada='true'`, `mon_cte='false'`, `incluy_iva='false'`
- **clientes.vendedor asignado:** sí → `gva23_codigo` + `gva23_descripcion`
- **clientes.lista embebida:** columna `gva10_nro_de_lis` / `gva10_nombre_lis` existe pero **casi siempre null** (3/3744)

---

## `articulos`

### Columnas (147)

| column_name | data_type |
| --- | --- |
| `id` | bigint |
| `empresa` | text |
| `_sync_at` | timestamptz |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `cod_sta11` | text |
| `descripcio` | text |
| `sinonimo` | text |
| `cod_barra` | text |
| `fecha_alta` | text |
| `familia` | text |
| `grupo` | text |
| `comentarios` | text |
| `clasificacion` | text |
| `id_sta11` | text |
| … | (resto mayormente flags/impuestos Tango, todos text) |
| `gva41_cod_iva` / `gva41_desc_iva` | text |
| `observaciones` | text |

> Columnas completas disponibles en `information_schema` / FDW; las relevantes para portal: `empresa`, `cod_sta11`, `descripcio`, `cod_barra`, `familia`, `grupo`, `id_sta11`, IVA (`gva41_*`).

### Columna empresa

- Detectada: `empresa`
- Valores: `3=2890`, `5=2787`
- Conteo empresa=`3`: **2890**

### 3 filas muestra (empresa=3)

| cod_sta11 | descripcio | cod_barra | familia | gva41_desc_iva |
| --- | --- | --- | --- | --- |
| ACAL000013810-8 | UNION PEAD 63 X 63 MM | 7790010000067 | ∅ | I.V.A. |
| ACAL000014810-6 | UNION PEAD T 40 X 40 X 40 | 7790010000117 | ∅ | I.V.A. |
| ACAL000016841-4 | FINAL DE LINEA 32MM | 7790010000157 | ∅ | I.V.A. |

### Claves candidatas

- código artículo: `cod_sta11`
- código de barras: `cod_barra`
- descripción: `descripcio` (truncado Tango)

---

## `clientes`

### Columnas clave (121 total; todas text salvo id/timestamps)

| column_name | rol |
| --- | --- |
| `empresa` | filtro |
| `cod_gva14` | código cliente |
| `id_gva14` | id interno Tango |
| `razon_soci` | razón social |
| `nom_com` | nombre comercial |
| `cuit` | CUIT |
| `e_mail` | email |
| `habilitado` | active (`"true"`/`"false"`) |
| `gva23_codigo` / `gva23_descripcion` | **vendedor asignado** |
| `gva10_nro_de_lis` / `gva10_nombre_lis` | lista (casi siempre null) |
| `desc_categoria_iva` / `cod_categoria_iva` | condición IVA |
| `porc_desc` | % descuento |
| `domicilio`, `localidad`, `c_postal`, `telefono_1` | contacto |

### Columna empresa

- `3=3744`, `5=2134`

### 3 filas muestra (empresa=3)

| cod_gva14 | razon_soci | cuit | e_mail | habilitado | gva23_codigo | gva23_descripcion | gva10_nro_de_lis | desc_categoria_iva |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DE MAR | DE MARCH ARIEL EDUARDO | 23-26136440-9 | ceciliaferron08@gmail.com | true | 15 | PABLO GARCIA | ∅ | Responsable inscripto |
| ARBIZ | ARBIZU SEBASTIAN | 20-33985659-2 | riegopuntoar@gmail.com | true | 15 | PABLO GARCIA | ∅ | Responsable inscripto |
| CARRER | CARRERAS LEOPOLDO GUSTAVO | 20-06054212-1 | ∅ | true | 25 | OFICINA H | ∅ | Responsable inscripto |

---

## `precios_por_articulo`

### Columnas (21)

| column_name | data_type |
| --- | --- |
| `id` | bigint |
| `empresa` | text |
| `id_gva17` | text |
| `nro_de_lis` | text |
| `nombre_lis` | text |
| `incluy_iva` | text |
| `incluy_imp` | text |
| `cod_sta11` | text |
| `descripcio` | text |
| `desc_adic` | text |
| `id_sta11` | text |
| `id_gva10` | text |
| `precio` | text |
| `fecha_modi` | text |
| `base` | text |
| `id_maestro_gva17` | text |
| `moneda_corriente` | text |
| `filler` | text |
| `_sync_at` | timestamptz |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### Columna empresa

- `3=39696`, `5=34888`

### 3 filas muestra (empresa=3, lista 29)

| nro_de_lis | nombre_lis | cod_sta11 | precio | moneda_corriente | incluy_iva | fecha_modi |
| --- | --- | --- | --- | --- | --- | --- |
| 29 | ABRIL 2025 | ACYOELBRIDGIR63 | 27.3 | U$S - DOLARES | false | 2026-08-18T19:20:01.85 |
| 29 | ABRIL 2025 | ACYOELBRIDGIR75 | 33 | U$S - DOLARES | false | 2026-08-18T19:20:22.93 |
| 29 | ABRIL 2025 | ACAL00016841-11 | 58.8 | U$S - DOLARES | false | 2025-04-14T17:50:53 |

### Cómo identificar lista 29

`where empresa = '3' and nro_de_lis = '29'` → **1670** precios. Moneda tipica USD; IVA no incluido.

---

## `stock`

### Columnas clave

| column_name | rol |
| --- | --- |
| `empresa` | filtro |
| `cod_articulo` | código (= `cod_sta11`) |
| `codigo_de_barras` | barra |
| `cod_deposito` / `descripcion_deposito` | depósito |
| `saldo_stock` / `saldo_control_stock` | cantidad (text) |
| `cantidad_comprometida` | comprometido |

### Columna empresa

- `3=2770`, `5=18`

### 3 filas muestra (empresa=3)

| cod_articulo | descripcion | codigo_de_barras | cod_deposito | saldo_stock |
| --- | --- | --- | --- | --- |
| ACKE0ADAPRM40X1 | ADAPTADOR RM PEAD 40 X 1" | 7790010003917 | 01 | 933 |
| ROHOS2P80AE | BOMBA | 7790010018737 | 01 | 0 |
| ROVE8V24/7 | CUERPO DE BOMBA | 7790010019037 | 01 | 0 |

---

## `listas_precios`

### Columnas (19)

`id`, `empresa`, `_sync_at`, `created_at`, `updated_at`, `gva10_parametros_automatizacion`, `cta_lista_venta_por_sucursal`, `id_gva10`, `nro_de_lis`, `nombre_lis`, `habilitada`, `mon_cte`, `decimales`, `incluy_iva`, `incluy_imp`, `fec_desde`, `fec_hasta`, `observaciones`, `cod_descrip`

### Lista 29 (empresa=3)

| nro_de_lis | nombre_lis | habilitada | mon_cte | incluy_iva |
| --- | --- | --- | --- | --- |
| 29 | ABRIL 2025 | true | false | false |

(`mon_cte=false` ⇒ no moneda corriente ⇒ coherente con USD en precios)

---

## `vendedores`

### Columnas clave

| column_name | rol |
| --- | --- |
| `empresa` | filtro |
| `cod_gva23` | código vendedor |
| `id_gva23` | id interno |
| `nombre_ven` | nombre |
| `inhabilita` | inactivo (`"true"`/`"false"`) |
| `e_mail` | email |

### Columna empresa

- `3=23`, `5=20`

### 3 filas muestra (empresa=3)

| cod_gva23 | nombre_ven | inhabilita | id_gva23 |
| --- | --- | --- | --- |
| 01 | VENTAS PROPIAS | false | 1 |
| 02 | DANIEL | false | 2 |
| 03 | JORGE BUEZAS | true | 3 |

---

## `ventas`

### Columnas clave (83 total)

| column_name | rol |
| --- | --- |
| `empresa` | filtro |
| `cod_cliente` / `razon_social` | cliente |
| `cod_vendedor` / `nombre_vendedor` | vendedor |
| `cod_articulo` / `descripcion` | artículo |
| `cantidad` / `precio_unitario` / `total` | montos (text) |
| `fecha_de_emision` | fecha |
| `lista_de_precios` | nro lista (ej. `"29"`) |
| `moneda` | text (muestra: `"true"` — revisar semántica) |

### Columna empresa

- `3=102534`, `5=3085`

### 3 filas muestra (empresa=3)

| cod_cliente | cod_vendedor | nombre_vendedor | cod_articulo | cantidad | precio_unitario | fecha_de_emision | lista_de_precios |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MATTA | 11 | FABIAN GIULIETTI | ASKA0000000FN8H | 50 | 2.7 | 2026-08-14 | 29 |
| GALLET | 21 | GABRIEL NUÑEZ | VASRVESF1UD11/2 | 160 | 14.8 | 2026-08-05 | 29 |
| RIEGOF | 11 | FABIAN GIULIETTI | ACGR003000.0006 | 5 | 5.2 | 2026-07-30 | 29 |

---

## Notas para el prompt de normalize (NO implementado)

1. Filtrar `empresa = '3'` en **todas** las vistas.
2. Upsert keys sugeridos: clientes `cod_gva14`; vendedores `cod_gva23`; artículos `cod_sta11`; precios (`nro_de_lis`,`cod_sta11`); listas `nro_de_lis`.
3. Cast: `precio`/`cantidad`/`saldo_*` → numeric; `habilitado`/`inhabilita`/`incluy_*` → boolean desde text; fechas desde text ISO.
4. Trim para joins; **guardar original** en columnas raw si hace falta.
5. Asignación vendedor desde `clientes.gva23_codigo` (no depender de lista embebida).
6. Precio portal: lista `29` + `moneda_corriente` USD + `incluy_iva=false`.
7. Re-map `product_map` contra `cod_barra` / `cod_sta11` de los **2890** artículos emp 3.

## STOP

No se escribió normalize. Con este reporte se arma el mapeo real.
