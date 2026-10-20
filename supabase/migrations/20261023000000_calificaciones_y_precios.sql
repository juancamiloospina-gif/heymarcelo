-- 1) Calificaciones: al terminar un trabajo el cliente recibe un enlace (/r/<token>) y califica
--    de 1 a 5 estrellas con un comentario opcional. La calificación queda ligada al trabajo y al
--    cliente de la app (job_ref / client_ref son los ids que la app guarda en el teléfono).
-- 2) Precio de cada servicio en la página pública (en vez de "Desde $"): service_items trae "price"
--    o "sizes"; get_public_profile los oculta junto con "from_price" cuando el dueño apaga los precios.
--
-- Seguridad: anon no toca la tabla; solo get_review_request / submit_review, que exigen el token
-- (uuid imposible de adivinar). Cada token se puede calificar una sola vez.

create table public.review_requests (
  token       uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  job_ref     text not null check (char_length(job_ref) between 1 and 40),
  client_ref  text not null default '' check (char_length(client_ref) <= 40),
  client_name text not null default '' check (char_length(client_name) <= 80),
  service     text not null default '' check (char_length(service) <= 80),
  job_date    date,
  rating      smallint check (rating between 1 and 5),
  comment     text not null default '' check (char_length(comment) <= 500),
  rated_at    timestamptz,
  created_at  timestamptz not null default now(),
  unique (owner_id, job_ref)
);

create index review_requests_owner_idx on public.review_requests (owner_id, rated_at desc);

alter table public.review_requests enable row level security;
revoke all on public.review_requests from anon;
grant select, delete on public.review_requests to authenticated;

create policy review_requests_owner_select on public.review_requests
  for select to authenticated using (owner_id = auth.uid());
create policy review_requests_owner_delete on public.review_requests
  for delete to authenticated using (owner_id = auth.uid());

-- El dueño pide el enlace de un trabajo. Si ya existe uno, devuelve el mismo token.
create or replace function public.create_review_request(
  p_job_ref text, p_client_ref text, p_client_name text, p_service text, p_job_date date
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  insert into public.review_requests (owner_id, job_ref, client_ref, client_name, service, job_date)
  values (auth.uid(), p_job_ref, coalesce(p_client_ref, ''), left(coalesce(p_client_name, ''), 80),
          left(coalesce(p_service, ''), 80), p_job_date)
  on conflict (owner_id, job_ref) do update set client_name = excluded.client_name
  returning token into v_token;
  return v_token;
end $$;

revoke all on function public.create_review_request(text, text, text, text, date) from public, anon;
grant execute on function public.create_review_request(text, text, text, text, date) to authenticated;

-- Lo que ve el cliente al abrir el enlace.
create or replace function public.get_review_request(p_token uuid)
returns table (
  business_name text, first_name text, photo_url text, client_first_name text,
  service text, rating smallint
)
language sql stable security definer set search_path = public as $$
  select coalesce(p.business_name, ''), coalesce(p.first_name, ''), coalesce(p.photo_url, ''),
         split_part(r.client_name, ' ', 1), r.service, r.rating
  from public.review_requests r
  left join public.profiles p on p.owner_id = r.owner_id
  where r.token = p_token;
$$;

grant execute on function public.get_review_request(uuid) to anon, authenticated;

-- La calificación del cliente. Devuelve false si el enlace ya se usó o no existe.
create or replace function public.submit_review(p_token uuid, p_rating int, p_comment text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;
  update public.review_requests
     set rating = p_rating, comment = left(btrim(coalesce(p_comment, '')), 500), rated_at = now()
   where token = p_token and rated_at is null;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;

grant execute on function public.submit_review(uuid, int, text) to anon, authenticated;

-- Precios por tamaño: service_items puede traer "sizes" ({"chico":90,"mediano":120,"grande":180}).
create or replace function public.get_public_profile(p_slug text)
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
              else (select coalesce(jsonb_agg(i - 'from_price' - 'price' - 'sizes'), '[]'::jsonb)
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
