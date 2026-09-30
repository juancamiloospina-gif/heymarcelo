import { createFileRoute, redirect } from "@tanstack/react-router";

// "Más" was split: settings live under the avatar (Configuración), money under Dinero.
export const Route = createFileRoute("/mas")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracion" });
  },
});
