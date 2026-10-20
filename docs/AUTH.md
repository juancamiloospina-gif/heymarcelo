# Cuenta obligatoria y métodos de entrada

El primer paso del registro ("¿Cómo te llamas?") exige una cuenta: **Google, Apple, Microsoft (Outlook / Office) o un código por correo**. Sin cuenta no se puede continuar (si la app corre sin las variables de Supabase, el paso se omite para no bloquear pruebas locales).

- **Correo con código:** funciona hoy (Supabase Auth + SMTP de la empresa).
- **Google, Apple, Microsoft:** el código ya está; **hay que activarlos en Supabase** (Authentication → Sign In / Providers). Hasta entonces el botón sale gris con "(pronto)": la app lee qué métodos están activos en `GET /auth/v1/settings`.

## Activar cada método (lo hace el dueño del proyecto)

URL de retorno que Supabase muestra en cada proveedor: `https://myhnfwurbsujbvxqvprh.supabase.co/auth/v1/callback`.
Además, en Authentication → URL Configuration, agregar la dirección de la app publicada a **Redirect URLs** (la misma que el *Site URL*).

1. **Google:** console.cloud.google.com → APIs y servicios → Credenciales → ID de cliente OAuth (aplicación web) con esa URL como "URI de redireccionamiento autorizado" → copiar *Client ID* y *Client secret* a Supabase → Google.
2. **Microsoft (Supabase lo llama "Azure"):** portal.azure.com → Microsoft Entra ID → Registros de aplicaciones → Nuevo registro, tipos de cuenta "cualquier directorio y cuentas personales"; URI de redirección web = la de arriba; crear un secreto de cliente → *Application (client) ID*, secreto y URL de tenant `https://login.microsoftonline.com/common` en Supabase → Azure.
3. **Apple:** requiere cuenta de Apple Developer (de pago). Crear un *App ID* y un *Services ID* con "Sign in with Apple" (dominio = el de Supabase, return URL = la de arriba), crear una *Key* (.p8) y generar el *client secret* (JWT firmado con esa llave). **Ese secreto caduca a los 6 meses**: hay que renovarlo. Pegar *Services ID* y el secreto en Supabase → Apple. Importante para la App Store: si la app ofrece Google o Microsoft, Apple exige ofrecer también "Sign in with Apple".

## Cómo se comporta
- Al volver de Google/Apple/Microsoft la app recupera el nombre escrito (`localStorage: marcelo.onboardingDraft`) y, si el proveedor lo da, lo sugiere.
- Cambiar de cuenta cierra la sesión (y los avisos de ese teléfono).
- Las cuentas ya registradas antes de este cambio no se bloquean: la cuenta se exige al registrarse.
