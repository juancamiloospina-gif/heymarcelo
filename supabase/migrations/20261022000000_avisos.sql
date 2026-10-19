-- Avisos en el teléfono (Web Push) cuando llega una solicitud de cotización.
--
-- Flujo: alguien envía una solicitud -> el trigger llama a la función `notify-quote` (Edge
-- Function) con el id -> la función manda la notificación a los teléfonos donde el dueño activó
-- los avisos. La función lee todo de la base de datos (no confía en lo que recibe) y marca la
-- solicitud con notified_at, así un mismo id nunca avisa dos veces.

-- --------------------------------------------------- teléfonos que reciben avisos
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh     text not null check (char_length(p256dh) between 20 and 200),
  auth       text not null check (char_length(auth) between 8 and 100),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

alter table public.push_subscriptions enable row level security;

create policy push_subs_owner_select on public.push_subscriptions
  for select to authenticated using (owner_id = auth.uid());
create policy push_subs_owner_insert on public.push_subscriptions
  for insert to authenticated with check (owner_id = auth.uid());
create policy push_subs_owner_update on public.push_subscriptions
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy push_subs_owner_delete on public.push_subscriptions
  for delete to authenticated using (owner_id = auth.uid());

revoke all on public.push_subscriptions from anon;

-- ------------------------------------------- llaves del servicio de avisos (VAPID)
-- Las crea la función la primera vez. Nadie del público ni de la app las puede leer: solo la
-- función, con la llave de servicio.
create table public.push_config (
  id          integer primary key check (id = 1),
  public_key  text not null,
  private_key text not null,
  created_at  timestamptz not null default now()
);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- ------------------------------------------------------ una solicitud avisa una vez
alter table public.quote_requests add column notified_at timestamptz;
