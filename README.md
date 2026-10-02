# FlashReto — Backend y PostgreSQL

API independiente de Node y TypeScript para FlashReto. Este repositorio contiene usuarios, contraseñas, permisos, bibliotecas de preguntas, exámenes, partidas WebSocket y las migraciones y configuración de PostgreSQL. El frontend vive en [TFM-UNIR](https://github.com/kevintoasa42-oss/TFM-UNIR). Este proyecto compila y funciona sin clonar el frontend y sin una carpeta `shared`.

Con Docker Desktop abierto, ejecuta:

```bash
bash iniciar.sh
```

Se levantan `backend` y `db`. La API queda normalmente en `http://localhost:4000/api/health`. Para levantar también React, ejecuta `bash iniciar.sh` desde el repositorio del frontend: su Compose incluye esta configuración y agrega un tercer contenedor. El backend sirve API y WebSocket; la ruta `/` responde 404 y no sirve HTML de React.

El script genera una contraseña aleatoria de PostgreSQL en `.env.docker`. Guarda ese archivo y el volumen `postgres-data`. Las migraciones se aplican antes de aceptar solicitudes y su checksum impide cambiar una migración ya aplicada. La migración inicial y el volumen de la instalación anterior se conservan.

## Desarrollo independiente

Usa Node 24 o posterior con NVM. Configura `.env` a partir de `.env.example`, con la URL de tu PostgreSQL, y ejecuta:

```bash
npm ci
npm run dev
```

Para compilar y ejecutar:

```bash
npm run build
npm start
```

El Dockerfile de aquí construye solo la API y copia solo sus migraciones. No lee archivos del frontend. El servidor valida el JSON y la sesión de cada solicitud. El frontend conecta su proxy a esta API con `API_UPSTREAM`; HTTP y WebSocket conservan el mismo origen público y la cookie `HttpOnly`. `TRUST_PROXY=true` permite reconocer HTTPS detrás del proxy configurado.

## Estructura y recorrido

```text
src/node-server.ts          Inicio de HTTP, PostgreSQL y WebSocket
src/routes/api.routes.ts   Mapa de métodos, rutas y permisos
src/controllers/           Validación HTTP y respuestas
src/services/              Casos de uso de cuentas, contenido y salas
src/domain/                Modelos propios, validación y reglas de partida
src/persistence.ts         Contratos de acceso a datos
src/adapters/              PostgreSQL y aplicación de migraciones
src/middleware/            Sesión y rol
src/security/              Derivación y comprobación de contraseñas
src/room-socket.ts         Mensajes y sincronización de conexiones
src/http/                  Adaptación HTTP y cookies
db/postgres/               Migraciones SQL
test/                      Pruebas de reglas, API, multijugador y persistencia
Dockerfile                 Imagen del backend
compose.yaml               Backend y PostgreSQL
```

Una solicitud entra al mapa de rutas, pasa la comprobación de sesión y permisos, llega al controlador y llama al servicio correspondiente. El servicio usa los contratos de persistencia y el adaptador PostgreSQL realiza consultas parametrizadas. Las reglas de partida están en el servidor: 20 segundos, una respuesta por ronda y 100 puntos por acierto. Las actualizaciones con revisión evitan duplicar puntos entre conexiones simultáneas. La solución queda oculta hasta cerrar la pregunta.

Las cuentas eligen `admin` o `user` al registrarse. El servidor valida y guarda ese rol. Administrador puede crear contenido y salas y gestionar roles; Usuario puede unirse a las partidas. Las contraseñas se guardan con PBKDF2-SHA256 y sal individual. Los hashes antiguos siguen funcionando. Las sesiones y los datos permanecen en PostgreSQL al recrear los contenedores.

## API

| Método y ruta | Acceso y uso |
| --- | --- |
| `POST /api/register` | Público; nombre, correo, contraseña y rol |
| `POST /api/login`, `POST /api/logout`, `GET /api/me` | Sesión |
| `GET /api/content` | Sesión; biblioteca propia |
| `PUT /api/content` | Administrador; contenido y revisión |
| `GET /api/users`, `PATCH /api/users/:id` | Administrador; listado y cambio de rol |
| `POST /api/rooms` | Administrador; sala desde un examen |
| `POST /api/rooms/:code/join` | Sesión; unirse a una sala |
| `GET /api/rooms/:code/ws` | Sesión y pertenencia; conexión WebSocket |
| `GET /api/health` | Público; estado de PostgreSQL |

El registro recibe `{ "name": "Ana", "email": "ana@example.test", "password": "Tu contraseña", "role": "admin" }`. El rol solo puede ser `admin` o `user`. Devuelve `{ "user": { "id", "name", "email", "role" } }` y una cookie de sesión; no devuelve el hash de la contraseña. Un error devuelve `{ "error": "mensaje" }` con su estado HTTP.

Por WebSocket el cliente envía `start`, `answer` con `answer` entre 0 y 3, `next` o `sync` en el campo `type`. El servidor envía `{ "type": "state", "room": ... }` o `{ "type": "error", "message": ... }`. El estado incluye fase, pregunta visible, plazo `endsAt`, hora del servidor `serverNow` y jugadores con sus puntuaciones; se adapta al usuario que recibe el mensaje. El navegador calcula el tiempo restante con `endsAt - serverNow` y utiliza un reloj monotónico para descontarlo, evitando que el reloj de la PC agregue o quite segundos a la ronda.

## Pruebas

```bash
npm test
npm run build
```

Para ejecutar el recorrido HTTP/WebSocket contra una **base de prueba** iniciada en el puerto 4000:

```bash
npm run test:integration
```

Puedes indicar otra API con `FLASHRETO_URL`. Estas pruebas crean cuentas con correos `example.test`, editan su contenido y juegan hasta los resultados. Las pruebas del sistema completo se ejecutan desde el frontend con `npm run test:system`; usan un volumen y puertos desechables y comprueban la reconexión y persistencia al recrear los tres contenedores. No deben ejecutarse contra una instalación con datos personales.
