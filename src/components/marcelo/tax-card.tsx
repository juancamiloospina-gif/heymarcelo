import { Landmark } from "lucide-react";
import { Card, Chips } from "./kit";
import { IconChip } from "./visual";
import { useMarcelo } from "@/lib/marcelo-store";
import { money } from "@/lib/marcelo-data";
import { US_STATES, salesTaxNote, selfEmploymentTax, stateIncomeTaxNote } from "@/lib/taxes";

/**
 * "Impuestos de tu negocio": answers "¿pago IVA?" (there is no IVA in the US; there is state
 * sales tax) and keeps the few tax facts Marcelo needs: state, type of tax ID, sales-tax status.
 */
export function TaxCard({ profit }: { profit: number }) {
  const { state, setProfile } = useMarcelo();
  const p = state.profile;
  const se = selfEmploymentTax(profit);

  return (
    <>
      <p className="mb-3 rounded-2xl bg-brand-soft p-3 text-[14px] leading-snug">
        <b>El impuesto federal es igual en todo el país</b> (ganancia, self-employment tax,
        formulario 1099-NEC). Tu estado solo cambia el sales tax y el impuesto estatal sobre el
        ingreso.
      </p>
      <Card className="space-y-3 text-[15px] leading-relaxed">
        <div className="flex items-start gap-3">
          <IconChip icon={Landmark} tone="sky" />
          <div>
            <p className="text-[16px] font-bold">¿Pago IVA?</p>
            <p className="text-muted-foreground">
              En Estados Unidos no existe el IVA. Lo parecido es el <b>sales tax</b>, que fija cada
              estado (y a veces la ciudad). Casi siempre se cobra por productos; los servicios
              dependen del estado.
            </p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">
            ¿En qué estado trabajas?
          </span>
          <select
            value={p.taxState ?? ""}
            onChange={(e) => setProfile({ taxState: e.target.value || undefined })}
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[16px] outline-none focus:border-accent"
          >
            <option value="">Elige tu estado</option>
            {US_STATES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="rounded-2xl bg-warning/10 p-3 text-[14px] text-warning-foreground">
          {salesTaxNote(p.taxState)}
        </p>
        {p.taxState ? (
          <p className="text-[14px] text-muted-foreground">{stateIncomeTaxNote(p.taxState)}</p>
        ) : null}

        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={p.salesTaxRegistered ?? false}
            onChange={(e) => setProfile({ salesTaxRegistered: e.target.checked })}
          />
          Mi estado me pidió registrarme para cobrar sales tax
        </label>
        {p.salesTaxRegistered ? (
          <p className="text-[14px] text-muted-foreground">
            Marcelo todavía no calcula sales tax en tus facturas. Súmalo tú al precio y pídele a tu
            contador cómo reportarlo.
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-[14px] font-medium text-muted-foreground">
            ¿Con qué número declaras? (solo el tipo, nunca el número)
          </p>
          <Chips
            options={[
              { key: "ssn", label: "SSN" },
              { key: "itin", label: "ITIN" },
              { key: "ein", label: "EIN" },
            ]}
            value={p.taxIdType}
            onChange={(k) => setProfile({ taxIdType: k })}
          />
        </div>
      </Card>

      <SectionTitle2 />
      <Card className="space-y-2 text-[15px] leading-relaxed">
        <p>
          <b>Impuesto federal sobre tu ganancia:</b> aplica a casi todos los que trabajan por su
          cuenta, también con ITIN.
        </p>
        <p>
          <b>Seguro social y Medicare (self-employment tax):</b> 15.3% de tu ganancia neta (se
          calcula sobre el 92.35%), si ganaste $400 o más en el año.
        </p>
        {profit > 0 ? (
          <p className="rounded-2xl bg-muted p-3">
            Con tu ganancia de este año ({money(profit)}), solo ese impuesto sería cerca de{" "}
            <b>{money(se)}</b>. Es un cálculo aproximado: aparte va el impuesto sobre el ingreso.
            Mucha gente aparta entre 25% y 30% de cada cobro.
          </p>
        ) : null}
        <p>
          <b>Formulario 1099-NEC:</b> si un cliente que es un <i>negocio</i> te pagó $2,000 o más en
          2026, debe mandártelo (antes el mínimo era $600). Las personas en su casa no lo mandan.
          Declaras todo lo que cobraste, llegue o no el formulario.
        </p>
        <p className="text-muted-foreground">
          Las reglas cambian por año y por estado. Confirma todo con un contador de tu zona antes de
          declarar. Marcelo organiza tus números; no da consejos de impuestos.
        </p>
      </Card>
    </>
  );
}

function SectionTitle2() {
  return (
    <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.1em] text-foreground">
      Lo que sí pagas casi seguro
    </h2>
  );
}
