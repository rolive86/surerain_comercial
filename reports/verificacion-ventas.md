# Verificación de ventas — SURE RAIN Comercial

Fecha: 2026-09-02  
Fuente: `public.v_ventas` (capa semántica) sobre `sales_history`  
Definición aplicada: NC netean · excluye `sales_exclusiones` (conceptos + códigos MERC*) · excluye familia `MERCHANDISING` si existiera  
**No se forzó ningún número del Power BI.**

---

## GATE 2 — Conteos por empresa (`sales_history`)

| empresa | filas | sum(total_facturado) bruto |
|--------|------:|---------------------------:|
| **3** Sure Rain | 103.366 | $12.756.929.529 |
| **5** Angus | 3.097 | $2.132.458.797 |

Ambas empresas tienen datos. Angus sin `customer_id` (esperado).

---

## Definición vs Diario (validado)

| Chequeo | Resultado |
|---------|-----------|
| Fabian Giulietti · Sure · agosto 2026 | **$121.023.216** |
| Diario cliente (validado) | **$121.023.216** |
| ¿Coincide? | **SÍ** |

Detalle: las líneas DCR de Fabian en agosto son exactamente `CHEQUERECHAZADO` + `GASTOSBANCARIOS` ($1.360.000). Al excluir conceptos vía `sales_exclusiones`, el total cierra con el Diario **sin** regla extra sobre tipo `DCR`.

---

## Agosto 2026 y año ene–ago 2026 (por empresa × vendedor)

Montos = `round(sum(venta_ars))` desde `v_ventas`.

### Empresa 3 — Sure Rain

| Vendedor | cod | Mes ago 2026 | Año ene–ago 2026 |
|----------|-----|-------------:|-----------------:|
| FABIAN GIULIETTI | 11 | **121.023.216** | **771.944.828** |
| GABRIEL NUÑEZ | 21 | 111.863.349 | 839.770.413 |
| PABLO GARCIA | 15 | 74.443.598 | 416.945.905 |
| CRISTIAN MAGNISI | 17 | 68.805.167 | 484.014.972 |
| GABRIEL VEGA | 08 | 45.501.936 | 433.362.727 |
| BARBARA FLORES | 18 | 19.983.636 | 119.276.253 |
| DAHIANA DOMINGUEZ | 24 | −1.578.303 | 15.822.289 |
| MAURICIO PEREYRA | 27 | — | 6.741.404 |
| **Total Sure (ene–ago)** | | **440.042.599** (solo ago) | **3.087.878.791** |

### Empresa 5 — Angus

| Vendedor (código; sin maestro local) | Mes ago 2026 | Año ene–ago 2026 |
|--------------------------------------|-------------:|-----------------:|
| 11 | 61.170.330 | 224.040.763 |
| 17 | 46.606.919 | 142.737.537 |
| 10 | 8.521.875 | 1.134.505 |
| 15 | 3.758.842 | 162.662.258 |
| 08 | 1.013.739 | 17.339.825 |
| 21 | — | 36.578.175 |
| 18 | — | 622.569 |
| **Total Angus (ene–ago)** | **121.071.704** (solo ago) | **585.115.632** |

### Totales combinados ene–ago 2026

| Ámbito | Monto |
|--------|------:|
| Sure + Angus | **$3.672.994.423** |

---

## Contraste Power BI del cliente (NO forzar)

| Métrica (Power BI / relato cliente) | Nuestro `v_ventas` | ¿Coincide? |
|-------------------------------------|-------------------:|:----------:|
| Fabian · Sure · mes ago = **$37 M** | **$121.023.216** | **NO** |
| Fabian · Sure · mes ago Diario = **$121.023.216** | **$121.023.216** | **SÍ** |
| Sure · año = **$688 M** | **$3.087.878.791** (ene–ago) | **NO** |
| Total año = **$914,47 M** | **$3.672.994.423** (ene–ago ambas) | **NO** |
| Fabian · Sure · año (no citado PBI; referencia) | **$771.944.828** | — |

### Preguntas para el cliente (antes de dibujar el dashboard)

