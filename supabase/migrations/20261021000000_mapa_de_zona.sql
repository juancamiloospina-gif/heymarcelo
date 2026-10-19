-- Mapa de la zona de trabajo: la página guarda las coordenadas del centro y de cada código postal
-- cubierto, así el cliente no tiene que descargar la tabla completa de códigos (716 KB).
-- area_geo = {"center":[lat,lon], "points":[["91101",34.147,-118.139], ...]}  (máx. 250 puntos)

alter table public.profiles
  add column area_geo jsonb not null default '{}'::jsonb
    check (jsonb_typeof(area_geo) = 'object' and char_length(area_geo::text) <= 12000);

drop function if exists public.get_public_profile(text);

create function public.get_public_profile(p_slug text)
returns table (
  slug text, business_name text, first_name text, trade_en text, city text,
  service_area text, services text[], phone text, show_phone boolean,
  photo_url text, tagline text, tagline_en text, bio text, bio_en text,
  traits text[], show_prices boolean, service_items jsonb, gallery text[],
  area_center_zip text, area_radius_mi integer, service_zips text[], area_geo jsonb
)
language sql stable security definer set search_path = public as $$
  select p.slug, p.business_name, p.first_name, p.trade_en, p.city, p.service_area, p.services,
         case when p.show_phone then p.phone else '' end,
         p.show_phone,
         p.photo_url, p.tagline, p.tagline_en, p.bio, p.bio_en, p.traits, p.show_prices,
         case when p.show_prices then p.service_items
              else (select coalesce(jsonb_agg(i - 'from_price'), '[]'::jsonb)
                    from jsonb_array_elements(p.service_items) i) end,
         p.gallery,
         p.area_center_zip, p.area_radius_mi, p.service_zips, p.area_geo
  from public.profiles p
  where p.active
    and (p.slug = lower(p_slug)
         or p.id = (select h.profile_id from public.slug_history h where h.slug = lower(p_slug)))
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
