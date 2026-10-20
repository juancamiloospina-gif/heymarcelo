/** The data the public page draws, from the server (live page) or from the phone (preview). */
import type { CloudProfile } from "./cloud";
import type { Lang } from "./public-i18n";
import type { PublicProfile } from "./public-profile";
import { readAreaGeo, type AreaPoint } from "./service-area";

export type ViewProfile = {
  businessName: string;
  tradeEn: string;
  city: string;
  serviceArea: string;
  photoUrl: string;
  tagline: string;
  bio: string;
  traits: string[];
  services: {
    name: string;
    kind: string;
    price?: number | undefined;
    sizes?: { chico: number; mediano: number; grande: number } | undefined;
  }[];
  phone: string;
  gallery: string[];
  areaCenterZip: string;
  areaRadiusMi: number;
  areaZips: string[];
  areaGeo: { center: [number, number] | null; points: AreaPoint[] };
};

/** Picks the English text of tagline/bio when it exists (translated on publish); else the original. */
export function viewFromCloud(c: CloudProfile, lang: Lang): ViewProfile {
  const items = c.service_items.length
    ? c.service_items.map((i) => ({
        name: i.name,
        kind: i.kind,
        price: i.price ?? i.from_price,
        sizes: i.sizes,
      }))
    : c.services.map((name) => ({ name, kind: "general", price: undefined, sizes: undefined }));
  return {
    businessName: c.business_name,
    tradeEn: c.trade_en,
    city: c.city,
    serviceArea: c.service_area,
    photoUrl: c.photo_url,
    tagline: (lang === "en" && c.tagline_en) || c.tagline,
    bio: (lang === "en" && c.bio_en) || c.bio,
    traits: c.traits,
    services: items,
    phone: c.show_phone ? c.phone : "",
    gallery: c.gallery ?? [],
    areaCenterZip: c.area_center_zip ?? "",
    areaRadiusMi: c.area_radius_mi ?? 0,
    areaZips: c.service_zips ?? [],
    areaGeo: readAreaGeo(c.area_geo),
  };
}

/** For the preview: what the page will show once published, from the data on the phone. */
export function viewFromPublic(p: PublicProfile): ViewProfile {
  return {
    businessName: p.businessName,
    tradeEn: p.tradeEn,
    city: p.city,
    serviceArea: p.serviceArea,
    photoUrl: p.photoUrl,
    tagline: p.taglineEn || p.tagline,
    bio: p.bioEn || p.bio,
    traits: p.traits,
    services: p.serviceItems.map((i) => ({
      name: i.name,
      kind: i.kind,
      price: p.showPrices ? i.price : undefined,
      sizes: p.showPrices ? i.sizes : undefined,
    })),
    phone: p.showPhone ? p.phone : "",
    gallery: p.gallery,
    areaCenterZip: p.areaCenterZip,
    areaRadiusMi: p.areaRadiusMi,
    areaZips: p.areaZips,
    areaGeo: readAreaGeo(p.areaGeo),
  };
}
