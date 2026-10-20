BEGIN;

SELECT pg_advisory_xact_lock(hashtext('heytomatoes-schema-init'));

CREATE TABLE IF NOT EXISTS public.peliculas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imagen VARCHAR(2048) NOT NULL
        CHECK (imagen ~* '^https?://[^[:space:]]+$'),
    nombre VARCHAR(200) NOT NULL
        CHECK (nombre ~ '[^[:space:]]'),
    sinopsis VARCHAR(10000) NOT NULL
        CHECK (sinopsis ~ '[^[:space:]]'),
    anio_estreno INTEGER NOT NULL
        CHECK (anio_estreno BETWEEN 1888 AND 2100),
    genero VARCHAR(100) NOT NULL
        CHECK (genero ~ '[^[:space:]]'),
    duracion INTEGER NOT NULL
        CHECK (duracion BETWEEN 1 AND 10000),
    director VARCHAR(200) NOT NULL
        CHECK (director ~ '[^[:space:]]')
);

COMMENT ON COLUMN public.peliculas.imagen IS 'URL HTTP o HTTPS del póster. La API valida la URL completa.';
COMMENT ON COLUMN public.peliculas.anio_estreno IS 'Año de estreno; corresponde al campo anioEstreno de la API.';
COMMENT ON COLUMN public.peliculas.duracion IS 'Duración en minutos.';

COMMIT;
