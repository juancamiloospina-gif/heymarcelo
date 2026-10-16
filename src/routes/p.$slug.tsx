import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { fetchPublicProfile } from "@/lib/cloud";
import { T, type Lang } from "@/lib/public-i18n";
import { PublicProfileView } from "@/components/marcelo/public-profile-view";
import { viewFromCloud } from "@/lib/public-view";
import { QuoteForm } from "@/components/marcelo/quote-form";

/**
 * Public page of one worker, opened from a QR or link. Written for the client (English first,
 * Spanish on request). It does not use the app shell or any local data: it only reads the
 * profile the worker published and sends quote requests back to them.
 */
export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const profile = await fetchPublicProfile(params.slug).catch(() => null);
    // An old slug (a printed QR) keeps working: it lands on the current address.
    if (profile && profile.slug !== params.slug) {
      throw redirect({ to: "/p/$slug", params: { slug: profile.slug }, replace: true });
    }
    return { profile };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.profile;
    const title = p
      ? `${p.business_name}${p.trade_en ? ` · ${p.trade_en}` : ""}`
      : "Page not found";
    const description = p
      ? `Get a free quote from ${p.business_name}${p.city ? ` in ${p.city}` : ""}.`
      : "This page is not available.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(p?.photo_url ? [{ property: "og:image", content: p.photo_url }] : []),
        ...(p ? [] : [{ name: "robots", content: "noindex" }]),
      ],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap",
        },
      ],
    };
  },
  component: PublicPage,
});

function PublicPage() {
  const { profile } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];

  if (!profile) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-[#f6f3ee] px-5 pt-16 text-center text-[#16263a]">
        <h1 className="text-[22px] font-bold">{t.notFound}</h1>
        <p className="mt-2 text-[16px] text-[#4b5b70]">{t.notFoundHint}</p>
      </div>
    );
  }

  const view = viewFromCloud(profile, lang);
  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <PublicProfileView profile={view} lang={lang} onLang={setLang}>
        <QuoteForm
          slug={slug}
          businessName={view.businessName}
          services={view.services.map((s) => s.name)}
          lang={lang}
        />
      </PublicProfileView>
    </div>
  );
}
