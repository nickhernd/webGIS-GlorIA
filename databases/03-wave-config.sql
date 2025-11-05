-- ======================================================================
-- Configuración adicional para datos de oleaje
-- ======================================================================

-- Añadir configuraciones de umbrales para oleaje
INSERT INTO gloria.configuraciones (categoria, clave, valor, descripcion)
VALUES
    ('umbrales', 'oleaje_altura_advertencia', '2.2', 'Altura de ola en metros para activar alerta amarilla'),
    ('umbrales', 'oleaje_altura_peligroso', '4.0', 'Altura de ola en metros para alerta naranja'),
    ('umbrales', 'oleaje_altura_critico', '6.0', 'Altura de ola en metros para alerta roja/negra'),
    ('umbrales', 'oleaje_altura_seguro', '1.0', 'Altura de ola en metros considerada segura (verde)')
ON CONFLICT (categoria, clave) DO UPDATE
SET valor = EXCLUDED.valor,
    descripcion = EXCLUDED.descripcion,
    fecha_actualizacion = CURRENT_TIMESTAMP;

-- Añadir configuraciones de visualización
INSERT INTO gloria.configuraciones (categoria, clave, valor, descripcion)
VALUES
    ('visualizacion', 'oleaje_color_seguro', '#00ff00', 'Color verde para oleaje < 1m'),
    ('visualizacion', 'oleaje_color_moderado', '#ffff00', 'Color amarillo para oleaje 1-2.2m'),
    ('visualizacion', 'oleaje_color_advertencia', '#ffa500', 'Color naranja para oleaje 2.2-4m'),
    ('visualizacion', 'oleaje_color_peligroso', '#ff0000', 'Color rojo para oleaje 4-6m'),
    ('visualizacion', 'oleaje_color_critico', '#000000', 'Color negro para oleaje > 6m')
ON CONFLICT (categoria, clave) DO UPDATE
SET valor = EXCLUDED.valor,
    descripcion = EXCLUDED.descripcion,
    fecha_actualizacion = CURRENT_TIMESTAMP;

-- Añadir metadatos de fuentes de datos
INSERT INTO gloria.configuraciones (categoria, clave, valor, descripcion)
VALUES
    ('fuentes', 'copernicus_wave_dataset', 'MEDSEA_ANALYSISFORECAST_PHY_006_013', 'Dataset de Copernicus para predicción de oleaje'),
    ('fuentes', 'copernicus_wave_descripcion', 'Predicción de altura de ola en el Mediterráneo con resolución espacial alta', 'Descripción del dataset de oleaje'),
    ('fuentes', 'copernicus_wave_resolucion', '~4.2 km', 'Resolución espacial del dataset'),
    ('fuentes', 'copernicus_wave_frecuencia', 'Diaria', 'Frecuencia de actualización del dataset')
ON CONFLICT (categoria, clave) DO UPDATE
SET valor = EXCLUDED.valor,
    descripcion = EXCLUDED.descripcion,
    fecha_actualizacion = CURRENT_TIMESTAMP;

-- Función para obtener el color de oleaje según altura
CREATE OR REPLACE FUNCTION gloria.get_oleaje_color(altura_metros FLOAT)
RETURNS TEXT AS $$
DECLARE
    color TEXT;
BEGIN
    IF altura_metros < 1.0 THEN
        SELECT valor INTO color FROM gloria.configuraciones
        WHERE categoria = 'visualizacion' AND clave = 'oleaje_color_seguro';
    ELSIF altura_metros < 2.2 THEN
        SELECT valor INTO color FROM gloria.configuraciones
        WHERE categoria = 'visualizacion' AND clave = 'oleaje_color_moderado';
    ELSIF altura_metros < 4.0 THEN
        SELECT valor INTO color FROM gloria.configuraciones
        WHERE categoria = 'visualizacion' AND clave = 'oleaje_color_advertencia';
    ELSIF altura_metros < 6.0 THEN
        SELECT valor INTO color FROM gloria.configuraciones
        WHERE categoria = 'visualizacion' AND clave = 'oleaje_color_peligroso';
    ELSE
        SELECT valor INTO color FROM gloria.configuraciones
        WHERE categoria = 'visualizacion' AND clave = 'oleaje_color_critico';
    END IF;

    RETURN COALESCE(color, '#808080');  -- Gris por defecto si no se encuentra
