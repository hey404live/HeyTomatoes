# HeyTomatoes API

API con Node.js 22+ y `node:http`, sin dependencias externas.

## Ejecutar

```sh
npm run dev
```

También puedes usar `npm start` sin recarga automática y `npm test` para ejecutar las pruebas con datos temporales.

Servidor local: http://127.0.0.1:3000. El puerto se configura con `PORT`. El servidor escucha en `0.0.0.0` para admitir conexiones dentro de contenedores y despliegues en la nube.

## Rutas

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/` | `Hola mundo` en texto plano |
| GET | `/peliculas` | Arreglo de películas; `[]` si no hay registros |
| POST | `/peliculas` | Crea una película y devuelve HTTP 201 con su id |
| PUT | `/peliculas/:id` | Reemplaza los siete campos; devuelve HTTP 200 |
| PATCH | `/peliculas/:id` | Actualiza los campos enviados; devuelve HTTP 200 |
| DELETE | `/peliculas/:id` | Elimina una película; devuelve HTTP 204 sin cuerpo |

Para POST, PUT y PATCH, usa `Content-Type: application/json`.

```json
{
  "imagen": "https://example.com/poster.jpg",
  "nombre": "Interstellar",
  "sinopsis": "Un grupo de exploradores viaja más allá de nuestra galaxia.",
  "anioEstreno": 2014,
  "genero": "Ciencia ficción",
  "duracion": 169,
  "director": "Christopher Nolan"
}
```

Los siete campos son obligatorios al crear o reemplazar una película. `id` es un UUID generado por el servidor y no se puede modificar. `imagen` es una URL HTTP/HTTPS; no se suben archivos ni se descarga o verifica la imagen. `anioEstreno` es un entero entre 1888 y 2100. `duracion` es un entero positivo en minutos (máximo 10000). Los campos de texto no pueden estar vacíos. PATCH requiere al menos un campo válido.

Los errores se devuelven como `{"error":"Descripción"}`: 400 para datos o JSON inválidos, 404 para películas o rutas inexistentes, 405 para métodos no admitidos, 413 para cuerpos de más de 64 KB, 415 para un tipo de contenido incorrecto y 500 para errores internos.

## Ejemplos

```sh
curl http://127.0.0.1:3000/peliculas

curl -X POST http://127.0.0.1:3000/peliculas \
  -H 'Content-Type: application/json' \
  -d '{"imagen":"https://example.com/poster.jpg","nombre":"Interstellar","sinopsis":"Un viaje entre las estrellas.","anioEstreno":2014,"genero":"Ciencia ficción","duracion":169,"director":"Christopher Nolan"}'

# Sustituye ID por el id devuelto al crear la película.
curl -X PATCH http://127.0.0.1:3000/peliculas/ID \
  -H 'Content-Type: application/json' -d '{"duracion":170}'

curl -X DELETE http://127.0.0.1:3000/peliculas/ID
```

## Almacenamiento

La API usa PostgreSQL para todas las lecturas y escrituras de películas y reseñas, y calcula los promedios en SQL. Configura `DATABASE_URL` en el `.env` de la raíz (o en el entorno del proceso), con el formato `postgresql://usuario:contraseña@host:5432/base_de_datos`. Codifica los caracteres especiales del usuario y la contraseña con percent-encoding. La API no inicia si falta esta variable o está vacía. Las tablas son `public.peliculas` y `public.resenas`; los scripts de creación están en `migrations/`. La API ejecuta las migraciones al arrancar para crear las tablas y el índice que falten, sin borrar registros existentes, y después comprueba la conexión y las tablas. El usuario de PostgreSQL debe tener permisos para crear tablas en el esquema `public`. Los arranques simultáneos se coordinan mediante un bloqueo transaccional de PostgreSQL. No vuelve al almacenamiento JSON si falla la base de datos.

Las consultas usan parámetros; PATCH modifica solo los campos enviados. Las reseñas se conservan al editar y se eliminan en cascada al borrar una película. El pool de conexiones se cierra al detener el servidor.

Para importar un antiguo `data/peliculas.json`, ejecuta `node scripts/import-json.js`. Conserva UUID y fechas, no modifica registros existentes con el mismo id y no borra el archivo original. La importación es transaccional y se puede repetir sin duplicar ids. Si no existe el archivo, no hace cambios.

