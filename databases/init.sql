-- ======================================================================
-- Esquema Mejorado para WebGIS GlorIA
-- Base de datos PostgreSQL/PostGIS para monitorización de piscifactorías
-- ======================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Crear el esquema gloria
CREATE SCHEMA IF NOT EXISTS gloria;

-- ===========================================================================
-- TABLAS PRINCIPALES
-- ===========================================================================

-- Tabla de piscifactorías
CREATE TABLE gloria.piscifactorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50),  -- Por ejemplo: 'marina', 'continental', etc.
    especies TEXT[],   -- Array de especies cultivadas
    ciudad VARCHAR(100),
    provincia VARCHAR(50),
    comunidad_autonoma VARCHAR(50),
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    capacidad_produccion FLOAT,   -- En toneladas
    area FLOAT,                   -- En metros cuadrados
    profundidad_media FLOAT,      -- En metros
    activo BOOLEAN DEFAULT TRUE,   
    geometria GEOMETRY(POINT, 4326) NOT NULL,  -- Ubicación del punto central
    geom_area GEOMETRY(POLYGON, 4326),         -- Polígono que representa el área completa (opcional)
    CONSTRAINT piscifactorias_nombre_unico UNIQUE (nombre)
);

-- Tabla de datasets (metadatos de fuentes de datos)
CREATE TABLE gloria.datasets (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    fuente VARCHAR(100) NOT NULL,   -- Por ejemplo: 'Copernicus', 'OpenWeather', etc.
    dataset_id VARCHAR(100) NOT NULL, -- ID del dataset en la fuente original
    variables TEXT[] NOT NULL,        -- Variables que contiene este dataset
    url_base VARCHAR(255),           -- URL base para API o descarga
    formato VARCHAR(50),             -- 'NetCDF', 'CSV', 'JSON', etc.
    frecuencia_actualizacion VARCHAR(50), -- 'diaria', 'horaria', etc.
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_actualizacion TIMESTAMP WITH TIME ZONE,
    activo BOOLEAN DEFAULT TRUE,
    bbox_geom GEOMETRY(POLYGON, 4326), -- Bounding box del área cubierta
    metadatos JSONB,                   -- Metadatos adicionales en formato JSON
    CONSTRAINT datasets_nombre_unico UNIQUE (nombre),
    CONSTRAINT datasets_fuente_id_unico UNIQUE (fuente, dataset_id)
);

-- Tabla de variables ambientales (con datos espacio-temporales)
CREATE TABLE gloria.variables_ambientales (
    id BIGSERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES gloria.datasets(id),
    variable_nombre VARCHAR(50) NOT NULL,
    fecha_tiempo TIMESTAMP WITH TIME ZONE NOT NULL,
    valor FLOAT NOT NULL,
    piscifactoria_id INTEGER REFERENCES gloria.piscifactorias(id), -- NULL si es un valor regional
    geometria GEOMETRY(POINT, 4326) NOT NULL,
    profundidad FLOAT,            -- En metros, NULL para variables de superficie
    calidad INTEGER,              -- Indicador de calidad del dato (0-100)
    observaciones TEXT,
    -- Optimización para consultas temporales
    CONSTRAINT variables_espacio_tiempo UNIQUE (variable_nombre, fecha_tiempo, geometria)
);
-- Convertir a tabla de TimescaleDB para mejorar el rendimiento en series temporales
SELECT create_hypertable('gloria.variables_ambientales', 'fecha_tiempo');

-- Tabla de alertas y eventos
CREATE TABLE gloria.alertas (
    id SERIAL PRIMARY KEY,
    piscifactoria_id INTEGER REFERENCES gloria.piscifactorias(id),
    tipo VARCHAR(50) NOT NULL,    -- 'temperatura', 'corriente', 'contaminación', etc.
    nivel VARCHAR(20) NOT NULL,   -- 'informativo', 'advertencia', 'crítico', etc.
    descripcion TEXT NOT NULL,
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE,  -- NULL si está activa
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    variable_nombre VARCHAR(50),
    valor_umbral FLOAT,
    valor_actual FLOAT,
    activa BOOLEAN DEFAULT TRUE,
    accion_recomendada TEXT,
    geometria GEOMETRY(POINT, 4326),  -- Ubicación específica de la alerta (opcional)
    metadatos JSONB                   -- Datos adicionales en formato JSON
);

