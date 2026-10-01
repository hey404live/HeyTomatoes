# HeyTomatoes

Aplicación web de catálogo de películas con API en Node.js/TypeScript, PostgreSQL y una interfaz HTML en español.

## Requisitos

- Node.js 20 o posterior
- Docker Desktop (o una instancia PostgreSQL disponible)

## Iniciar en local

1. Copia `.env.example` a `.env` y cambia `ADMIN_API_KEY` por una clave secreta larga.
2. Inicia PostgreSQL con `docker compose up -d db`.
3. Instala dependencias con `npm install`.
4. Crea las tablas con `npm run db:init` (el contenedor también las crea al inicializar un volumen nuevo).
5. Inicia el servidor con `npm run dev` y abre <http://localhost:3000>.

## API

Las rutas de catálogo y reseñas son públicas. Las rutas `/api/admin/*` requieren la cabecera `x-admin-key` con el valor de `ADMIN_API_KEY`.

El panel web para administrar películas está disponible en `/admin`. Introduce allí `ADMIN_API_KEY` para listar, crear, editar y eliminar películas desde el navegador. La clave se conserva solo en la sesión de esa pestaña.

| Método | Ruta | Acceso | Acción |
|---|---|---|---|
| GET | `/api/movies` | Público | Catálogo con promedio y número de reseñas |
| GET | `/api/movies/:id` | Público | Detalle y reseñas de una película |
| POST | `/api/movies/:id/reviews` | Público | Agrega calificación (0–5) y descripción |
| GET | `/api/admin/movies` | Admin | Lista películas |
| GET | `/api/admin/movies/:id` | Admin | Consulta una película |
| POST | `/api/admin/movies` | Admin | Crea `{ "title", "imageUrl", "description" }` |
| PATCH | `/api/admin/movies/:id` | Admin | Actualiza uno o más campos |
| DELETE | `/api/admin/movies/:id` | Admin | Elimina película y sus reseñas |

Ejemplo de creación:

```sh
curl -X POST http://localhost:3000/api/admin/movies \
  -H 'Content-Type: application/json' -H 'x-admin-key: TU_CLAVE' \
  -d '{"title":"Mi película","imageUrl":"https://example.com/poster.jpg","description":"Una gran historia."}'
```

Las reseñas públicas no requieren cuenta y no pueden modificarse ni eliminarse. Si se desea evitar reseñas duplicadas o abusivas, se deberá añadir identidad de usuario y controles adicionales antes de desplegar el sitio públicamente.