END;
$$ LANGUAGE plpgsql STABLE;

-- Función para obtener el nivel de riesgo de oleaje
CREATE OR REPLACE FUNCTION gloria.get_oleaje_risk_level(altura_metros FLOAT)
RETURNS TEXT AS $$
BEGIN
    IF altura_metros < 1.0 THEN
        RETURN 'seguro';
    ELSIF altura_metros < 2.2 THEN
        RETURN 'moderado';
    ELSIF altura_metros < 4.0 THEN
        RETURN 'advertencia';
    ELSIF altura_metros < 6.0 THEN
        RETURN 'peligroso';
    ELSE
        RETURN 'critico';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vista materializada para estadísticas de oleaje por zona
CREATE MATERIALIZED VIEW IF NOT EXISTS gloria.estadisticas_oleaje AS
WITH latest_wave_data AS (
    SELECT
        va.geometria,
        ST_X(va.geometria) as lon,
        ST_Y(va.geometria) as lat,
        va.fecha_tiempo,
        va.valor as altura_ola,
        gloria.get_oleaje_risk_level(va.valor) as nivel_riesgo,
        gloria.get_oleaje_color(va.valor) as color,
        ROW_NUMBER() OVER (PARTITION BY va.geometria ORDER BY va.fecha_tiempo DESC) as rn
    FROM
        gloria.variables_ambientales va
    WHERE
        va.variable_nombre = 'oleaje_altura'
)
SELECT
    geometria,
    lon,
    lat,
    fecha_tiempo,
    altura_ola,
    nivel_riesgo,
    color
FROM
    latest_wave_data
WHERE
    rn = 1;

-- Crear índices para la vista materializada
CREATE INDEX IF NOT EXISTS idx_estadisticas_oleaje_geometria
ON gloria.estadisticas_oleaje USING GIST(geometria);

CREATE INDEX IF NOT EXISTS idx_estadisticas_oleaje_nivel_riesgo
ON gloria.estadisticas_oleaje(nivel_riesgo);

CREATE INDEX IF NOT EXISTS idx_estadisticas_oleaje_fecha
ON gloria.estadisticas_oleaje(fecha_tiempo);

-- Vista para alertas de oleaje por piscifactoría
CREATE OR REPLACE VIEW gloria.alertas_oleaje_piscifactorias AS
SELECT
    p.id as piscifactoria_id,
    p.nombre as piscifactoria_nombre,
    p.geometria as piscifactoria_geometria,
    AVG(eo.altura_ola) as altura_ola_promedio,
    MAX(eo.altura_ola) as altura_ola_maxima,
    MAX(eo.nivel_riesgo) as nivel_riesgo_maximo,
    COUNT(*) as puntos_medicion,
    MAX(eo.fecha_tiempo) as ultima_actualizacion
FROM
    gloria.piscifactorias p
    CROSS JOIN LATERAL (
        SELECT
            eo.altura_ola,
            eo.nivel_riesgo,
            eo.fecha_tiempo
        FROM
            gloria.estadisticas_oleaje eo
        WHERE
            ST_DWithin(
                p.geometria::geography,
                eo.geometria::geography,
                5000  -- 5 km de radio
            )
    ) eo
GROUP BY
    p.id, p.nombre, p.geometria;

-- Actualizar la función de refresco de vistas materializadas
CREATE OR REPLACE FUNCTION gloria.refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY gloria.ultimas_lecturas;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gloria.estadisticas_diarias;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gloria.alertas_activas;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gloria.estadisticas_oleaje;
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON FUNCTION gloria.get_oleaje_color(FLOAT) IS
'Retorna el código de color hexadecimal para visualizar el nivel de oleaje según su altura en metros';

COMMENT ON FUNCTION gloria.get_oleaje_risk_level(FLOAT) IS
'Retorna el nivel de riesgo del oleaje: seguro, moderado, advertencia, peligroso o critico';

COMMENT ON MATERIALIZED VIEW gloria.estadisticas_oleaje IS
'Vista materializada con las últimas mediciones de oleaje y su categorización por nivel de riesgo y color';

COMMENT ON VIEW gloria.alertas_oleaje_piscifactorias IS
'Vista que muestra el estado del oleaje en un radio de 5km alrededor de cada piscifactoría';

-- Log de finalización
DO $$
BEGIN
    RAISE NOTICE '✅ Configuración de oleaje aplicada correctamente';
END $$;
