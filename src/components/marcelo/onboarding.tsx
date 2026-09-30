import { useState } from "react";
import { Database, Eye, ShieldCheck } from "lucide-react";
import { Button, Field } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";
import logo from "@/assets/marcelo-logo.png";

const trust = [
  {
    icon: Database,
    tone: "bg-accent/12 text-accent",
    title: "Qué guardo",
    body: "Tus clientes, trabajos y dinero. Solo en este teléfono.",
  },
  {
    icon: Eye,
    tone: "bg-sky/12 text-sky",
    title: "Quién lo ve",
    body: "Solo tú. Tus clientes solo ven los mensajes que les escribo.",
  },
  {
    icon: ShieldCheck,
    tone: "bg-success/12 text-success",
    title: "Qué nunca hago",
    body: "Cambiar tus precios, dar descuentos o borrar datos sin tu permiso.",
  },
];

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
      <div className="flex min-h-screen flex-col justify-between bg-background px-6 pb-10 pt-16 text-foreground">
        <div>
          <div className="text-center">
            <img src={logo} alt="Marcelo" className="mx-auto h-[80px] w-auto" />
            <h1 className="mt-8 text-[28px] font-bold leading-tight">Tu trabajo, más simple.</h1>
            <p className="mx-auto mt-3 max-w-[300px] text-[16px] leading-relaxed text-muted-foreground">
              Háblame en español. Yo le contesto a tus clientes en inglés.
            </p>
          </div>
          <div className="mt-8 space-y-3">
            {trust.map(({ icon: Icon, title, body, tone }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
                >
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-[16px] font-bold">{title}</p>
                  <p className="text-[15px] leading-snug text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
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
    <form
      className="flex min-h-screen flex-col justify-between px-6 pb-10 pt-20"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        if (step < steps.length - 1) setStep(step + 1);
        else setProfile({ ...values, onboarded: true });
      }}
    >
      <div>
        <div className="mb-8 flex gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={
                i <= step
                  ? "h-1 flex-1 rounded-full bg-accent"
                  : "h-1 flex-1 rounded-full bg-border"
              }
            />
          ))}
        </div>
        <h1 className="mb-6 text-[24px] font-semibold leading-tight text-foreground">
          {current.label}
        </h1>
        <Field
          label=""
          autoFocus
          value={value}
          placeholder={current.placeholder}
          onChange={(e) => setValues({ ...values, [current.key]: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full" disabled={!value.trim()}>
        {step < steps.length - 1 ? "Continuar" : "Entrar a Marcelo"}
      </Button>
    </form>
  );
}
