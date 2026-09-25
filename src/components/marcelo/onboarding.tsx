import { useState } from "react";
import { Button, Field } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";

const steps = [
  { key: "name", label: "¿Cómo te llamas?", placeholder: "Carlos" },
  { key: "trade", label: "¿Qué tipo de trabajo haces?", placeholder: "Jardinería y mantenimiento" },
  { key: "city", label: "¿En qué ciudad trabajas?", placeholder: "Los Ángeles, CA" },
] as const;

export function Onboarding() {
  const { setProfile } = useMarcelo();
  const [step, setStep] = useState(-1);
  const [values, setValues] = useState({ name: "", trade: "", city: "" });

  if (step === -1) {
    return (
      <div className="flex min-h-screen flex-col justify-between bg-background px-6 pb-10 pt-24 text-foreground">
        <div className="text-center">
          <div className="mx-auto flex size-24 items-center justify-center rounded-[2rem] bg-accent/10 text-accent shadow-[var(--shadow-card)]">
            <span className="text-[42px] font-bold">M</span>
          </div>
          <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.18em] text-accent">Marcelo</p>
          <h1 className="mt-3 text-[30px] font-bold leading-tight">Tu trabajo, más simple.</h1>
          <p className="mx-auto mt-3 max-w-[300px] text-[16px] leading-relaxed text-muted-foreground">
            Te ayudo a organizar tu negocio. Háblame en español y yo me encargo del resto.
          </p>
        </div>
        <Button
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => setStep(0)}
        >
          Empezar
        </Button>
      </div>
    );
  }

  const current = steps[step] ?? steps[0];
  const value = values[current.key];

  return (
    <div className="flex min-h-screen flex-col justify-between px-6 pb-10 pt-20">
      <div>
        <div className="mb-8 flex gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={i <= step ? "h-1 flex-1 rounded-full bg-accent" : "h-1 flex-1 rounded-full bg-border"}
            />
          ))}
        </div>
        <h1 className="mb-6 text-[24px] font-semibold leading-tight text-foreground">{current.label}</h1>
        <Field
          label=""
          autoFocus
          value={value}
          placeholder={current.placeholder}
          onChange={(e) => setValues({ ...values, [current.key]: e.target.value })}
        />
      </div>
      <Button
        className="w-full"
        disabled={!value.trim()}
        onClick={() => {
          if (step < steps.length - 1) setStep(step + 1);
          else setProfile({ ...values, onboarded: true });
        }}
      >
        {step < steps.length - 1 ? "Continuar" : "Entrar a Marcelo"}
      </Button>
    </div>
  );
}
