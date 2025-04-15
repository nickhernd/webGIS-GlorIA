#!/usr/bin/env python3
import os
import sys
import logging
import numpy as np
import copernicusmarine
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta
from netCDF4 import Dataset

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("temperature_data_import.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("temp_import")

# Constantes
ROOT_DIR = Path(os.path.expanduser("~/webGIS-GlorIA"))
DOWNLOAD_DIR = ROOT_DIR / "databases" / "copernicus_marine"
PROCESSED_DIR = DOWNLOAD_DIR / "processed"
FAILED_DIR = DOWNLOAD_DIR / "failed"

# Crear directorios si no existen
for directory in [DOWNLOAD_DIR, PROCESSED_DIR, FAILED_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

def setup_environment():
    """Configura el entorno y carga las credenciales."""
    env_path = ROOT_DIR / '.env'
    load_dotenv(dotenv_path=env_path)
    
    # Verificar credenciales
    required_vars = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    for var in required_vars:
        if not os.getenv(var):
            logger.error(f"La variable de entorno {var} no está configurada")
            raise ValueError(f"Variable de entorno {var} no configurada")
    
    # Configurar Copernicus Marine
    try:
        copernicusmarine.login()
        logger.info("Inicio de sesión en Copernicus Marine exitoso")
    except Exception as e:
        logger.error(f"Error al iniciar sesión en Copernicus Marine: {e}")
        raise
    
    logger.info("Entorno configurado correctamente")

def get_db_connection():
    """Establece conexión con la base de datos PostgreSQL."""
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        logger.info("Conexión con la base de datos establecida correctamente")
        return conn
    except Exception as e:
        logger.error(f"Error al conectar con la base de datos: {e}")
        raise

def download_temperature_data():
    """Descarga datos de temperatura de Copernicus Marine."""
    logger.info("Iniciando descarga de datos de temperatura...")
    
    # Definir período de tiempo (últimos 30 días)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    start_datetime = start_date.strftime("%Y-%m-%dT00:00:00")
    end_datetime = end_date.strftime("%Y-%m-%dT00:00:00")
    
    # Coordenadas para la costa mediterránea española
    min_lon = -2.27
    max_lon = 1.92
    min_lat = 37.00
    max_lat = 40.74
    
    # Nombre del archivo de salida
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = DOWNLOAD_DIR / f"cmems_mod_med_phy-tem_anfc_4.2km_P1D-m_{timestamp}.nc"
    
    try:
        # Descargar datos de temperatura superficial
        logger.info(f"Descargando datos de temperatura desde {start_datetime} hasta {end_datetime}")
        
        copernicusmarine.subset(
            dataset_id="cmems_mod_med_phy-tem_anfc_4.2km_P1D-m",
            variables=["thetao"],  # Variable de temperatura
            minimum_longitude=min_lon,
            maximum_longitude=max_lon,
            minimum_latitude=min_lat,
            maximum_latitude=max_lat,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            minimum_depth=1.0182366371154785,  # Profundidad superficial
            maximum_depth=1.0182366371154785,
            output_filename=str(output_file)
        )
        
        logger.info(f"Datos descargados y guardados en {output_file}")
        return output_file
    
    except Exception as e:
        logger.error(f"Error al descargar datos de temperatura: {e}")
        
        # Buscar si existe algún archivo previamente descargado
        existing_files = list(DOWNLOAD_DIR.glob("cmems_mod_med_phy-tem_anfc_4.2km_P1D-m_*.nc"))
        if existing_files:
            latest_file = max(existing_files, key=os.path.getmtime)
            logger.info(f"Usando archivo existente: {latest_file}")
            return latest_file
        
        raise

def get_or_create_dataset(conn, dataset_name, dataset_id, variables):
    """Obtiene o crea un registro de dataset en la base de datos."""
    try:
        cursor = conn.cursor()
        
        # Verificar si el dataset ya existe
        cursor.execute(
            "SELECT id FROM gloria.datasets WHERE dataset_id = %s",
            (dataset_id,)
        )
        result = cursor.fetchone()
        
        if result:
            dataset_db_id = result[0]
            logger.info(f"Dataset ya existe en la base de datos con ID: {dataset_db_id}")
            
            # Actualizar fecha de última actualización
            cursor.execute(
                "UPDATE gloria.datasets SET fecha_ultima_actualizacion = NOW() WHERE id = %s",
                (dataset_db_id,)
            )
            conn.commit()
        else:
            # Crear nuevo dataset
            cursor.execute(
                """
                INSERT INTO gloria.datasets (
                    nombre, descripcion, fuente, dataset_id, variables, 
                    url_base, formato, frecuencia_actualizacion, 
                    fecha_registro, fecha_ultima_actualizacion, activo
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), TRUE
                ) RETURNING id
                """,
                (
                    dataset_name,
                    f"Datos de {dataset_name} de Copernicus Marine",
                    "Copernicus Marine",
                    dataset_id,
                    variables,
                    "https://resources.marine.copernicus.eu/",
                    "NetCDF",
                    "diaria"
                )
            )
            dataset_db_id = cursor.fetchone()[0]
            conn.commit()
            logger.info(f"Nuevo dataset creado en la base de datos con ID: {dataset_db_id}")
        
        return dataset_db_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al obtener/crear dataset en la base de datos: {e}")
        raise

def find_closest_piscifactoria(conn, lon, lat, max_distance_km=20.0):
    """Encuentra la piscifactoría más cercana a las coordenadas dadas."""
    try:
        cursor = conn.cursor()
        
        # Consulta para encontrar piscifactoría más cercana
        cursor.execute(
            """
            SELECT id, ST_Distance(
                geometria::geography, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            ) as distance_meters,
            CASE 
                WHEN geom_area IS NOT NULL THEN 
                  ST_Contains(geom_area, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                ELSE false
            END as dentro_del_area
            FROM gloria.piscifactorias
            WHERE ST_DWithin(
                geometria::geography, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 
                %s * 1000  -- Convertir km a metros
            )
            ORDER BY dentro_del_area DESC, distance_meters ASC
            LIMIT 1
            """,
            (lon, lat, lon, lat, lon, lat, max_distance_km)
        )
        
        result = cursor.fetchone()
        
        if result:
            piscifactoria_id, distance, dentro_area = result
            return piscifactoria_id
        else:
            return None
    except Exception as e:
        logger.error(f"Error al buscar piscifactoría cercana: {e}")
        return None

def process_temperature_file(file_path, conn):
    """Procesa el archivo NetCDF de temperatura y carga los datos en la base de datos."""
    try:
        logger.info(f"Procesando archivo de temperatura: {file_path}")
        
        with Dataset(file_path, 'r') as nc:
            # Inspeccionar estructura
            logger.info(f"Dimensiones: {nc.dimensions.keys()}")
            logger.info(f"Variables: {nc.variables.keys()}")
            
            # Verificar que existe la variable de temperatura
            if 'thetao' not in nc.variables and 'bottomT' not in nc.variables:
                logger.error("No se encontró variable de temperatura en el archivo")
                return False
            
            # Determinar qué variable usar
            temp_var_name = 'thetao' if 'thetao' in nc.variables else 'bottomT'
            
            # Obtener o crear dataset en la base de datos
            dataset_name = "Temperatura Mediterráneo"
            dataset_id = "cmems_mod_med_phy-tem_anfc_4.2km_P1D-m"
            variables = ["temperatura"]
            dataset_db_id = get_or_create_dataset(conn, dataset_name, dataset_id, variables)
            
            # Obtener coordenadas
            lat_var_name = 'latitude' if 'latitude' in nc.variables else 'lat'
            lon_var_name = 'longitude' if 'longitude' in nc.variables else 'lon'
            time_var_name = 'time'
            
            lats = nc.variables[lat_var_name][:]
            lons = nc.variables[lon_var_name][:]
            times = nc.variables[time_var_name][:]
            time_units = nc.variables[time_var_name].units
            
            # Convertir tiempos a fechas
            import netCDF4
            dates = netCDF4.num2date(times, time_units)
            
            # Verificar si hay dimensión de profundidad
            has_depth = 'depth' in nc.variables
            depths = nc.variables['depth'][:] if has_depth else [None]
            
            # Obtener datos de temperatura
            temp_data = nc.variables[temp_var_name][:]
            
            # Preparar cursor para inserciones
            cursor = conn.cursor()
            
            # Contador de registros insertados
            inserted_count = 0
            values_to_insert = []
            
            # Procesar los datos
            # Determinar la estructura de los datos
            temp_shape = temp_data.shape
            logger.info(f"Forma de los datos de temperatura: {temp_shape}")
            
            # Para limitar la cantidad de datos, muestreamos los puntos
            # Incluimos todos los tiempos, pero muestreamos espacialmente
            sample_factor = max(1, int(np.sqrt(len(lats) * len(lons) / 500)))
            lat_indices = list(range(0, len(lats), sample_factor))
            lon_indices = list(range(0, len(lons), sample_factor))
            
            if len(temp_shape) == 4:  # [tiempo, profundidad, lat, lon]
                for t_idx, date in enumerate(dates):
                    date_str = date.strftime('%Y-%m-%dT%H:%M:%S')
                    
                    for d_idx, depth in enumerate(depths):
                        for y_idx in lat_indices:
                            for x_idx in lon_indices:
                                try:
                                    # Acceder al valor con manejo seguro
                                    value_mask = temp_data[t_idx, d_idx, y_idx, x_idx]
                                    
                                    # Para arreglos enmascarados
                                    if hasattr(value_mask, 'mask') and value_mask.mask:
                                        continue
                                    
                                    # Convertir a valor Python nativo
                                    if hasattr(value_mask, 'item'):
                                        value = value_mask.item()
                                    else:
                                        value = float(value_mask)
                                    
                                    # Validar el valor - Convertir de Kelvin a Celsius si es necesario
                                    if value > 200:  # Probablemente Kelvin
                                        value -= 273.15
                                    
                                    if np.isnan(value) or value < -10 or value > 40:
                                        continue
                                    
                                    # Obtener coordenadas
                                    lat = float(lats[y_idx])
                                    lon = float(lons[x_idx])
                                    
                                    # Buscar piscifactoría cercana
                                    piscifactoria_id = find_closest_piscifactoria(conn, lon, lat)
                                    
                                    # Preparar punto geográfico
                                    geom = f"SRID=4326;POINT({lon} {lat})"
                                    
                                    # Añadir a la lista para inserción
                                    values_to_insert.append((
                                        dataset_db_id,
                                        'temperatura',
                                        date_str,
                                        value,
                                        piscifactoria_id,
                                        geom,
                                        float(depth) if depth is not None else None,
                                        90  # Calidad por defecto
                                    ))
                                except Exception as e:
                                    logger.debug(f"Error al procesar valor: {e}")
                                    continue
            
            elif len(temp_shape) == 3:  # [tiempo, lat, lon]
                for t_idx, date in enumerate(dates):
                    date_str = date.strftime('%Y-%m-%dT%H:%M:%S')
                    
                    for y_idx in lat_indices:
                        for x_idx in lon_indices:
                            try:
                                # Acceder al valor con manejo seguro
                                value_mask = temp_data[t_idx, y_idx, x_idx]
                                
                                # Para arreglos enmascarados
                                if hasattr(value_mask, 'mask') and value_mask.mask:
                                    continue
                                
                                # Convertir a valor Python nativo
                                if hasattr(value_mask, 'item'):
                                    value = value_mask.item()
                                else:
                                    value = float(value_mask)
                                
                                # Validar el valor - Convertir de Kelvin a Celsius si es necesario
                                if value > 200:  # Probablemente Kelvin
                                    value -= 273.15
                                
                                if np.isnan(value) or value < -10 or value > 40:
                                    continue
                                
                                # Obtener coordenadas
                                lat = float(lats[y_idx])
                                lon = float(lons[x_idx])
                                
                                # Buscar piscifactoría cercana
                                piscifactoria_id = find_closest_piscifactoria(conn, lon, lat)
                                
                                # Preparar punto geográfico
                                geom = f"SRID=4326;POINT({lon} {lat})"
                                
                                # Añadir a la lista para inserción
                                values_to_insert.append((
                                    dataset_db_id,
                                    'temperatura',
                                    date_str,
                                    value,
                                    piscifactoria_id,
                                    geom,
                                    None,  # No hay profundidad
                                    90  # Calidad por defecto
                                ))
                            except Exception as e:
                                logger.debug(f"Error al procesar valor: {e}")
                                continue
            
            # Insertar valores en la base de datos
            if values_to_insert:
                logger.info(f"Insertando {len(values_to_insert)} registros de temperatura")
                
                # Insertar en lotes
                batch_size = 1000
                for i in range(0, len(values_to_insert), batch_size):
                    batch = values_to_insert[i:i+batch_size]
                    try:
                        execute_values(cursor, """
                            INSERT INTO gloria.variables_ambientales
                            (dataset_id, variable_nombre, fecha_tiempo, valor, piscifactoria_id, geometria, profundidad, calidad)
                            VALUES %s
                            ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO UPDATE
                            SET valor = EXCLUDED.valor, calidad = EXCLUDED.calidad
                        """, batch, template="(%s, %s, %s, %s, %s, %s, %s, %s)")
                        
                        conn.commit()
                        inserted_count += len(batch)
                        logger.info(f"Insertados {len(batch)} registros (total: {inserted_count})")
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error al insertar lote: {e}")
            
            # Registrar la importación
            if inserted_count > 0:
                try:
                    cursor.execute("""
                        INSERT INTO gloria.importaciones
                        (dataset_id, fecha_inicio, fecha_fin, fecha_importacion, cantidad_registros, estado, mensaje)
                        VALUES (%s, %s, %s, NOW(), %s, %s, %s)
                    """, (
                        dataset_db_id,
                        dates[0].strftime('%Y-%m-%dT%H:%M:%S'),
                        dates[-1].strftime('%Y-%m-%dT%H:%M:%S'),
                        inserted_count,
                        'completado',
                        f'Archivo: {os.path.basename(file_path)}'
                    ))
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error al registrar importación: {e}")
            
            logger.info(f"Procesamiento completado. {inserted_count} registros insertados.")
            return inserted_count > 0
    
    except Exception as e:
        logger.error(f"Error al procesar archivo de temperatura: {e}")
        return False

def assign_temp_data_to_farms(conn):
    """Asigna datos de temperatura a todas las piscifactorías."""
    try:
        cursor = conn.cursor()
        
        # Verificar que existan datos de temperatura
        cursor.execute("""
            SELECT COUNT(*) FROM gloria.variables_ambientales 
            WHERE variable_nombre = 'temperatura'
        """)
        
        temp_count = cursor.fetchone()[0]
        if temp_count == 0:
            logger.error("No hay datos de temperatura disponibles para asignar")
            return False
        
        # Obtener todas las piscifactorías
        cursor.execute("""
            SELECT id, nombre, ST_X(geometria) AS lon, ST_Y(geometria) AS lat
            FROM gloria.piscifactorias
            ORDER BY id
        """)
        
        farms = cursor.fetchall()
        logger.info(f"Encontradas {len(farms)} piscifactorías para asignar datos de temperatura")
        
        # Para cada piscifactoría sin datos de temperatura
        for farm_id, farm_name, farm_lon, farm_lat in farms:
            # Verificar si ya tiene datos de temperatura
            cursor.execute("""
                SELECT COUNT(*) FROM gloria.variables_ambientales
                WHERE variable_nombre = 'temperatura'
                AND piscifactoria_id = %s
            """, (farm_id,))
            
            farm_temp_count = cursor.fetchone()[0]
            
            if farm_temp_count > 0:
                logger.info(f"La piscifactoría {farm_name} ya tiene {farm_temp_count} datos de temperatura")
                continue
            
            # Buscar datos de temperatura cercanos
            cursor.execute("""
                WITH datos_cercanos AS (
                    SELECT 
                        va.id,
                        va.dataset_id,
                        va.fecha_tiempo,
                        va.valor,
                        ST_Distance(
                            va.geometria::geography, 
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                        ) as distancia
                    FROM gloria.variables_ambientales va
                    WHERE va.variable_nombre = 'temperatura'
                    AND ST_Distance(
                        va.geometria::geography, 
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                    ) < 50000  -- 50 km
                    ORDER BY va.fecha_tiempo DESC, distancia ASC
                )
                SELECT DISTINCT ON (DATE(fecha_tiempo)) 
                    id, dataset_id, fecha_tiempo, valor, distancia
                FROM datos_cercanos
                ORDER BY DATE(fecha_tiempo), distancia ASC
                LIMIT 90  -- Aproximadamente 3 meses de datos diarios
            """, (farm_lon, farm_lat, farm_lon, farm_lat))
            
            temp_data = cursor.fetchall()
            
            if not temp_data:
                logger.warning(f"No se encontraron datos de temperatura cercanos para {farm_name}")
                continue
            
            logger.info(f"Encontrados {len(temp_data)} datos de temperatura para {farm_name}")
            
            # Obtener geometría de la piscifactoría
            cursor.execute("""
                SELECT ST_AsText(geometria) FROM gloria.piscifactorias WHERE id = %s
            """, (farm_id,))
            
            farm_geom_text = cursor.fetchone()[0]
            
            # Insertar datos de temperatura para esta piscifactoría
            count = 0
            for temp_id, dataset_id, fecha_tiempo, valor, _ in temp_data:
                try:
                    cursor.execute("""
                        INSERT INTO gloria.variables_ambientales
                        (dataset_id, variable_nombre, fecha_tiempo, valor, piscifactoria_id, geometria, profundidad, calidad)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO UPDATE
                        SET valor = EXCLUDED.valor, calidad = EXCLUDED.calidad
                    """, (
                        dataset_id,
                        'temperatura',
                        fecha_tiempo,
                        valor,
                        farm_id,
                        farm_geom_text,
                        None,  # No hay profundidad
                        90  # Calidad por defecto
                    ))
                    
                    count += 1
                    
                    # Commit cada 20 registros
                    if count % 20 == 0:
                        conn.commit()
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error al insertar dato de temperatura para {farm_name}: {e}")
            
            # Commit final
            conn.commit()
            logger.info(f"Asignados {count} datos de temperatura a {farm_name}")
        
        return True
    
    except Exception as e:
        logger.error(f"Error al asignar datos de temperatura a piscifactorías: {e}")
        return False

def main():
    """Función principal."""
    try:
        # Configurar entorno
        setup_environment()
        
        # Establecer conexión con la base de datos
        conn = get_db_connection()
        
        # Descargar datos de temperatura
        temp_file = download_temperature_data()
        
        # Procesar archivo de temperatura
        success = process_temperature_file(temp_file, conn)
        
        if success:
            # Mover archivo a directorio de procesados
            import shutil
            processed_path = PROCESSED_DIR / os.path.basename(temp_file)
            shutil.move(temp_file, processed_path)
            logger.info(f"Archivo movido a {processed_path}")
            
            # Asignar datos a todas las piscifactorías
            assign_temp_data_to_farms(conn)
        else:
            # Mover a directorio de fallidos
            import shutil
            failed_path = FAILED_DIR / os.path.basename(temp_file)
            shutil.move(temp_file, failed_path)
            logger.warning(f"Archivo movido a {failed_path} debido a errores")
        
        # Cerrar conexión
        conn.close()
        
        logger.info("Proceso completado")
        
    except Exception as e:
        logger.error(f"Error en el proceso principal: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()