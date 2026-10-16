-- Borrar la cuenta desde la app (requisito de Apple para apps con cuentas).
-- El usuario solo puede borrarse a sí mismo. Al borrar auth.users se van en cascada su
-- perfil, el historial de slugs y las solicitudes de cotización que recibió.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
