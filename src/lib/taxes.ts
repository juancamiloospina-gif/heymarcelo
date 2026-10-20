/**
 * Taxes for a one-person service business in the US (gardening, cleaning, repairs…).
 * This is general information to ORGANIZE the user's records, not tax advice; rules change by
 * state and by year, so every screen that shows it tells the user to confirm with a local CPA.
 * Last checked: October 2026 (IRS and state agency pages; see docs/IMPUESTOS.md for sources).
 *
 * What Marcelo stores (never an SSN/EIN number): `profile.taxState`, `profile.taxIdType`,
 * `profile.salesTaxRegistered`.
 */

export const US_STATES: [code: string, name: string][] = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "Washington, D.C."],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawái"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Luisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Míchigan"],
  ["MN", "Minnesota"],
  ["MS", "Misisipi"],
  ["MO", "Misuri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "Nuevo Hampshire"],
  ["NJ", "Nueva Jersey"],
  ["NM", "Nuevo México"],
  ["NY", "Nueva York"],
  ["NC", "Carolina del Norte"],
  ["ND", "Dakota del Norte"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregón"],
  ["PA", "Pensilvania"],
  ["RI", "Rhode Island"],
  ["SC", "Carolina del Sur"],
  ["SD", "Dakota del Sur"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "Virginia Occidental"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

/** States with no tax on wages/self-employment income at the state level (as of 2026). */
const NO_STATE_INCOME_TAX = new Set(["AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY"]);

/** Self-employment tax: 15.3% of 92.35% of net profit; nothing under $400 of net earnings. */
export function selfEmploymentTax(netProfit: number): number {
  if (netProfit < 400) return 0;
  return Math.round(netProfit * 0.9235 * 0.153);
}

/** What the screen tells the user about sales tax ("IVA") in their state. Short, with the caveat. */
export function salesTaxNote(state: string | undefined): string {
  switch (state) {
    case "TX":
      return "En Texas, la jardinería y el paisajismo suelen estar sujetos a sales tax (y hay una excepción para quien trabaja por su cuenta y factura poco al año). Confirma con un contador si debes registrarte y cobrarlo.";
    case "FL":
      return "En Florida, la limpieza de edificios comerciales paga sales tax; la de casas no. La jardinería normalmente no. Confirma tu caso con el Departamento de Ingresos o un contador.";
    case "CA":
      return "En California, la mano de obra de un servicio normalmente no paga sales tax, pero sí los materiales que vendes al cliente. Según el tipo y monto del trabajo, también puede exigirse licencia de contratista. Confirma con un contador.";
    case undefined:
    case "":
      return "Elige tu estado para ver el aviso que le toca. Cada estado decide si los servicios pagan sales tax.";
    default:
      return "Cada estado decide si los servicios pagan sales tax; muchos no gravan la mano de obra pero sí los materiales. Confirma con un contador de tu estado.";
  }
}

export function stateIncomeTaxNote(state: string | undefined): string {
  if (!state) return "";
  return NO_STATE_INCOME_TAX.has(state)
    ? "Tu estado no cobra impuesto estatal sobre el ingreso del trabajo, pero el impuesto federal sí aplica."
    : "Tu estado puede cobrar un impuesto estatal sobre tu ganancia, además del federal. Pregunta el porcentaje y las fechas.";
}
