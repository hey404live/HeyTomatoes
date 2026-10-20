# HeyTomatoes · Cliente

Prototipo de interfaz en español con Vite, React y Tailwind CSS (plugin oficial de Vite).

## Ejecutar

Requiere Node.js 20.19+ o 22.12+.

```sh
npm install
npm run dev
```

## Compilar

```sh
npm run build
npm run preview
```

## Despliegue desde la raíz del repositorio

La raíz contiene un `package.json` y un `package-lock.json` para plataformas que instalan las dependencias antes de entrar en `cliente`. Al ejecutar `npm ci` en la raíz, `postinstall` instala las dependencias del cliente con su propio lockfile, incluidas las herramientas de compilación.

El comando generado por la plataforma, `npm ci && cd cliente && npm run build`, produce `cliente/dist`. También puedes ejecutar `npm ci && npm run build` desde la raíz con el mismo resultado. Configura `API_URL` como variable disponible durante la compilación del cliente.

## Incluye

- Catálogo con búsqueda, filtros por género y ordenación.
- Lista personal de películas guardadas.
- Detalle, sinopsis, calificación de 0 a 5 y reseñas de prueba.
- Administración de demostración con formulario de título, póster y sinopsis.
- Diseño adaptable a móvil, navegación por teclado y diálogos accesibles.

Los datos e interacciones se mantienen en memoria y se reinician al recargar. No hay autenticación ni conexión a la API; la administración es una vista pública de diseño. Las reseñas y cifras son ficticias.

Pósteres y fondo: TMDB, utilizados como material de muestra para este prototipo. Tipografías: Manrope y DM Sans a través de Google Fonts (con alternativas locales). Antes de publicar comercialmente, revisar los permisos del material gráfico.

Estructura: `src/App.jsx` (vistas y componentes), `src/data.js` (contenido de prueba), `src/styles.css` (Tailwind y estilos), `public/images` (imágenes locales).

## Catálogo conectado

La página principal carga GET /peliculas desde http://127.0.0.1:3000. Inicia primero la API con npm start desde API y después npm run dev desde cliente. Configura `API_URL` en `cliente/.env.local` o en las variables de entorno del servicio del cliente. Puedes copiar `cliente/.env.example` como punto de partida. Por ejemplo:

```dotenv
API_URL=https://tu-api.example.com
```

Reinicia Vite después de cambiarla. En la nube, configura la variable antes de ejecutar `npm run build` y vuelve a compilar y desplegar cuando cambie: la URL queda incorporada en el cliente durante la compilación. `API_URL` tiene prioridad sobre la variable anterior `VITE_API_URL`, que sigue siendo compatible. Si ninguna está definida, se usa `http://127.0.0.1:3000`. El servidor debe autorizar el origen del frontend en CORS.

El catálogo ya no utiliza películas de prueba. Incluye carga, reintento, catálogo vacío y géneros obtenidos del servidor. Las tarjetas consultan GET /peliculas/:id/promedio y muestran el promedio y el total reales; las reseñas se guardan en la API y los favoritos siguen siendo locales. El panel permite crear, editar y borrar películas mediante la API.

Los promedios se consultan en paralelo al cargar el catálogo. Sin votos se muestra «Sin calificaciones». Si falla un promedio, la película sigue visible con «Calificación no disponible» y una opción para reintentar. La ordenación por calificación utiliza el promedio numérico y coloca al final las películas sin promedio. Después de publicar una reseña se recargan los promedios del servidor.

Pruebas de integración de lectura con respuestas simuladas: `node --test`.

## Reseñas conectadas

El detalle consulta GET /peliculas/:id/calificaciones. El formulario envía POST a la misma ruta con calificacion y comentario. Al publicar se actualizan reseñas y promedios. Los envíos duplicados se bloquean mientras hay una petición pendiente; si falla el envío, el texto y la calificación se conservan. Los errores de lectura tienen reintento independiente. Las reseñas no muestran nombres inventados porque la API aún no tiene usuarios.

`node --test` incluye una prueba contra una instancia real de la API con archivos temporales, sin modificar los datos de desarrollo.

## Administración conectada

El panel lista datos del servidor y muestra la cantidad real de películas y calificaciones. Publicar película utiliza POST /peliculas. Editar precarga los siete campos y guarda con PUT /peliculas/:id. Borrar pide confirmación e invoca DELETE /peliculas/:id; también se eliminan las reseñas asociadas. Los cambios actualizan el catálogo y el borrado retira la película de favoritos.

La imagen se introduce por URL HTTP/HTTPS, acorde al contrato actual de la API. La duración se expresa en minutos. Los errores del servidor aparecen en el formulario sin descartar los datos. Mientras se guarda o borra, se bloquean los envíos duplicados y el cierre del diálogo. El panel requiere el token de administración configurado en la API.

## Acceso al panel

Administración muestra un formulario de token que se valida con GET /admin/sesion. El listado administrativo usa GET /admin/peliculas. Todas las mutaciones envían Authorization: Bearer con el token validado. Se mantiene solo en memoria (sin localStorage ni sessionStorage) y se descarta al recargar, cerrar sesión o recibir HTTP 401. El catálogo principal sigue público. No copies ADMIN_TOKEN a variables VITE_ ni al código del cliente.
