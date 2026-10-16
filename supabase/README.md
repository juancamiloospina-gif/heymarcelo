# Supabase (perfil público)

Base de datos propia del proyecto. Hoy solo guarda lo que ve el cliente: el perfil público
(`/p/<slug>`) y las solicitudes de cotización. Todo lo demás sigue en el teléfono.

## Conectar

1. Crear un proyecto en https://supabase.com (región cercana a EE. UU.).
2. SQL Editor → ejecutar en orden `migrations/20261016000000_perfil_publico.sql` `migrations/20261016010000_borrar_cuenta.sql` y `migrations/20261017000000_pagina_humana.sql`.
3. Authentication → Providers → Email: activado (código por email). Desactivar "Confirm email" si se quiere entrar solo con el código.
4. Project Settings → API: copiar **Project URL** y la clave **anon (public)**.
5. En Lovable (o `.env.local`) definir:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

**Nunca** poner la clave `service_role` en el código, en el repo ni en chats: se salta todos los permisos.

## Reglas del esquema

- El navegador (anon) no lee las tablas: usa `get_public_profile(slug)` y `submit_quote_request(...)`.
- El teléfono solo sale si el dueño marcó `show_phone`.
- Un slug usado nunca se reasigna a otra persona; el viejo redirige al nuevo.
- Borrar la cuenta (`auth.users`) borra perfil, historial y solicitudes (requisito de Apple).
- Cambios de esquema: migraciones nuevas en esta carpeta, nunca editar la ya aplicada.