-- Tabla para registrar el historial de importaciones y actualizaciones de datos
CREATE TABLE gloria.importaciones (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES gloria.datasets(id),
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_importacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cantidad_registros INTEGER NOT NULL,
    estado VARCHAR(50) NOT NULL,  -- 'completado', 'fallido', 'parcial'
    errores TEXT,
    mensaje TEXT,
    usuario VARCHAR(100),
    tiempo_procesamiento INTEGER,  -- En segundos
    metadatos JSONB
);

-- Tabla para configuraciones del sistema y umbrales de alertas
CREATE TABLE gloria.configuraciones (
    id SERIAL PRIMARY KEY,
    categoria VARCHAR(50) NOT NULL,
    clave VARCHAR(100) NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(100),
    CONSTRAINT config_categoria_clave_unico UNIQUE (categoria, clave)
);

-- ===========================================================================
-- VISTAS MATERIALIZADAS
-- ===========================================================================

-- Vista materializada para las últimas lecturas de variables ambientales por piscifactoría
CREATE MATERIALIZED VIEW gloria.ultimas_lecturas AS
WITH latest_times AS (
    SELECT 
        piscifactoria_id,
        variable_nombre,
        MAX(fecha_tiempo) as ultima_fecha
    FROM 
        gloria.variables_ambientales
    WHERE 
        piscifactoria_id IS NOT NULL
    GROUP BY 
        piscifactoria_id, variable_nombre
)
SELECT 
    va.id,
    va.piscifactoria_id,
    p.nombre as piscifactoria_nombre,
    va.variable_nombre,
    va.fecha_tiempo,
    va.valor,
    va.geometria
FROM 
    gloria.variables_ambientales va
JOIN 
    latest_times lt ON va.piscifactoria_id = lt.piscifactoria_id 
                    AND va.variable_nombre = lt.variable_nombre 
                    AND va.fecha_tiempo = lt.ultima_fecha
JOIN 
    gloria.piscifactorias p ON va.piscifactoria_id = p.id
WITH DATA;

-- Vista materializada para estadísticas diarias de variables ambientales
CREATE MATERIALIZED VIEW gloria.estadisticas_diarias AS
SELECT 
    date_trunc('day', fecha_tiempo) as fecha,
    piscifactoria_id,
    variable_nombre,
    AVG(valor) as valor_promedio,
    MIN(valor) as valor_minimo,
    MAX(valor) as valor_maximo,
    STDDEV(valor) as valor_desviacion,
    COUNT(*) as cantidad_registros
FROM 
    gloria.variables_ambientales
WHERE 
    piscifactoria_id IS NOT NULL
GROUP BY 
    date_trunc('day', fecha_tiempo), piscifactoria_id, variable_nombre
WITH DATA;

-- Vista materializada para resumen de alertas activas
CREATE MATERIALIZED VIEW gloria.alertas_activas AS
SELECT 
    a.id,
    a.piscifactoria_id,
    p.nombre as piscifactoria_nombre,
    a.tipo,
    a.nivel,
    a.descripcion,
    a.fecha_inicio,
    a.valor_actual,
    a.valor_umbral,
    a.geometria
FROM 
    gloria.alertas a
JOIN 
    gloria.piscifactorias p ON a.piscifactoria_id = p.id
WHERE 
    a.activa = TRUE
WITH DATA;

-- ===========================================================================
-- ÍNDICES
-- ===========================================================================

-- Índices para piscifactorías
CREATE INDEX idx_piscifactorias_geometria ON gloria.piscifactorias USING GIST(geometria);
CREATE INDEX idx_piscifactorias_geom_area ON gloria.piscifactorias USING GIST(geom_area);

