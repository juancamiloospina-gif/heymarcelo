import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/documentos")({
  beforeLoad: () => {
    throw redirect({ to: "/dinero", search: { tab: "contador" } });
  },
});