Las pruebas `npm test` usan esquemas temporales de PostgreSQL y los eliminan al finalizar; requieren una conexión configurada y permiso para crear esquemas. No escriben en las tablas públicas.

## Peticiones desde un HTML local

Se admite `Origin: null` para abrir el cliente de pruebas mediante `file:///Users/Hey404/Desktop/http/index.html`. Incluye soporte de preflight OPTIONS para GET, POST, PUT, PATCH y DELETE con Content-Type. Las páginas file:// comparten el origen opaco `null`: CORS no distingue ese archivo de otros archivos locales u otros documentos con ese origen. No se habilitan credenciales. Los orígenes web distintos se rechazan con HTTP 403; las herramientas sin cabecera Origin siguen funcionando.

Desde el HTML, utiliza la dirección HTTP de la API:

```js
const respuesta = await fetch('http://127.0.0.1:3000/peliculas');
const peliculas = await respuesta.json();
```

## Calificaciones y comentarios

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/peliculas/:id/calificaciones` | Crea una calificación con comentario (HTTP 201) |
| GET | `/peliculas/:id/calificaciones` | Lista todas las calificaciones y comentarios de esa película (HTTP 200) |

Sustituye `:id` por el identificador de una película existente. Ambas rutas devuelven HTTP 404 si no existe. Una película sin calificaciones devuelve `[]`.

Body para POST, con `Content-Type: application/json`:

```json
{
  "calificacion": 4.5,
  "comentario": "Una gran película, con una historia y una fotografía increíbles."
}
```

Ambos campos son obligatorios. `calificacion` debe ser un número de 0 a 5, incluidos decimales. `comentario` debe tener entre 1 y 1200 caracteres después de quitar espacios al principio y al final. No se admiten campos adicionales. No se requiere usuario en esta etapa.

La respuesta contiene `id`, `peliculaId`, `calificacion`, `comentario` y `fechaCreacion` (fecha UTC ISO 8601). GET devuelve un arreglo de esos objetos en orden de creación, del más antiguo al más reciente.

```sh
curl -X POST http://127.0.0.1:3000/peliculas/ID/calificaciones \
  -H 'Content-Type: application/json' \
  -d '{"calificacion":5,"comentario":"Excelente película."}'

curl http://127.0.0.1:3000/peliculas/ID/calificaciones
```

Las calificaciones se guardan en `resenas`, relacionadas mediante `pelicula_id`, sin modificar la estructura de las respuestas del catálogo. PUT y PATCH conservan sus calificaciones; DELETE elimina la película junto con sus calificaciones. Estas rutas también admiten el CORS para archivos locales descrito arriba.

## Puntaje promedio

`GET /peliculas/:id/promedio` devuelve HTTP 200 con el promedio aritmético de las calificaciones actuales, redondeado a dos decimales:

```json
{
  "peliculaId": "id-de-la-pelicula",
  "promedio": 4.5,
  "totalCalificaciones": 2
}
```

Sin calificaciones devuelve `promedio: null` y `totalCalificaciones: 0`. Una calificación de cero sí cuenta en el promedio. Si la película no existe, responde HTTP 404. Otros métodos responden HTTP 405. Se calcula al consultar, por lo que incluye las nuevas calificaciones sin almacenar un promedio separado.

## Seguridad del administrador

La API carga `ADMIN_TOKEN` desde el archivo `.env` de la raíz de HeyTomatoes (o desde el entorno del proceso). Si falta o está vacío, no inicia. Reinicia la API después de modificarlo. Nunca uses una variable `VITE_` para este secreto.

Envía `Authorization: Bearer TU_TOKEN` en:

- GET `/admin/sesion`: verifica el token, devuelve `{"autenticado":true}`.
- GET `/admin/peliculas`: listado para el panel.
- POST `/peliculas`: crear.
- PUT o PATCH `/peliculas/:id`: editar.
- DELETE `/peliculas/:id`: borrar.

Sin token o con token incorrecto se responde HTTP 401 antes de procesar la operación. CORS admite la cabecera Authorization para los orígenes locales configurados. Las peticiones OPTIONS no requieren autenticación.

GET `/peliculas`, los promedios y las reseñas siguen públicos. El panel pide el token al ingresar, lo mantiene solo en memoria y lo descarta al cerrar sesión o recargar la página. Las rutas protegidas tienen Cache-Control: no-store. Si se despliega fuera del equipo local, usa HTTPS para transportar el token.
