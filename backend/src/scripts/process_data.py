#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para procesar archivos NetCDF de Copernicus con manejo mejorado de formatos de fecha.

Este script:
1. Lee los archivos NetCDF descargados por el script de recolección
2. Procesa y valida los datos con manejo especial para formatos de fecha
3. Carga los datos en la base de datos PostgreSQL
4. Registra los resultados del procesamiento

Autor: WebGIS GlorIA
Fecha: Febrero 2025
"""

import os
import sys
import time
import json
import logging
import argparse
import re
import numpy as np
import pandas as pd
import netCDF4 as nc
import psycopg2
import psycopg2.extras
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("netcdf_processor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constantes
ROOT_DIR = Path(os.path.expanduser("~/webGIS-GlorIA"))
DATA_DIR = ROOT_DIR / "databases" / "copernicus_marine"
PROCESSED_DIR = DATA_DIR / "processed"
FAILED_DIR = DATA_DIR / "failed"

# Crear directorios si no existen
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
FAILED_DIR.mkdir(parents=True, exist_ok=True)

def setup_environment():
    """Configura el entorno y carga las variables de entorno."""
    # Ruta al archivo .env
    env_path = ROOT_DIR / '.env'

    # Cargar el archivo .env desde esa ruta
    load_dotenv(dotenv_path=env_path)

    # Verificar variables de entorno necesarias
    required_vars = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Faltan variables de entorno: {', '.join(missing_vars)}")
        raise ValueError(f"Las siguientes variables de entorno son necesarias: {', '.join(missing_vars)}")

def get_db_connection():
    """Establece y retorna una conexión a la base de datos PostgreSQL."""
    try:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST"),
            port=os.getenv("POSTGRES_PORT"),
            dbname=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD")
        )
        return conn
    except Exception as e:
        logger.error(f"Error al conectar a la base de datos: {e}")
        raise

def extract_base_dataset_id(filename):
    """
    Extrae el ID base del dataset desde el nombre del archivo.
    Por ejemplo, de "cmems_mod_med_phy-cur_anfc_4.2km_P1D-m_uo-vo_1.50W-0.67E_37.52N-40.48N_1.02m_2024-01-01-2025-02-28.nc"
    extrae "cmems_mod_med_phy-cur_anfc_4.2km_P1D-m"
    """
    filename_str = str(filename)
    
    # Lista de IDs conocidos (de la consulta SQL)
    known_ids = [
        "cmems_mod_med_phy-cur_anfc_4.2km_P1D-m",
        "cmems_mod_med_bgc-co2_anfc_4.2km_P1D-m",
        "cmems_mod_med_bgc-nut_anfc_4.2km_P1D-m",
        "cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m",
        "cmems_obs_oc_med_bgc_tur-spm-chl_nrt_l3-hr-mosaic_P1D-m"
    ]
    
    # Comprobar si alguno de los IDs conocidos está en el nombre del archivo
    for known_id in known_ids:
        if known_id in filename_str:
            return known_id
    
    # Si no se encuentra ningún ID conocido, intentar extraerlo con patrones
    pattern = r'(cmems_\w+_\w+_[\w-]+_\w+_[\d.]+km_[\w-]+)'
    match = re.search(pattern, filename_str)
    
    if match:
        return match.group(1)
    
    # Último recurso: extraer el ID manualmente basado en guiones bajos
    parts = filename_str.split('_')
    if len(parts) >= 7:
        # Los IDs de Copernicus suelen tener este formato
        return '_'.join(parts[:7])
    
    logger.error(f"No se pudo extraer el ID del dataset: {filename}")
    return None

def get_dataset_db_id(conn, dataset_id):
    """Obtiene el ID de la base de datos para un dataset específico."""
    cursor = conn.cursor()
    try:
        # Buscar el dataset exacto
        cursor.execute(
            "SELECT id FROM gloria.datasets WHERE dataset_id = %s",
            (dataset_id,)
        )
        result = cursor.fetchone()
        
        if result:
            return result[0]
        
        # Si no lo encuentra, mostrar los datasets disponibles
        cursor.execute("SELECT dataset_id FROM gloria.datasets")
        available_datasets = cursor.fetchall()
        logger.warning(f"Dataset {dataset_id} no encontrado. Datasets disponibles: {[d[0] for d in available_datasets]}")
        
        return None
    
    finally:
        cursor.close()

def load_netcdf_file(file_path):
    """Carga un archivo NetCDF y devuelve el dataset."""
    try:
        dataset = nc.Dataset(file_path, 'r')
        logger.info(f"Archivo NetCDF cargado: {file_path}")
        return dataset
    except Exception as e:
        logger.error(f"Error al cargar archivo NetCDF {file_path}: {e}")
        raise

def validate_netcdf(dataset, expected_variables=None):
    """Valida el contenido de un dataset NetCDF."""
    try:
        # Verificar que tenga dimensiones y variables
        if not dataset.dimensions or not dataset.variables:
            logger.error("El archivo NetCDF no tiene dimensiones o variables")
            return False
        
        # Verificar coordenadas espaciales y temporales
        required_coords = ['longitude', 'latitude', 'time']
        missing_coords = [coord for coord in required_coords if coord not in dataset.variables]
        
        if missing_coords:
            alternate_coords = {
                'longitude': ['lon', 'x'],
                'latitude': ['lat', 'y'],
                'time': ['t']
            }
            
            # Comprobar coordenadas alternativas
            for missing in missing_coords[:]:  # Usar una copia para evitar modificar mientras iteramos
                alternates = alternate_coords.get(missing, [])
                found = False
                for alt in alternates:
                    if alt in dataset.variables:
                        found = True
                        logger.info(f"Usando coordenada alternativa {alt} en lugar de {missing}")
                        break
                if found:
                    missing_coords.remove(missing)
        
        if missing_coords:
            logger.error(f"Faltan coordenadas requeridas: {', '.join(missing_coords)}")
            return False
        
        # Verificar variables específicas si se proporcionaron
        if expected_variables:
            available_vars = set(dataset.variables.keys())
            missing_vars = [var for var in expected_variables if var not in available_vars]
            
            if missing_vars:
                logger.error(f"Faltan variables esperadas: {', '.join(missing_vars)}")
                return False
        
        return True
    
    except Exception as e:
        logger.error(f"Error al validar archivo NetCDF: {e}")
        return False

def decode_time_units(time_units):
    """
    Decodifica las unidades de tiempo de NetCDF y devuelve la fecha base y el factor de conversión.
    Maneja múltiples formatos de unidades de tiempo.
    """
    time_units = time_units.lower()
    
    # Patrones de unidades de tiempo comunes y sus factores de conversión a segundos
    time_patterns = {
        'seconds since': 1,
        'minutes since': 60,
        'hours since': 3600,
        'days since': 86400
    }
    
    # Encontrar el patrón y factor adecuados
    conversion_factor = None
    for pattern, factor in time_patterns.items():
        if pattern in time_units:
            conversion_factor = factor
            date_str = time_units.split(pattern)[1].strip()
            break
    
    if conversion_factor is None:
        raise ValueError(f"Formato de unidades de tiempo no reconocido: {time_units}")
    
    # Intentar diferentes formatos de fecha
    date_formats = [
        '%Y-%m-%d %H:%M:%S',  # Estándar: 2024-01-01 00:00:00
        '%Y-%m-%d',           # Solo fecha: 2024-01-01
        '%Y-%m-%d %H:%M',     # Sin segundos: 2024-01-01 00:00
        '%Y-%m-%dT%H:%M:%S',  # ISO: 2024-01-01T00:00:00
        '%Y-%m-%dT%H:%M:%SZ', # ISO con Z: 2024-01-01T00:00:00Z
        '%Y-%m-%d %H',        # Solo hora: 2024-01-01 00
    ]
    
    # Probar cada formato hasta encontrar uno que funcione
    for date_format in date_formats:
        try:
            base_datetime = datetime.strptime(date_str, date_format)
            return base_datetime, conversion_factor
        except ValueError:
            continue
    
    # Si llegamos aquí, intentar una solución para fechas específicas
    if '1900-01-01' in date_str:
        # Formato común en datos climáticos históricos
        return datetime(1900, 1, 1), conversion_factor
    elif '1970-01-01' in date_str:
        # Época UNIX
        return datetime(1970, 1, 1), conversion_factor
    
    # Si todo falla, lanzar error
    raise ValueError(f"No se pudo interpretar la fecha base: {date_str}")

def extract_data_from_netcdf(dataset, variable_name):
    """Extrae datos de una variable específica del dataset NetCDF con manejo mejorado de fechas."""
    try:
        # Obtener coordenadas
        if 'longitude' in dataset.variables:
            longitudes = dataset.variables['longitude'][:]
        elif 'lon' in dataset.variables:
            longitudes = dataset.variables['lon'][:]
        else:
            longitudes = dataset.variables['x'][:]
            
        if 'latitude' in dataset.variables:
            latitudes = dataset.variables['latitude'][:]
        elif 'lat' in dataset.variables:
            latitudes = dataset.variables['lat'][:]
        else:
            latitudes = dataset.variables['y'][:]
            
        if 'time' in dataset.variables:
            times = dataset.variables['time'][:]
            time_units = dataset.variables['time'].units
        else:
            times = dataset.variables['t'][:]
            time_units = dataset.variables['t'].units
        
        # Usar el decodificador mejorado de unidades de tiempo
        try:
            base_datetime, conversion_factor = decode_time_units(time_units)
            # Convertir los valores de tiempo a fechas
            datetimes = [base_datetime + timedelta(seconds=float(t) * conversion_factor) for t in times]
        except ValueError as e:
            logger.error(f"Error al decodificar unidades de tiempo: {e}")
            
            # Intento alternativo: usar la biblioteca de netCDF4 para convertir directamente
            try:
                datetimes = nc.num2date(times, time_units)
                logger.info("Usando nc.num2date para la conversión de fechas")
            except Exception as e2:
                logger.error(f"También falló la conversión con nc.num2date: {e2}")
                raise ValueError(f"No se pudo convertir las fechas del archivo: {e} | {e2}")
        
        # Obtener datos de la variable
        variable_data = dataset.variables[variable_name][:]
        
        # Obtener información de profundidad si existe
        depth = None
        if 'depth' in dataset.variables:
            depth = dataset.variables['depth'][:]
        
        # Crear un DataFrame con los datos
        rows = []
        
        # Determinar estructura de los datos (dimensiones)
        var_dims = dataset.variables[variable_name].dimensions
        
        # Limitar el número de puntos a procesar para evitar sobrecarga
        max_points = 1000  # Ajustar según necesidades
        
        # Caso: datos 3D (tiempo, lat, lon) - sin profundidad
        if len(var_dims) == 3 and depth is None:
            # Calcular saltos para tomar muestras
            time_step = max(1, len(times) // 10)
            lat_step = max(1, len(latitudes) // 10)
            lon_step = max(1, len(longitudes) // 10)
            
            for t_idx in range(0, len(times), time_step):
                t = datetimes[t_idx]
                for lat_idx in range(0, len(latitudes), lat_step):
                    lat = latitudes[lat_idx]
                    for lon_idx in range(0, len(longitudes), lon_step):
                        lon = longitudes[lon_idx]
                        value = variable_data[t_idx, lat_idx, lon_idx]
                        if np.ma.is_masked(value):
                            continue  # Saltar valores enmascarados
                        rows.append({
                            'time': t,
                            'latitude': float(lat),
                            'longitude': float(lon),
                            'value': float(value),
                            'depth': None
                        })
                        
                        # Limitar el número de puntos
                        if len(rows) >= max_points:
                            logger.info(f"Limitando a {max_points} puntos para evitar sobrecarga")
                            break
                    if len(rows) >= max_points:
                        break
                if len(rows) >= max_points:
                    break
        
        # Caso: datos 4D (tiempo, profundidad, lat, lon)
        elif len(var_dims) == 4:
            # Calcular saltos para tomar muestras
            time_step = max(1, len(times) // 5)
            depth_step = max(1, len(depth) // 2)
            lat_step = max(1, len(latitudes) // 5)
            lon_step = max(1, len(longitudes) // 5)
            
            for t_idx in range(0, len(times), time_step):
                t = datetimes[t_idx]
                for d_idx in range(0, len(depth), depth_step):
                    d = depth[d_idx]
                    for lat_idx in range(0, len(latitudes), lat_step):
                        lat = latitudes[lat_idx]
                        for lon_idx in range(0, len(longitudes), lon_step):
                            lon = longitudes[lon_idx]
                            value = variable_data[t_idx, d_idx, lat_idx, lon_idx]
                            if np.ma.is_masked(value):
                                continue  # Saltar valores enmascarados
                            rows.append({
                                'time': t,
                                'latitude': float(lat),
                                'longitude': float(lon),
                                'value': float(value),
                                'depth': float(d)
                            })
                            
                            # Limitar el número de puntos
                            if len(rows) >= max_points:
                                logger.info(f"Limitando a {max_points} puntos para evitar sobrecarga")
                                break
                        if len(rows) >= max_points:
                            break
                    if len(rows) >= max_points:
                        break
                if len(rows) >= max_points:
                    break
        
        # Si no se pudo extraer ningún dato válido
        if not rows:
            logger.warning(f"No se pudieron extraer datos válidos para la variable {variable_name}")
            return None
        
        df = pd.DataFrame(rows)
        logger.info(f"Datos extraídos para la variable {variable_name}: {len(df)} registros")
        return df
        
    except Exception as e:
        logger.error(f"Error al extraer datos para la variable {variable_name}: {e}")
        raise

def insert_data_into_db(conn, df, dataset_db_id, variable_nombre):
    """Inserta los datos en la base de datos PostgreSQL."""
    try:
        cursor = conn.cursor()
        
        # Usar la función gloria.insert_variable_ambiental para insertar los datos
        # Procesamos en lotes para mejorar el rendimiento
        batch_size = 100
        total_rows = len(df)
        inserted_rows = 0
        errors = 0
        
        for i in range(0, total_rows, batch_size):
            batch = df.iloc[i:i+batch_size]
            
            for _, row in batch.iterrows():
                try:
                    cursor.execute(
                        """
                        SELECT gloria.insert_variable_ambiental(
                            %s, %s, %s, %s, %s, %s, %s, %s
                        )
                        """,
                        (
                            dataset_db_id,
                            variable_nombre,
                            row['time'],
                            row['value'],
                            row['longitude'],
                            row['latitude'],
                            row['depth'],
                            100  # Calidad por defecto
                        )
                    )
                    inserted_rows += 1
                except Exception as e:
                    logger.error(f"Error al insertar fila: {e}")
                    errors += 1
            
            # Commit cada lote
            conn.commit()
            logger.info(f"Progreso: {inserted_rows}/{total_rows} filas insertadas")
        
        cursor.close()
        logger.info(f"Datos insertados para la variable {variable_nombre}: {inserted_rows} filas (errores: {errors})")
        return inserted_rows, errors
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al insertar datos en la base de datos: {e}")
        raise

def register_import_in_db(conn, dataset_db_id, start_time, end_time, record_count, status, errors=None):
    """Registra la importación en la tabla de importaciones."""
    try:
        cursor = conn.cursor()
        
        cursor.execute(
            """
            INSERT INTO gloria.importaciones 
            (dataset_id, fecha_inicio, fecha_fin, fecha_importacion, cantidad_registros, estado, errores, tiempo_procesamiento) 
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP, %s, %s, %s, %s)
            """,
            (
                dataset_db_id,
                start_time,
                end_time,
                record_count,
                status,
                errors,
                int((end_time - start_time).total_seconds())
            )
        )
        
        conn.commit()
        cursor.close()
        logger.info(f"Importación registrada para el dataset {dataset_db_id}")
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al registrar importación: {e}")

def process_netcdf_file(file_path):
    """Procesa un archivo NetCDF completo."""
    start_time = datetime.now()
    
    try:
        # Extraer información del archivo
        filename = Path(file_path)
        dataset_id = extract_base_dataset_id(filename)
        
        if not dataset_id:
            logger.error(f"No se pudo extraer un ID de dataset válido del archivo: {file_path}")
            return False
            
        logger.info(f"ID base del dataset extraído: {dataset_id}")
        
        # Cargar archivo NetCDF
        dataset = load_netcdf_file(file_path)
        
        # Validar archivo
        if not validate_netcdf(dataset):
            logger.error(f"Validación fallida para el archivo: {file_path}")
            # Mover a carpeta de fallidos
            failed_path = FAILED_DIR / filename.name
            Path(file_path).rename(failed_path)
            return False
        
        # Conectar a la base de datos
        conn = get_db_connection()
        
        # Obtener el ID del dataset en la base de datos
        dataset_db_id = get_dataset_db_id(conn, dataset_id)
        
        if not dataset_db_id:
            logger.error(f"Dataset {dataset_id} no encontrado en la base de datos")
            conn.close()
            return False
        
        # Obtener variables del dataset
        cursor = conn.cursor()
        cursor.execute(
            "SELECT variables FROM gloria.datasets WHERE id = %s",
            (dataset_db_id,)
        )
        result = cursor.fetchone()
        cursor.close()
        
        if not result:
            logger.error(f"No se encontraron variables para el dataset {dataset_id}")
            conn.close()
            return False
        
        variables = result[0]
        
        # Procesar cada variable
        total_records = 0
        error_count = 0
        
        for variable in variables:
            if variable not in dataset.variables:
                logger.warning(f"Variable {variable} no encontrada en el archivo")
                continue
            
            try:
                # Extraer datos
                data_df = extract_data_from_netcdf(dataset, variable)
                
                if data_df is None or data_df.empty:
                    logger.warning(f"No hay datos para la variable {variable}")
                    continue
                
                # Insertar en la base de datos
                inserted, errors = insert_data_into_db(conn, data_df, dataset_db_id, variable)
                total_records += inserted
                error_count += errors
            
            except Exception as e:
                logger.error(f"Error al procesar la variable {variable}: {e}")
                error_count += 1
        
        # Registrar la importación
        end_time = datetime.now()
        status = "completado" if error_count == 0 else "parcial" if total_records > 0 else "fallido"
        errors_str = f"Errores: {error_count}" if error_count > 0 else None
        
        register_import_in_db(
            conn, dataset_db_id, start_time, end_time, total_records, status, errors_str
        )
        
        # Refrescar vistas materializadas si hay nuevos datos
        if total_records > 0:
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT gloria.refresh_materialized_views()")
                conn.commit()
                cursor.close()
                logger.info("Vistas materializadas actualizadas")
            except Exception as e:
                logger.error(f"Error al actualizar vistas materializadas: {e}")
        
        # Cerrar conexión
        conn.close()
        
        # Mover archivo a la carpeta de procesados
        processed_path = PROCESSED_DIR / filename.name
        Path(file_path).rename(processed_path)
        
        logger.info(f"Archivo {filename.name} procesado: {total_records} registros insertados, {error_count} errores")
        return True
    
    except Exception as e:
        logger.error(f"Error al procesar archivo {file_path}: {e}")
        
        # En caso de error grave, mover a carpeta de fallidos
        try:
            filename = Path(file_path)
            failed_path = FAILED_DIR / filename.name
            Path(file_path).rename(failed_path)
        except Exception as move_error:
            logger.error(f"Error al mover archivo fallido: {move_error}")
        
        return False

def process_all_files(directory=None):
    """Procesa todos los archivos NetCDF en el directorio especificado."""
    if directory is None:
        directory = DATA_DIR
    
    # Listar archivos NetCDF
    netcdf_files = list(Path(directory).glob("*.nc"))
    
    if not netcdf_files:
        logger.info(f"No hay archivos NetCDF para procesar en {directory}")
        return
    
    logger.info(f"Encontrados {len(netcdf_files)} archivos NetCDF para procesar")
    
    # Configurar entorno
    setup_environment()
    
    # Procesar cada archivo
    successful = 0
    failed = 0
    
    for file_path in netcdf_files:
        logger.info(f"Procesando archivo: {file_path}")
        
        if process_netcdf_file(file_path):
            successful += 1
        else:
            failed += 1
    
    logger.info(f"Procesamiento completado. Éxitos: {successful}, Fallos: {failed}")

def main():
    """Función principal."""
    parser = argparse.ArgumentParser(description='Procesa archivos NetCDF para cargarlos en PostgreSQL.')
    parser.add_argument('-d', '--directory', help='Directorio donde buscar archivos NetCDF')
    parser.add_argument('-f', '--file', help='Archivo específico para procesar')
    
    args = parser.parse_args()
    
    try:
        if args.file:
            # Procesar un archivo específico
            file_path = Path(args.file)
            if not file_path.exists():
                logger.error(f"El archivo {file_path} no existe")
                return 1
            
            setup_environment()
            
            if process_netcdf_file(file_path):
                logger.info(f"Archivo {file_path.name} procesado correctamente")
                return 0
            else:
                logger.error(f"Error al procesar el archivo {file_path.name}")
                return 1
        else:
            # Procesar todos los archivos en el directorio
            directory = args.directory if args.directory else DATA_DIR
            process_all_files(directory)
            return 0
    
    except Exception as e:
        logger.error(f"Error en la ejecución principal: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())