BEGIN;

SELECT pg_advisory_xact_lock(hashtext('heytomatoes-schema-init'));

CREATE TABLE IF NOT EXISTS public.resenas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelicula_id UUID NOT NULL REFERENCES public.peliculas(id) ON DELETE CASCADE,
    calificacion NUMERIC NOT NULL CHECK (calificacion BETWEEN 0 AND 5),
    comentario VARCHAR(1200) NOT NULL CHECK (comentario ~ '[^[:space:]]'),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS resenas_pelicula_fecha_idx
    ON public.resenas (pelicula_id, fecha_creacion);

COMMENT ON COLUMN public.resenas.pelicula_id IS 'Corresponde a peliculaId en la API.';
COMMENT ON COLUMN public.resenas.calificacion IS 'Puntaje entre 0 y 5; admite decimales.';
COMMENT ON COLUMN public.resenas.fecha_creacion IS 'Corresponde a fechaCreacion en la API; fecha con zona horaria.';

COMMIT;