-- Índices para variables ambientales
CREATE INDEX idx_variables_ambientales_dataset_id ON gloria.variables_ambientales(dataset_id);
CREATE INDEX idx_variables_ambientales_piscifactoria_id ON gloria.variables_ambientales(piscifactoria_id);
CREATE INDEX idx_variables_ambientales_variable_nombre ON gloria.variables_ambientales(variable_nombre);
CREATE INDEX idx_variables_ambientales_geometria ON gloria.variables_ambientales USING GIST(geometria);
-- No es necesario crear índice para fecha_tiempo ya que TimescaleDB lo crea automáticamente

-- Índices para alertas
CREATE INDEX idx_alertas_piscifactoria_id ON gloria.alertas(piscifactoria_id);
CREATE INDEX idx_alertas_tipo ON gloria.alertas(tipo);
CREATE INDEX idx_alertas_nivel ON gloria.alertas(nivel);
CREATE INDEX idx_alertas_fecha_inicio ON gloria.alertas(fecha_inicio);
CREATE INDEX idx_alertas_activa ON gloria.alertas(activa);
CREATE INDEX idx_alertas_geometria ON gloria.alertas USING GIST(geometria);

-- Índices para vistas materializadas
CREATE UNIQUE INDEX idx_ultimas_lecturas_piscifactoria_variable ON gloria.ultimas_lecturas(piscifactoria_id, variable_nombre);
CREATE UNIQUE INDEX idx_estadisticas_diarias_fecha_piscifactoria_variable ON gloria.estadisticas_diarias(fecha, piscifactoria_id, variable_nombre);
CREATE UNIQUE INDEX idx_alertas_activas_id ON gloria.alertas_activas(id);

-- ===========================================================================
-- FUNCIONES Y TRIGGERS
-- ===========================================================================

-- Función para actualizar la fecha_actualizacion automáticamente
CREATE OR REPLACE FUNCTION gloria.update_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar fecha_actualizacion en piscifactorias
CREATE TRIGGER update_piscifactorias_fecha_actualizacion
BEFORE UPDATE ON gloria.piscifactorias
FOR EACH ROW
EXECUTE FUNCTION gloria.update_fecha_actualizacion();

-- Función para refrescar vistas materializadas
CREATE OR REPLACE FUNCTION gloria.refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY gloria.ultimas_lecturas;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gloria.estadisticas_diarias;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gloria.alertas_activas;
END;
$$ LANGUAGE plpgsql;

-- Función para insertar datos de variables ambientales
CREATE OR REPLACE FUNCTION gloria.insert_variable_ambiental(
    _dataset_id INTEGER,
    _variable_nombre VARCHAR(50),
    _fecha_tiempo TIMESTAMP WITH TIME ZONE,
    _valor FLOAT,
    _longitud FLOAT,
    _latitud FLOAT,
    _profundidad FLOAT DEFAULT NULL,
    _calidad INTEGER DEFAULT 100
)
RETURNS INTEGER AS $$
DECLARE
    _id INTEGER;
    _piscifactoria_id INTEGER;
    _geometria GEOMETRY;
BEGIN
    -- Crear el punto geométrico
    _geometria := ST_SetSRID(ST_MakePoint(_longitud, _latitud), 4326);
    
    -- Buscar si el punto está dentro de alguna piscifactoría
    SELECT id INTO _piscifactoria_id
    FROM gloria.piscifactorias
    WHERE ST_Contains(geom_area, _geometria)
    LIMIT 1;
    
    -- Insertar el dato
    INSERT INTO gloria.variables_ambientales(
        dataset_id, variable_nombre, fecha_tiempo, valor, piscifactoria_id, 
        geometria, profundidad, calidad
    )
    VALUES (
        _dataset_id, _variable_nombre, _fecha_tiempo, _valor, _piscifactoria_id,
        _geometria, _profundidad, _calidad
    )
    RETURNING id INTO _id;
    
    RETURN _id;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar alertas basadas en umbrales
CREATE OR REPLACE FUNCTION gloria.check_alertas(
    _piscifactoria_id INTEGER,
    _variable_nombre VARCHAR(50),
    _valor FLOAT,
    _fecha_tiempo TIMESTAMP WITH TIME ZONE,
    _geometria GEOMETRY
)
RETURNS INTEGER AS $$
DECLARE
    _umbral_min FLOAT;
    _umbral_max FLOAT;
    _nivel VARCHAR(20);
    _alerta_id INTEGER;
    _alerta_activa BOOLEAN;
