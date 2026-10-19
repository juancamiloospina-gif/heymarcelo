import { createFileRoute } from "@tanstack/react-router";
import { BackButton, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { PageEditor, PagePreview } from "@/components/marcelo/page-editor";
import { PublicPageCard } from "@/components/marcelo/public-page";
import { PushCard } from "@/components/marcelo/push-card";
import { cloudEnabled } from "@/lib/cloud";

export const Route = createFileRoute("/mi-pagina")({
  head: () => ({
    meta: [{ title: "Mi página — Marcelo" }],
    // Handwritten font used by the preview of the public page.
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap",
      },
    ],
  }),
  component: MiPagina,
});

function MiPagina() {
  return (
    <Screen>
      <BackButton />
      <PageTitle title="Mi página" subtitle="Lo que ven tus clientes cuando escanean tu QR." />
      {!cloudEnabled ? (
        <p className="text-[16px] text-muted-foreground">La página pública no está disponible.</p>
      ) : (
        <>
          <SectionTitle>Tu foto y tu historia</SectionTitle>
          <PageEditor />
          <SectionTitle>Cuenta y publicación</SectionTitle>
          <PublicPageCard />
          <div className="mt-3">
            <PushCard />
          </div>
          <SectionTitle>Así se ve</SectionTitle>
          <p className="mb-3 text-[14px] text-muted-foreground">
            Tus clientes la ven en inglés. Tu frase y tu historia se traducen solas cuando publicas.
          </p>
          <PagePreview />
        </>
      )}
    </Screen>
  );
}
