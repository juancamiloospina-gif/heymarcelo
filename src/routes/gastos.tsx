import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/gastos")({
  beforeLoad: () => {
    throw redirect({ to: "/dinero", search: { tab: "gastos" } });
  },
});
