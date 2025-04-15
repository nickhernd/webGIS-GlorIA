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
        logging.FileHandler("salinity_data_import.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("salinity_import")

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

def download_salinity_data():
    """Descarga datos de salinidad de Copernicus Marine."""
    logger.info("Iniciando descarga de datos de salinidad...")
    
    # Definir período de tiempo (últimos 30 días)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    start_datetime = start_date.strftime("%Y-%m-%dT00:00:00")
    end_datetime = end_date.strftime("%Y-%m-%dT00:00:00")
    
    # Coordenadas para el área de interés
    min_lon = -17.29166603088379
    max_lon = 36.29166793823242
    min_lat = 30.1875
    max_lat = 45.97916793823242
    
    # Nombre del archivo de salida
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = DOWNLOAD_DIR / f"cmems_mod_med_phy-sal_anfc_4.2km_P1D-m_{timestamp}.nc"
    
    try:
        # Descargar datos de salinidad superficial
        logger.info(f"Descargando datos de salinidad desde {start_datetime} hasta {end_datetime}")
        
        copernicusmarine.subset(
            dataset_id="cmems_mod_med_phy-sal_anfc_4.2km_P1D-m",
            variables=["so"],  # Variable de salinidad
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
        logger.error(f"Error al descargar datos de salinidad: {e}")
        
        # Buscar si existe algún archivo previamente descargado
        existing_files = list(DOWNLOAD_DIR.glob("cmems_mod_med_phy-sal_anfc_4.2km_P1D-m_*.nc"))
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

def process_salinity_file(file_path, conn):
    """Procesa el archivo NetCDF de salinidad y carga los datos en la base de datos."""
    try:
        logger.info(f"Procesando archivo de salinidad: {file_path}")
        
        with Dataset(file_path, 'r') as nc:
            # Inspeccionar estructura
            logger.info(f"Dimensiones: {nc.dimensions.keys()}")
            logger.info(f"Variables: {nc.variables.keys()}")
            
            # Verificar que existe la variable de salinidad
            if 'so' not in nc.variables:
                logger.error("No se encontró variable de salinidad en el archivo")
                return False
            
            # Obtener o crear dataset en la base de datos
            dataset_name = "Salinidad Mediterráneo"
            dataset_id = "cmems_mod_med_phy-sal_anfc_4.2km_P1D-m"
            variables = ["salinidad"]
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
            
            # Obtener datos de salinidad
            salinity_data = nc.variables['so'][:]
            
            # Imprimir latitudes y longitudes
            print("Latitudes:", nc.variables['latitude'][:])
            print("Longitudes:", nc.variables['longitude'][:])
            
            # Preparar cursor para inserciones
            cursor = conn.cursor()
            
            # Contador de registros insertados
            inserted_count = 0
            values_to_insert = []
            
            # Procesar los datos
            for t_idx, date in enumerate(dates):
                date_str = date.strftime('%Y-%m-%dT%H:%M:%S')
                
                for y_idx, lat in enumerate(lats):
                    for x_idx, lon in enumerate(lons):
                        try:
                            # Acceder al valor con manejo seguro
                            value = float(salinity_data[t_idx, y_idx, x_idx])
                            
                            # Validar el valor
                            if np.isnan(value) or value < 0 or value > 50:
                                continue
                            
                            # Preparar punto geográfico
                            geom = f"SRID=4326;POINT({lon} {lat})"
                            
                            # Añadir a la lista para inserción
                            values_to_insert.append((
                                dataset_db_id,
                                'salinidad',
                                date_str,
                                value,
                                None,  # No hay piscifactoría asociada
                                geom,
                                None,  # No hay profundidad
                                90  # Calidad por defecto
                            ))
                        except Exception as e:
                            logger.debug(f"Error al procesar valor: {e}")
                            continue
            
            if not values_to_insert:
                logger.warning("No se encontraron datos válidos para insertar.")
                return False
            
            # Insertar valores en la base de datos
            if values_to_insert:
                logger.info(f"Insertando {len(values_to_insert)} registros de salinidad")
                
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
            
            logger.info(f"Procesamiento completado. {inserted_count} registros insertados.")
            return inserted_count > 0
    
    except Exception as e:
        logger.error(f"Error al procesar archivo de salinidad: {e}")
        return False

def inspect_failed_file():
    """Inspecciona un archivo NetCDF en el directorio de fallidos."""
    file_path = "/home/nickhernd/webGIS-GlorIA/databases/copernicus_marine/failed/cmems_mod_med_phy-sal_anfc_4.2km_P1D-m_20250413_112846.nc"

    with Dataset(file_path, 'r') as nc:
        print("Variables:", nc.variables.keys())
        print("Dimensiones:", nc.dimensions.keys())
        print("Datos de salinidad (so):", nc.variables['so'][:])

def main():
    """Función principal."""
    try:
        # Configurar entorno
        setup_environment()
        
        # Establecer conexión con la base de datos
        conn = get_db_connection()
        
        # Descargar datos de salinidad
        salinity_file = download_salinity_data()
        
        # Procesar archivo de salinidad
        success = process_salinity_file(salinity_file, conn)
        
        if success:
            # Mover archivo a directorio de procesados
            import shutil
            processed_path = PROCESSED_DIR / os.path.basename(salinity_file)
            shutil.move(salinity_file, processed_path)
            logger.info(f"Archivo movido a {processed_path}")
        else:
            # Mover a directorio de fallidos
            import shutil
            failed_path = FAILED_DIR / os.path.basename(salinity_file)
            shutil.move(salinity_file, failed_path)
            logger.warning(f"Archivo movido a {failed_path} debido a errores")
        
        # Cerrar conexión
        conn.close()
        
        logger.info("Proceso completado")
        
    except Exception as e:
        logger.error(f"Error en el proceso principal: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()