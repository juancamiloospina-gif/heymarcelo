-- Zona de trabajo delimitada: ZIP central + radio, con la lista final de ZIP que cubre.
-- La lista se calcula en la app (tabla pública del Censo, aproximada: punto central de cada ZIP).
-- Con ella la página responde "¿Cubre mi zona?" y la solicitud de cotización se marca si el
-- ZIP del cliente queda fuera (aviso, no bloqueo).

alter table public.profiles
  add column area_center_zip text    not null default '' check (area_center_zip ~ '^([0-9]{5})?$'),
  add column area_radius_mi  integer not null default 0  check (area_radius_mi between 0 and 100),
  add column service_zips    text[]  not null default '{}'
    check (
      cardinality(service_zips) <= 250
      and array_to_string(service_zips, ',') ~ '^([0-9]{5}(,[0-9]{5})*)?$'
    );

alter table public.quote_requests
  add column outside_area boolean not null default false;

drop function if exists public.get_public_profile(text);

create function public.get_public_profile(p_slug text)
returns table (
  slug text, business_name text, first_name text, trade_en text, city text,
  service_area text, services text[], phone text, show_phone boolean,
  photo_url text, tagline text, tagline_en text, bio text, bio_en text,
  traits text[], show_prices boolean, service_items jsonb, gallery text[],
  area_center_zip text, area_radius_mi integer, service_zips text[]
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
         p.area_center_zip, p.area_radius_mi, p.service_zips
  from public.profiles p
  where p.active
    and (p.slug = lower(p_slug)
         or p.id = (select h.profile_id from public.slug_history h where h.slug = lower(p_slug)))
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;

-- Misma función de siempre (mismos límites contra spam) + marca si el ZIP queda fuera de la zona.
create or replace function public.submit_quote_request(
  p_slug text, p_name text, p_phone text, p_zip text default '',
  p_service text default '', p_description text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_zips    text[];
  v_zip     text := btrim(coalesce(p_zip, ''));
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_outside boolean := false;
  v_id      uuid;
begin
  select p.id, p.service_zips into v_profile, v_zips from public.profiles p
  where p.active and (p.slug = lower(p_slug)
        or p.id = (select h.profile_id from public.slug_history h where h.slug = lower(p_slug)))
  limit 1;
  if v_profile is null then raise exception 'profile_not_found' using errcode = 'P0002'; end if;

  if (select count(*) from public.quote_requests
      where profile_id = v_profile and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.quote_requests
      where profile_id = v_profile and phone = v_phone
        and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  -- Fuera de zona solo si el trabajador definió una zona y el cliente dio un ZIP completo.
  if cardinality(v_zips) > 0 and v_zip ~ '^[0-9]{5}$' and not (v_zip = any (v_zips)) then
    v_outside := true;
  end if;

  insert into public.quote_requests (profile_id, name, phone, zip, service, description, outside_area)
  values (v_profile, btrim(coalesce(p_name, '')), v_phone, v_zip,
          btrim(coalesce(p_service, '')), btrim(coalesce(p_description, '')), v_outside)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.submit_quote_request(text, text, text, text, text, text)
  to anon, authenticated;
