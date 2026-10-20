# Impuestos para el autoempresario (investigado 20/10/2026)

Información general para **organizar los registros**; no es asesoría fiscal. Confirmar siempre con un contador (CPA/EA) del estado del usuario.

## ¿Paga IVA?

No. EE. UU. no tiene IVA. Lo parecido es el **sales tax**, fijado por estado (y a veces ciudad/condado). Casi siempre grava **productos**; los **servicios** varían:

- **Texas:** la jardinería/paisajismo y el mantenimiento de césped son servicios gravables; hay una excepción para quien trabaja por su cuenta con ingresos muy bajos (cifra de $5,000 en 4 trimestres según un dictamen de 2001: **verificar la vigente**). [Texas Comptroller](https://www.comptroller.texas.gov/taxes/publications/94-112.php)
- **Florida:** la limpieza de edificios **no residenciales** es gravable; la de casas no. Jardinería: no confirmado. [Florida DOR](https://floridarevenue.com/forms_library/current/gt800015.pdf)
- **California:** en general la mano de obra de servicios no paga sales tax, sí los materiales que se venden. **No verificado con fuente oficial** (CDTFA).
- **Otros estados:** varía; la app lo dice y remite a un contador.

Registro: si el estado lo exige, hay que **registrarse para cobrar sales tax**, cobrarlo al cliente y declararlo. **Marcelo todavía no lo calcula en las facturas** (se avisa en pantalla).

## Qué entregar al contador (igual en todos los estados)

1. Formularios 1099-NEC (umbral $2,000 para pagos de 2026; $600 antes). 2. Registro de todos los ingresos, con o sin 1099. 3. Comprobantes de gastos y millas, por categoría. 4. Comprobantes de pagos estimados 1040-ES. La app los muestra en Dinero › Contador › "Qué entregar a tu contador" (2 y 3 se llenan solos; 1 y 4 los marca el usuario, `profile.taxDocs`).

## Impuestos que casi seguro sí aplican

- **Impuesto federal sobre la ganancia** (Schedule C). También con ITIN.
- **Self-employment tax: 15.3%** (12.4% seguro social hasta el tope de $184,500 en 2026 + 2.9% Medicare) sobre el **92.35%** de la ganancia neta, si ≥ $400. La mitad es deducible.
- **Pagos estimados trimestrales** (Form 1040-ES): 15 abr, 15 jun, 15 sep, 15 ene (ya están en la pestaña Contador).
- **Impuesto estatal sobre el ingreso**: no existe en AK, FL, NV, NH, SD, TN, TX, WA, WY; en los demás sí.
- **Form 1099-NEC**: un cliente _negocio_ debe mandarlo si pagó ≥ **$2,000** en 2026 (antes $600); clientes residenciales no. Todo ingreso se declara igual.
- **Millas**: deducibles con la tarifa estándar del IRS. La tarifa 2026 fue **72.5¢** (Notice 2026-10); una fuente secundaria indica un ajuste a mitad de año, **confirmar la vigente en irs.gov** antes de mostrar cifras.

## Qué guarda la app

`profile.taxState` (estado), `profile.taxIdType` (SSN/ITIN/EIN; **nunca el número**), `profile.salesTaxRegistered`. Facturas: fecha de facturación (`job.invoicedAt`). Pagos con método "Otro" incluidos en el resumen.

## Advertencias que muestra

Aviso de sales tax por estado, aviso de impuesto estatal, estimación de self-employment tax con "aparta 25–30%", y "confirma con un contador" en cada bloque.

Fuentes consultadas: IRS (tasas 2026, Notice 2026-10), guías 2026 de self-employment tax y 1099-NEC, Texas Comptroller, Florida DOR.