BEGIN
    -- Obtener umbrales configurados
    SELECT 
        valor::FLOAT INTO _umbral_min
    FROM 
        gloria.configuraciones
    WHERE 
        categoria = 'umbrales' AND
        clave = CONCAT(_variable_nombre, '_min')
    LIMIT 1;
    
    SELECT 
        valor::FLOAT INTO _umbral_max
    FROM 
        gloria.configuraciones
    WHERE 
        categoria = 'umbrales' AND
        clave = CONCAT(_variable_nombre, '_max')
    LIMIT 1;
    
    -- Si no hay umbrales configurados, salir
    IF _umbral_min IS NULL AND _umbral_max IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Verificar si se sobrepasan los umbrales
    IF (_umbral_min IS NOT NULL AND _valor < _umbral_min) OR 
       (_umbral_max IS NOT NULL AND _valor > _umbral_max) THEN
       
        -- Determinar nivel de alerta
        IF (_umbral_min IS NOT NULL AND _valor < _umbral_min * 0.8) OR 
           (_umbral_max IS NOT NULL AND _valor > _umbral_max * 1.2) THEN
            _nivel := 'crítico';
        ELSE
            _nivel := 'advertencia';
        END IF;
        
        -- Verificar si ya existe una alerta activa para esta variable y piscifactoría
        SELECT 
            id, activa INTO _alerta_id, _alerta_activa
        FROM 
            gloria.alertas
        WHERE 
            piscifactoria_id = _piscifactoria_id AND
            variable_nombre = _variable_nombre AND
            activa = TRUE
        LIMIT 1;
        
        -- Si ya existe alerta activa, actualizarla
        IF _alerta_id IS NOT NULL AND _alerta_activa = TRUE THEN
            UPDATE gloria.alertas
            SET 
                nivel = _nivel,
                valor_actual = _valor,
                fecha_registro = CURRENT_TIMESTAMP
            WHERE 
                id = _alerta_id;
                
            RETURN _alerta_id;
        ELSE
            -- Crear nueva alerta
            INSERT INTO gloria.alertas(
                piscifactoria_id,
                tipo,
                nivel,
                descripcion,
                fecha_inicio,
                variable_nombre,
                valor_umbral,
                valor_actual,
                activa,
                geometria
            )
            VALUES (
                _piscifactoria_id,
                _variable_nombre,
                _nivel,
                CASE 
                    WHEN _umbral_min IS NOT NULL AND _valor < _umbral_min THEN
                        CONCAT('Valor de ', _variable_nombre, ' por debajo del umbral mínimo (', _umbral_min, ')')
                    ELSE
                        CONCAT('Valor de ', _variable_nombre, ' por encima del umbral máximo (', _umbral_max, ')')
                END,
                _fecha_tiempo,
                _variable_nombre,
                CASE 
                    WHEN _umbral_min IS NOT NULL AND _valor < _umbral_min THEN _umbral_min
                    ELSE _umbral_max
                END,
                _valor,
                TRUE,
                _geometria
            )
            RETURNING id INTO _alerta_id;
            
            RETURN _alerta_id;
        END IF;
    ELSE
        -- Si el valor está dentro de los umbrales, cerrar alertas activas
        UPDATE gloria.alertas
        SET 
            activa = FALSE,
            fecha_fin = _fecha_tiempo
        WHERE 
            piscifactoria_id = _piscifactoria_id AND
            variable_nombre = _variable_nombre AND
            activa = TRUE;
            
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificar alertas automáticamente al insertar nuevos datos
CREATE OR REPLACE FUNCTION gloria.check_alertas_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo verificar alertas para datos asociados a piscifactorías
    IF NEW.piscifactoria_id IS NOT NULL THEN
        PERFORM gloria.check_alertas(
            NEW.piscifactoria_id,
            NEW.variable_nombre,
            NEW.valor,
            NEW.fecha_tiempo,
            NEW.geometria
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_alertas
AFTER INSERT ON gloria.variables_ambientales
FOR EACH ROW
EXECUTE FUNCTION gloria.check_alertas_trigger();

-- ===========================================================================
-- DATOS DE EJEMPLO (PISCIFACTORÍAS DE VALENCIA Y MURCIA)
-- ===========================================================================

-- Insertar piscifactorías de la Comunidad Valenciana
INSERT INTO gloria.piscifactorias (nombre, descripcion, tipo, especies, ciudad, provincia, comunidad_autonoma, capacidad_produccion, area, profundidad_media, geometria, geom_area)
VALUES 
    ('Centro de Investigación Piscícola de El Palmar', 
     'Gestionado por VAERSA, este centro se enfoca en la conservación de especies dulceacuícolas amenazadas mediante programas de producción y cría en cautividad.',
     'continental',
     ARRAY['especies amenazadas'],
     'El Palmar',
     'Valencia',
     'Comunidad Valenciana',
     NULL,
     10000,
     3,
     ST_SetSRID(ST_MakePoint(-0.3333, 39.4167), 4326),
     ST_SetSRID(ST_Buffer(ST_MakePoint(-0.3333, 39.4167)::geography, 500)::geometry, 4326)),
     
    ('Centro de Cultivo de Peces de Tuéjar', 
     'Especializado en la producción de trucha arcoíris y madrilla del Turia, este centro también tiene planes para cultivar otras especies como el barbo de montaña y el cangrejo autóctono.',
     'continental',
     ARRAY['trucha arcoíris', 'madrilla del Turia'],
     'Tuéjar',
     'Valencia',
     'Comunidad Valenciana',
     200,
     15000,
     2.5,
     ST_SetSRID(ST_MakePoint(-1.0167, 39.8833), 4326),
     ST_SetSRID(ST_Buffer(ST_MakePoint(-1.0167, 39.8833)::geography, 600)::geometry, 4326)),
     
    ('Centro de Cultivo de Peces de Aguas Templadas de Polinyà del Xúquer', 
     'Este centro se dedica a la reproducción y engorde de diversas especies, incluyendo la anguila y el fartet, y realiza estudios para mejorar las técnicas de producción.',
     'continental',
     ARRAY['anguila', 'fartet'],
     'Polinyà del Xúquer',
     'Valencia',
     'Comunidad Valenciana',
     150,
     12000,
     2,
     ST_SetSRID(ST_MakePoint(-0.4167, 39.1833), 4326),
     ST_SetSRID(ST_Buffer(ST_MakePoint(-0.4167, 39.1833)::geography, 550)::geometry, 4326));

-- Insertar piscifactorías de la Región de Murcia
INSERT INTO gloria.piscifactorias (nombre, descripcion, tipo, especies, ciudad, provincia, comunidad_autonoma, capacidad_produccion, area, profundidad_media, geometria, geom_area)
VALUES 
    ('Polígono de Acuicultura de San Pedro del Pinatar', 
     'Es el polígono de acuicultura más grande de la Región de Murcia, donde se cultivan especies como la dorada y la lubina.',
     'marina',
     ARRAY['dorada', 'lubina'],
     'San Pedro del Pinatar',
     'Murcia',
     'Región de Murcia',
     2000,
     50000,
     15,
     ST_SetSRID(ST_MakePoint(-0.7833, 37.8667), 4326),
     ST_SetSRID(ST_Buffer(ST_MakePoint(-0.7833, 37.8667)::geography, 1200)::geometry, 4326)),
     
    ('Piscifactorías de Mazarrón', 
     'En esta área se encuentran varias instalaciones dedicadas al cultivo de dorada y lubina, contribuyendo significativamente a la producción acuícola de la región.',
     'marina',
     ARRAY['dorada', 'lubina'],
     'Mazarrón',
     'Murcia',
     'Región de Murcia',
     1800,
     45000,
     18,
     ST_SetSRID(ST_MakePoint(-1.6000, 37.5667), 4326),
     ST_SetSRID(ST_Buffer(ST_MakePoint(-1.6000, 37.5667)::geography, 1100)::geometry, 4326));

-- Insertar datasets de ejemplo
INSERT INTO gloria.datasets (nombre, descripcion, fuente, dataset_id, variables, url_base, formato, frecuencia_actualizacion, bbox_geom)
VALUES
    ('Corrientes Marinas Mediterráneo', 
     'Datos de componentes de corrientes marinas del Mediterráneo',
     'Copernicus',
     'cmems_mod_med_phy-cur_anfc_4.2km_P1D-m',
     ARRAY['uo', 'vo'],
     'https://marine.copernicus.eu/api',
     'NetCDF',
     'diaria',
     ST_SetSRID(ST_MakeEnvelope(-1.5, 37.5, 0.7, 40.5), 4326)),
     
    ('CO2 Mediterráneo', 
     'Datos de CO2 en el Mediterráneo',
     'Copernicus',
     'cmems_mod_med_bgc-co2_anfc_4.2km_P1D-m',
     ARRAY['fgco2', 'spco2'],
     'https://marine.copernicus.eu/api',
     'NetCDF',
     'diaria',
     ST_SetSRID(ST_MakeEnvelope(-1.5, 37.5, 0.7, 40.5), 4326)),
     
    ('Nutrientes Mediterráneo', 
     'Datos de nutrientes en el Mediterráneo',
     'Copernicus',
     'cmems_mod_med_bgc-nut_anfc_4.2km_P1D-m',
     ARRAY['nh4', 'no3', 'po4', 'si'],
     'https://marine.copernicus.eu/api',
     'NetCDF',
     'diaria',
     ST_SetSRID(ST_MakeEnvelope(-1.5, 37.5, 0.7, 40.5), 4326)),
     
    ('Biología Mediterráneo', 
     'Datos biológicos del Mediterráneo',
     'Copernicus',
     'cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m',
     ARRAY['nppv', 'o2'],
     'https://marine.copernicus.eu/api',
     'NetCDF',
     'diaria',
     ST_SetSRID(ST_MakeEnvelope(-5.54, 30.19, 36.29, 45.98), 4326)),
     
    ('Clorofila y Turbidez Mediterráneo', 
     'Datos de clorofila, material particulado en suspensión y turbidez',
     'Copernicus',
     'cmems_obs_oc_med_bgc_tur-spm-chl_nrt_l3-hr-mosaic_P1D-m',
     ARRAY['CHL', 'SPM', 'TUR'],
     'https://marine.copernicus.eu/api',
     'NetCDF',
     'diaria',
     ST_SetSRID(ST_MakeEnvelope(-6.0, 30.0, 37.0, 46.0), 4326)),
     
    ('Datos Meteorológicos', 
     'Datos meteorológicos de OpenWeather',
     'OpenWeather',
     'weather_data',
     ARRAY['temperatura', 'humedad', 'presion', 'velocidad_viento', 'direccion_viento'],
     'https://api.openweathermap.org',
     'JSON',
     'horaria',
     ST_SetSRID(ST_MakeEnvelope(-3.0, 36.0, 2.0, 41.0), 4326));

-- Insertar configuraciones de umbrales para alertas
INSERT INTO gloria.configuraciones (categoria, clave, valor, descripcion)
VALUES
    ('umbrales', 'temperatura_min', '12', 'Temperatura mínima del agua en °C'),
    ('umbrales', 'temperatura_max', '28', 'Temperatura máxima del agua en °C'),
    ('umbrales', 'o2_min', '5', 'Nivel mínimo de oxígeno disuelto en mg/L'),
    ('umbrales', 'uo_max', '1.2', 'Velocidad máxima de corriente (componente U) en m/s'),
    ('umbrales', 'vo_max', '1.2', 'Velocidad máxima de corriente (componente V) en m/s'),
    ('umbrales', 'CHL_max', '10', 'Concentración máxima de clorofila en mg/m³'),
    ('umbrales', 'TUR_max', '15', 'Turbidez máxima en unidades NTU'),
    ('sistema', 'actualizacion_vistas', '3600', 'Intervalo de actualización de vistas materializadas en segundos'),
    ('sistema', 'limite_alertas_diarias', '50', 'Límite de alertas diarias para evitar spam');