1. **Power BI $37 M vs Diario $121 M (Fabian ago):** ¿El PBI filtra lista de precios, moneda, canal, o un subconjunto de comprobantes (solo FAC sin NC, sin DCR ya neteado, etc.)?
2. **Sure año $688 M vs nuestros ~$3.088 M:** ¿El PBI usa otra moneda (USD), precios netos de IVA, o un período distinto (¿solo ciertos meses / sin Angus mezclado / año calendario cerrado)?
3. **Total año $914,47 M:** ¿Incluye Sure+Angus? ¿Qué exclusiones adicionales aplica el modelo PBI además de conceptos/merchandising?
4. **Códigos MERC\*:** los sembramos como merchandising por código (no hay familia `MERCHANDISING` en emp 3 ni familias en articulos emp 5). ¿Confirmamos esa lista?
5. **Angus:** vendedores solo por código (ids se repiten con Sure). ¿Traemos maestro vendedores emp 5 con clave `(empresa, cod)`?

---

## Matriz Ventas por mes × año (2022–2026)

Fuente: `v_ventas`, **ambas empresas**. Formato estilo Power BI (filas = mes, columnas = año). Montos redondeados ARS.

| Mes | 2022 | 2023 | 2024 | 2025 | 2026 |
|----:|-----:|-----:|-----:|-----:|-----:|
| 1 | 46.410.083 | 127.398.023 | 187.817.127 | 488.587.642 | 674.674.687 |
| 2 | 38.553.108 | 45.933.871 | 142.552.144 | 318.450.900 | 497.634.294 |
| 3 | 48.178.384 | 137.432.527 | 145.181.289 | 273.390.018 | 390.493.942 |
| 4 | 44.593.855 | **−301.619.954** | 154.823.828 | 246.148.370 | 388.366.787 |
| 5 | 35.729.842 | 92.177.989 | 254.897.916 | 278.137.494 | 357.107.561 |
| 6 | 65.365.148 | 74.281.074 | 209.221.375 | 282.262.956 | 421.565.428 |
| 7 | 66.039.065 | 201.598.267 | 313.684.907 | 380.884.004 | 382.037.420 |
| 8 | 99.945.822 | 220.414.583 | 373.141.452 | 424.723.424 | 561.114.303 |
| 9 | 123.748.490 | 213.137.605 | 455.047.213 | 628.673.361 | 89.464.484* |
| 10 | 119.078.787 | 212.068.821 | 539.167.670 | 680.881.132 | — |
| 11 | 130.963.501 | 208.246.482 | 372.015.653 | 544.735.108 | — |
| 12 | 109.350.322 | 144.587.954 | 437.353.014 | 585.268.071 | — |

\* Septiembre 2026 parcial (corte al sync).

### Split Sure (3) / Angus (5) — ago 2026

| | Sure | Angus | Total |
|--|-----:|------:|------:|
| ago 2026 | 440.042.599 | 121.071.704 | 561.114.303 |

### Anomalía a explicar

**Abril 2023 Sure = −$304.748.603** (total combinado −$301.619.954). Hay un neteo/NC masivo o carga atípica. **No ajustar:** preguntar al cliente qué representa en Tango/PBI.

---

## Hallazgos de datos (Angus / semántica)

| Tema | Estado |
|------|--------|
| Familia `MERCHANDISING` en emp 3 | **No existe** en `products_tango` |
| Familias articulos emp 5 (espejo) | **Vacías** (`familia` null) |
| Exclusiones sembradas | `CHEQUERECHAZADO`, `GASTOSBANCARIOS`, `GASTOS DE ENVIO`, `FLETE`, 4× `MERC*` |
| Joins familia/vendedor | Solo emp 3 (masters actuales); emp 5 queda código sin nombre |
| Customer Angus | `null` (ok para totales empresa/vendedor) |

---

## GATE FINAL

- Usuario: `comercial.demo@surerain.test` · rol `sales_manager` (ve todo el backoffice).
- Módulo visible renombrado **Gestión/Operaciones → Comercial** (labels; rutas `/gestion/*` sin romper).
- `empresa` en `sales_history` + sync 3/5 + `v_ventas` listos.
- **Diario Fabian ago cierra.** Power BI $37M / $688M / $914M **no cierran** → listados arriba como preguntas.
- **Dashboard UI: no construido** (a propósito).
