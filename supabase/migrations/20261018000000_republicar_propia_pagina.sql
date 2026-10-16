-- Arreglo: volver a publicar la propia página fallaba con "slug_taken".
-- La app guarda con un "insertar o actualizar" (upsert). El trigger BEFORE INSERT corre antes de
-- que Postgres detecte que la fila ya existe, y comparaba contra el id de la fila nueva (distinto),
-- así que el slug del propio dueño le parecía ocupado. Ahora se compara por dueño: el slug es de
-- otro si lo tiene (o lo tuvo) el perfil de otro usuario.

drop function if exists public.slug_is_free(text, uuid);

create function public.slug_is_free(p_slug text, p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
           select 1 from public.profiles where slug = p_slug and owner_id is distinct from p_owner)
     and not exists (
           select 1 from public.slug_history h
           join public.profiles p on p.id = h.profile_id
           where h.slug = p_slug and p.owner_id is distinct from p_owner);
$$;

revoke all on function public.slug_is_free(text, uuid) from public, anon, authenticated;

create or replace function public.check_slug_free() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.slug is distinct from old.slug)
     and not public.slug_is_free(new.slug, new.owner_id) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;
  return new;
end $$;
