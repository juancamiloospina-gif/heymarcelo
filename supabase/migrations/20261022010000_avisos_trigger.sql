-- Al llegar una solicitud, llama a la función que manda el aviso. Es asíncrono y nunca puede
-- hacer fallar el envío de la solicitud: si algo sale mal, la solicitud se guarda igual.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_quote() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(
      url     := 'https://myhnfwurbsujbvxqvprh.supabase.co/functions/v1/notify-quote',
      -- La función exige acceso: se le manda la llave pública (anon) del proyecto, la misma de .env.
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15aG5md3VyYnN1amJ2eHF2cHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzg0NDgsImV4cCI6MjEwNzcxNDQ0OH0.M07ceu-QW9873h7ggatTnG6Z2v2TGDfn47AoPQbgaP8',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15aG5md3VyYnN1amJ2eHF2cHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzg0NDgsImV4cCI6MjEwNzcxNDQ0OH0.M07ceu-QW9873h7ggatTnG6Z2v2TGDfn47AoPQbgaP8'
      ),
      body    := jsonb_build_object('id', new.id)
    );
  exception when others then
    null; -- el aviso es un extra: jamás debe romper la solicitud
  end;
  return new;
end $$;

revoke all on function public.notify_new_quote() from public, anon, authenticated;

create trigger quote_requests_notify after insert on public.quote_requests
  for each row execute function public.notify_new_quote();
