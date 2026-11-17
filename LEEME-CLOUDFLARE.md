# Going Merry — Cloudflare Pages

Esta adaptación conserva el diseño, los usuarios existentes y el panel para crear,
editar, listar y eliminar usuarios. Los cambios siguen siendo commits en el bloque
`const USERS` de `script.js` en GitHub. No utiliza D1 ni otra base de datos.

## 1. Actualizar GitHub

Descomprime este ZIP. Sube el CONTENIDO de going-merry-main a la raíz del repositorio
virtualformacion/going-merry (no subas la carpeta como una subcarpeta ni el ZIP).
Reemplaza los archivos existentes. Elimina del repositorio las carpetas antiguas
node_modules y netlify y los archivos netlify.toml y package-lock.json.
No subas claves ni archivos .env o .dev.vars. La carpeta functions debe quedar en
la raíz junto a package.json. lib contiene código del servidor: no lo muevas a dist.

## 2. Conectar Cloudflare Pages a GitHub

Usa un proyecto de **Pages con integración Git**, no un Worker con otro formato
ni una carga manual del ZIP por el panel. Si el proyecto actual es de Workers,
crea un proyecto Pages para esta versión.

Selecciona el repositorio y configura:

| Campo | Valor |
|---|---|
| Rama de producción | main |
| Framework | None / ninguno |
| Directorio raíz | raíz del repositorio (vacío) |
| Build command | npm run build |
| Build output directory | dist |

Activa los despliegues automáticos de producción de main. No necesitas flags de
compatibilidad Node.js: el backend usa fetch, TextEncoder y TextDecoder.
El build copia solo los archivos públicos a dist. Cloudflare compila functions
por separado desde la raíz del repositorio.

## 3. Variables y secretos de producción

En la configuración de Variables y secretos de tu proyecto Pages:

| Nombre | Valor |
|---|---|
| GMAIL_CLIENT_ID | tu ID real de Google |
| GMAIL_CLIENT_SECRET | tu secreto real de Google |
| GMAIL_REFRESH_TOKEN | tu refresh token real de Google |
| GITHUB_TOKEN | token real con permiso Contents: Read and write sobre el repositorio |
| GITHUB_REPO | virtualformacion/going-merry |
| GITHUB_FILE_PATH | script.js |
| GITHUB_BRANCH | main |

Guarda GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN y GITHUB_TOKEN como
secretos. No necesitas enviarlos a quien te ayuda con el código.
Después de configurar o cambiar variables, vuelve a desplegar.
Se conserva el administrador original, su contraseña y su fecha de vencimiento
en FIXED_ADMIN dentro de functions/api/updateusers.js, como en el proyecto original.
Los usuarios normales y sus contraseñas se conservan tal como están en script.js.

También se aceptan los nombres antiguos REPO_OWNER, REPO_NAME, FILE_PATH y BRANCH,
pero las variables GITHUB_* de la tabla tienen prioridad. Evita configurar ambos
juegos con valores distintos. Si usas otro repositorio, este debe contener el
script.js que carga tu página y tener conectado el despliegue de Cloudflare.

## 4. Comprobar en tu cuenta

1. Espera un despliegue correcto después de guardar las variables.
2. Abre /admin.html y entra con el mismo usuario y contraseña de administrador de tu proyecto original.
3. Crea un usuario de prueba con vencimiento futuro.
4. Comprueba el commit que modifica script.js en GitHub.
5. Espera a que Cloudflare publique ese commit. Abre o recarga la página principal
   y entra con el usuario nuevo. Edita y elimina el usuario para verificar el ciclo.
6. Prueba Gmail con un correo reciente que esté autorizado para tu usuario.

El panel lista los datos directamente desde GitHub, pero el acceso de usuarios
usa el script.js publicado. Por eso verás los cambios en el panel antes de que
el despliegue termine. Una pestaña ya abierta necesita recargarse.
Cada cambio sigue consumiendo un build de Pages: conserva el comportamiento del
proyecto original y queda sujeto a los límites gratuitos de Cloudflare y Google.
Si dos administradores guardan simultáneamente, GitHub puede rechazar un commit
por conflicto: vuelve a listar los usuarios y repite el cambio.

## Cambios técnicos y alcance

- /api/getLastEmail y /api/updateusers reemplazan las rutas de Netlify.
- Gmail usa renovación OAuth y API REST; no requiere googleapis ni dotenv.
- La búsqueda conserva la ventana de 10 minutos, filtra en Gmail por destinatario
  y fecha y examina hasta 25 coincidencias recientes (antes hasta 110 sin filtro).
  Este límite acota las llamadas externas para Workers Free. Si un destinatario
  recibe más de 25 correos en 10 minutos, un resultado más antiguo podría no verse.
- Se conservan asuntos y enlaces admitidos; se leen cuerpos MIME anidados.
- El archivo USERS se analiza como datos sin eval ni new Function. Conserva el
  formato generado por el panel: cadenas con comillas dobles, objetos, arrays y
  new Date("YYYY-MM-DD"). No añadas expresiones JavaScript arbitrarias al bloque.
- El enlace al panel ahora es relativo al dominio de Cloudflare.
- Las respuestas API y script.js no se guardan en caché del navegador.

## Limitaciones de seguridad conservadas

Por solicitud se mantiene la lista de usuarios y contraseñas en el JavaScript
público y la validación de acceso/correos en el navegador. No constituye una
autenticación segura: quien descargue script.js puede ver esos datos, y el endpoint
Gmail no exige una sesión del servidor. No publiques la versión asumiendo que
protege los códigos de acceso frente a terceros. La contraseña administrativa
también permanece en el código del repositorio, por solicitud. Endurecer el acceso de usuarios requiere un cambio
adicional al flujo conservado; no se hizo silenciosamente en esta adaptación.

## Validación realizada

Ejecuta npm test y npm run build. Las pruebas usan respuestas simuladas de Google
y GitHub y comprueban CRUD, autorización del administrador, conflictos, Unicode,
lectura de usuarios y búsqueda Gmail. No se usaron credenciales reales ni se
modificó GitHub. La conexión OAuth y el despliegue final deben validarse en tu cuenta.

Documentación oficial:
https://developers.cloudflare.com/pages/functions/get-started/
https://developers.cloudflare.com/pages/configuration/build-configuration/
https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/

## Disponibilidad

Las funciones se ejecutan cuando la página recibe una solicitud; no necesitan
un servidor encendido ni un cron para mantenerse activas. El plan gratuito no
garantiza disponibilidad 24/7: tiene cuotas de solicitudes, CPU y builds, y puede
haber interrupciones. El vencimiento del administrador original se conserva;
después de esa fecha no permitirá administrar hasta que la cambies en el código.
