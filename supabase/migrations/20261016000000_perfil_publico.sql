-- Perfil público de Marcelo: la página /p/<slug> y las solicitudes de cotización.
--
-- Diseño:
--  * La app sigue guardando todo en el teléfono. Aquí solo vive lo que ve el cliente.
--  * Los datos del perfil no se leen directo con anon: se leen por get_public_profile(),
--    que oculta el teléfono si el dueño no quiere mostrarlo.
--  * Las solicitudes entran solo por submit_quote_request(), que valida y limita el spam.
--  * Si el usuario borra su cuenta (auth.users), se borra todo lo suyo (requisito de Apple).
--  * SQL estándar de Postgres/Supabase: sin nada exclusivo de Lovable, para poder moverlo.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references auth.users (id) on delete cascade,
  slug          text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  active        boolean not null default true,
  business_name text not null check (char_length(business_name) between 1 and 80),
  first_name    text not null default '' check (char_length(first_name) <= 40),
  trade_en      text not null default '' check (char_length(trade_en) <= 60),
  city          text not null default '' check (char_length(city) <= 80),
  service_area  text not null default '' check (char_length(service_area) <= 300),
  services      text[] not null default '{}' check (cardinality(services) <= 12),
  phone         text not null default '' check (phone ~ '^[0-9]{0,15}$'),
  show_phone    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------ slug_history
-- Un QR impreso nunca debe dejar de funcionar: el slug viejo sigue apuntando al perfil.
create table public.slug_history (
  slug       text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.remember_old_slug() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.slug_history (slug, profile_id) values (old.slug, old.id)
    on conflict (slug) do nothing;
  end if;
  return new;
end $$;

create trigger profiles_remember_slug after update of slug on public.profiles
  for each row execute function public.remember_old_slug();

-- Un slug nuevo no puede ser uno que ya usó otro perfil.
create or replace function public.slug_is_free(p_slug text, p_profile uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where slug = p_slug and id is distinct from p_profile)
     and not exists (select 1 from public.slug_history where slug = p_slug
                     and profile_id is distinct from p_profile);
$$;

create or replace function public.check_slug_free() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.slug is distinct from old.slug)
     and not public.slug_is_free(new.slug, new.id) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;
  return new;
end $$;

create trigger profiles_check_slug before insert or update of slug on public.profiles
  for each row execute function public.check_slug_free();

-- ---------------------------------------------------------- quote_requests
create table public.quote_requests (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  phone       text not null check (phone ~ '^[0-9]{7,15}$'),
  zip         text not null default '' check (zip ~ '^[0-9]{0,5}$'),
  service     text not null default '' check (char_length(service) <= 80),
  description text not null default '' check (char_length(description) <= 1000),
  status      text not null default 'new' check (status in ('new', 'imported', 'dismissed')),
  created_at  timestamptz not null default now()
);

create index quote_requests_profile_idx on public.quote_requests (profile_id, created_at desc);

-- ------------------------------------------------------------ RLS (dueño)
alter table public.profiles       enable row level security;
alter table public.slug_history   enable row level security;
alter table public.quote_requests enable row level security;

create policy profiles_owner_select on public.profiles
  for select to authenticated using (owner_id = auth.uid());
create policy profiles_owner_insert on public.profiles
  for insert to authenticated with check (owner_id = auth.uid());
create policy profiles_owner_update on public.profiles
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy profiles_owner_delete on public.profiles
  for delete to authenticated using (owner_id = auth.uid());

create policy slug_history_owner_select on public.slug_history
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));

create policy quote_requests_owner_select on public.quote_requests
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));
create policy quote_requests_owner_update on public.quote_requests
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));

-- anon no toca las tablas: solo las funciones de abajo.
revoke all on public.profiles, public.slug_history, public.quote_requests from anon;
revoke all on function public.slug_is_free(text, uuid) from public, anon, authenticated;

-- -------------------------------------------------- lectura pública del perfil
-- Devuelve el perfil activo por slug (o por uno viejo, con el slug vigente para redirigir).
-- El teléfono solo sale si el dueño marcó show_phone.
create or replace function public.get_public_profile(p_slug text)
returns table (
  slug text, business_name text, first_name text, trade_en text, city text,
  service_area text, services text[], phone text, show_phone boolean
)
language sql stable security definer set search_path = public as $$
  select p.slug, p.business_name, p.first_name, p.trade_en, p.city, p.service_area, p.services,
         case when p.show_phone then p.phone else '' end,
         p.show_phone
  from public.profiles p
  where p.active
    and (p.slug = lower(p_slug)
         or p.id = (select h.profile_id from public.slug_history h where h.slug = lower(p_slug)))
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ------------------------------------------------ solicitud de cotización
-- Única puerta de entrada pública. Límites: 20 solicitudes por hora por perfil y 3 por hora
-- por teléfono de cliente. Otros filtros (honeypot, Turnstile) van en el servidor web.
create or replace function public.submit_quote_request(
  p_slug text, p_name text, p_phone text, p_zip text default '',
  p_service text default '', p_description text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_id      uuid;
begin
  select p.id into v_profile from public.profiles p
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

  insert into public.quote_requests (profile_id, name, phone, zip, service, description)
  values (v_profile, btrim(coalesce(p_name, '')), v_phone, btrim(coalesce(p_zip, '')),
          btrim(coalesce(p_service, '')), btrim(coalesce(p_description, '')))
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.submit_quote_request(text, text, text, text, text, text)
  to anon, authenticated;
