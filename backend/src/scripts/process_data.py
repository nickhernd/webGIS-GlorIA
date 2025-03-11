#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para procesar datos descargados de Copernicus Marine y cargarlos en la base de datos PostgreSQL.

Este script:
1. Busca archivos NetCDF descargados en el directorio correspondiente
2. Extrae los datos, los procesa y los convierte a formato adecuado para la base de datos
3. Carga los datos en las tablas correspondientes de PostgreSQL
4. Mueve los archivos procesados a un directorio de procesados

Proyecto: WebGIS GlorIA
Fecha: Febrero 2025
"""

import os
import sys
import glob
import logging
import json
import hashlib
import shutil
import psycopg2
import pandas as pd
import numpy as np
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta
from netCDF4 import Dataset
from psycopg2.extras import execute_values

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("process_data.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constantes
ROOT_DIR = Path(os.path.expanduser("~/webGIS-GlorIA"))
DOWNLOAD_DIR = ROOT_DIR / "databases" / "copernicus_marine"
PROCESSED_DIR = DOWNLOAD_DIR / "processed"
FAILED_DIR = DOWNLOAD_DIR / "failed"

# Crear directorios si no existen
for directory in [DOWNLOAD_DIR, PROCESSED_DIR, FAILED_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

def setup_environment():
    """Configura el entorno y carga las credenciales de base de datos."""
    # Ruta al archivo .env
    env_path = ROOT_DIR / '.env'

    # Cargar el archivo .env desde esa ruta
    load_dotenv(dotenv_path=env_path)

    # Verificar variables de entorno necesarias
    required_vars = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    for var in required_vars:
        if not os.getenv(var):
            logger.error(f"La variable de entorno {var} no está configurada en el archivo .env")
            raise ValueError(f"La variable de entorno {var} no está configurada en el archivo .env")
    
    logger.info("Variables de entorno cargadas correctamente")

def get_db_connection():
    """Establece una conexión con la base de datos PostgreSQL."""
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

def get_or_create_dataset(conn, dataset_name, dataset_id, variables, source="Copernicus Marine"):
    """
    Obtiene o crea un registro de dataset en la base de datos.
    Devuelve el ID del dataset.
    """
    try:
        cursor = conn.cursor()
        
        # Verificar si el dataset ya existe
        cursor.execute(
            "SELECT id FROM gloria.datasets WHERE nombre = %s AND dataset_id = %s",
            (dataset_name, dataset_id)
        )
        result = cursor.fetchone()
        
        if result:
            dataset_db_id = result[0]
            logger.info(f"Dataset ya existe en la base de datos con ID: {dataset_db_id}")
            
            # Actualizar la fecha de última actualización
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
                    source,
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

def find_closest_piscifactoria(conn, lon, lat, max_distance_km=5.0):
    """
    Encuentra la piscifactoría más cercana a las coordenadas dadas,
    dentro de una distancia máxima.
    Devuelve el ID de la piscifactoría o None si no hay ninguna cercana.
    """
    try:
        cursor = conn.cursor()
        
        # Consulta para encontrar la piscifactoría más cercana dentro de una distancia máxima
        cursor.execute(
            """
            SELECT id, ST_Distance(
                geometria::geography, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            ) as distance_meters
            FROM gloria.piscifactorias
            WHERE ST_DWithin(
                geometria::geography, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 
                %s * 1000  -- Convertir km a metros
            )
            ORDER BY distance_meters ASC
            LIMIT 1
            """,
            (lon, lat, lon, lat, max_distance_km)
        )
        
        result = cursor.fetchone()
        
        if result:
            piscifactoria_id, distance = result
            logger.info(f"Piscifactoría más cercana (ID: {piscifactoria_id}) a {distance:.2f} metros")
            return piscifactoria_id
        else:
            return None
    except Exception as e:
        logger.error(f"Error al buscar piscifactoría cercana: {e}")
        return None

def process_netcdf_file(file_path, dataset_db_id, conn):
    """
    Procesa un archivo NetCDF y carga sus datos en la base de datos.
    """
    try:
        logger.info(f"Procesando archivo: {file_path}")
        
        # Abrir el archivo NetCDF
        with Dataset(file_path, 'r') as nc:
            # Obtener las variables
            variables = [var for var in nc.variables if var not in ['time', 'lat', 'lon', 'latitude', 'longitude', 'depth']]
            
            # Identificar las variables de coordenadas
            lat_var_name = 'latitude' if 'latitude' in nc.variables else 'lat'
            lon_var_name = 'longitude' if 'longitude' in nc.variables else 'lon'
            
            # Obtener las coordenadas
            lats = nc.variables[lat_var_name][:]
            lons = nc.variables[lon_var_name][:]
            
            # Obtener los tiempos
            times = nc.variables['time'][:]
            time_units = nc.variables['time'].units
            
            # Convertir tiempos a fechas
            import netCDF4
            dates = netCDF4.num2date(times, time_units)
            
            # Verificar si hay dimensión de profundidad
            has_depth = 'depth' in nc.variables
            depths = nc.variables['depth'][:] if has_depth else None
            
            # Preparar cursor para inserciones masivas
            cursor = conn.cursor()
            
            # Contador de registros insertados
            inserted_count = 0
            
            # Para cada variable
            for var_name in variables:
                logger.info(f"Procesando variable: {var_name}")
                
                # Obtener los datos de la variable
                var_data = nc.variables[var_name][:]
                
                # Preparar los datos para inserción
                values_to_insert = []
                
                # Para cada tiempo
                for t_idx, date in enumerate(dates):
                    # Convertir la fecha a formato ISO
                    date_str = date.strftime('%Y-%m-%dT%H:%M:%S')
                    
                    # Si hay profundidad, procesar cada nivel
                    if has_depth:
                        for d_idx, depth in enumerate(depths):
                            # Para cada punto de la grilla espacial
                            for y_idx, lat in enumerate(lats):
                                for x_idx, lon in enumerate(lons):
                                    # Obtener el valor
                                    if len(var_data.shape) == 4:  # Tiempo, profundidad, lat, lon
                                        value = var_data[t_idx, d_idx, y_idx, x_idx]
                                    else:
                                        continue
                                    
                                    # Saltar valores nulos o NaN
                                    if np.isnan(value) or value is None or value < -9990:
                                        continue
                                    
                                    # Buscar piscifactoría cercana
                                    piscifactoria_id = find_closest_piscifactoria(conn, float(lon), float(lat))
                                    
                                    # Preparar punto geográfico
                                    geom = f"SRID=4326;POINT({float(lon)} {float(lat)})"
                                    
                                    # Añadir a la lista para inserción masiva
                                    values_to_insert.append((
                                        dataset_db_id,
                                        var_name,
                                        date_str,
                                        float(value),
                                        piscifactoria_id,
                                        geom,
                                        float(depth),
                                        90  # Calidad por defecto
                                    ))
                    else:
                        # Sin profundidad, procesar directamente la grilla espacial
                        for y_idx, lat in enumerate(lats):
                            for x_idx, lon in enumerate(lons):
                                # Obtener el valor
                                if len(var_data.shape) == 3:  # Tiempo, lat, lon
                                    value = var_data[t_idx, y_idx, x_idx]
                                else:
                                    continue
                                
                                # Saltar valores nulos o NaN
                                if np.isnan(value) or value is None or value < -9990:
                                    continue
                                
                                # Buscar piscifactoría cercana
                                piscifactoria_id = find_closest_piscifactoria(conn, float(lon), float(lat))
                                
                                # Preparar punto geográfico
                                geom = f"SRID=4326;POINT({float(lon)} {float(lat)})"
                                
                                # Añadir a la lista para inserción masiva
                                values_to_insert.append((
                                    dataset_db_id,
                                    var_name,
                                    date_str,
                                    float(value),
                                    piscifactoria_id,
                                    geom,
                                    None,  # No hay profundidad
                                    90  # Calidad por defecto
                                ))
                
                # Si hay valores para insertar, hacerlo en bloques para evitar problemas de memoria
                if values_to_insert:
                    logger.info(f"Insertando {len(values_to_insert)} registros para la variable {var_name}")
                    
                    # Insertar en bloques de 1000
                    batch_size = 1000
                    for i in range(0, len(values_to_insert), batch_size):
                        batch = values_to_insert[i:i+batch_size]
                        execute_values(cursor, """
                            INSERT INTO gloria.variables_ambientales
                            (dataset_id, variable_nombre, fecha_tiempo, valor, piscifactoria_id, geometria, profundidad, calidad)
                            VALUES %s
                            ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO UPDATE
                            SET valor = EXCLUDED.valor, calidad = EXCLUDED.calidad
                        """, batch, template="(%s, %s, %s, %s, %s, %s, %s, %s)")
                        
                        inserted_count += len(batch)
                        conn.commit()
                
            logger.info(f"Proceso completado para {file_path}. {inserted_count} registros insertados.")
            
            # Registrar la importación en la tabla de importaciones
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
            
            return True
            
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al procesar archivo {file_path}: {e}")
        return False

def get_dataset_info_from_filename(filename):
    """
    Extrae información del dataset a partir del nombre de archivo.
    Devuelve nombre descriptivo, ID del dataset y variables.
    """
    try:
        # El nombre del archivo suele contener el ID del dataset
        parts = os.path.basename(filename).split('_')
        dataset_id = '_'.join(parts[:-1]) if len(parts) > 1 else parts[0].split('.')[0]
        
        # Mapeo de IDs a nombres descriptivos y variables
        dataset_mapping = {
            'cmems_mod_med_phy-cur_anfc_4.2km_P1D-m': {
                'name': 'Corrientes Mediterráneo',
                'variables': ['uo', 'vo']
            },
            'cmems_mod_med_bgc-co2_anfc_4.2km_P1D-m': {
                'name': 'CO2 Mediterráneo',
                'variables': ['fgco2', 'spco2']
            },
            'cmems_mod_med_bgc-nut_anfc_4.2km_P1D-m': {
                'name': 'Nutrientes Mediterráneo',
                'variables': ['nh4', 'no3', 'po4', 'si']
            },
            'cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m': {
                'name': 'Biología Mediterráneo',
                'variables': ['nppv', 'o2']
            },
            'cmems_obs_oc_med_bgc_tur-spm-chl_nrt_l3-hr-mosaic_P1D-m': {
                'name': 'Turbidez y Clorofila Mediterráneo',
                'variables': ['CHL', 'SPM', 'TUR']
            }
        }
        
        if dataset_id in dataset_mapping:
            return dataset_mapping[dataset_id]['name'], dataset_id, dataset_mapping[dataset_id]['variables']
        else:
            # Si no se encuentra en el mapeo, usar valores por defecto
            return f"Dataset {dataset_id}", dataset_id, []
            
    except Exception as e:
        logger.error(f"Error al extraer información del archivo {filename}: {e}")
        return f"Dataset desconocido", "unknown", []

def detect_variable_thresholds(conn):
    """
    Detecta umbrales para variables ambientales y actualiza la tabla de configuraciones.
    """
    try:
        cursor = conn.cursor()
        
        # Lista de variables para las que calcular umbrales
        variables = ['o2', 'CHL', 'TUR', 'no3', 'po4', 'fgco2', 'spco2', 'nppv', 'uo', 'vo']
        
        for var in variables:
            # Calcular estadísticas básicas
            cursor.execute("""
                SELECT 
                    AVG(valor) as promedio,
                    PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY valor) as p05,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY valor) as p95
                FROM gloria.variables_ambientales
                WHERE variable_nombre = %s
                AND valor IS NOT NULL
                AND valor > -9990
            """, (var,))
            
            result = cursor.fetchone()
            if result:
                avg, p05, p95 = result
                
                # Definir umbrales
                if var in ['o2']:  # Para oxígeno el umbral mínimo es crítico
                    umbral_min = p05
                    umbral_max = p95
                    umbral_critico_min = p05 * 0.8  # 80% del percentil 5
                    umbral_critico_max = p95 * 1.2  # 120% del percentil 95
                elif var in ['uo', 'vo']:  # Para corrientes los umbrales positivos y negativos son importantes
                    umbral_min = p05
                    umbral_max = p95
                    umbral_critico_min = p05 * 1.5  # 150% del percentil 5 (más negativo)
                    umbral_critico_max = p95 * 1.5  # 150% del percentil 95 (más positivo)
                else:  # Para otras variables
                    umbral_min = p05
                    umbral_max = p95
                    umbral_critico_min = p05 * 0.9  # 90% del percentil 5
                    umbral_critico_max = p95 * 1.1  # 110% del percentil 95
                
                # Guardar en la tabla de configuraciones
                cursor.execute("""
                    INSERT INTO gloria.configuraciones
                    (categoria, clave, valor, descripcion, fecha_creacion, fecha_actualizacion)
                    VALUES 
                    ('umbrales', %s || '_min', %s, 'Umbral mínimo para ' || %s, NOW(), NOW()),
                    ('umbrales', %s || '_max', %s, 'Umbral máximo para ' || %s, NOW(), NOW()),
                    ('umbrales', %s || '_critico_min', %s, 'Umbral crítico mínimo para ' || %s, NOW(), NOW()),
                    ('umbrales', %s || '_critico_max', %s, 'Umbral crítico máximo para ' || %s, NOW(), NOW())
                    ON CONFLICT (categoria, clave) DO UPDATE
                    SET valor = EXCLUDED.valor, fecha_actualizacion = NOW()
                """, (
                    var, str(umbral_min), var,
                    var, str(umbral_max), var,
                    var, str(umbral_critico_min), var,
                    var, str(umbral_critico_max), var
                ))
                
                logger.info(f"Umbrales actualizados para variable {var}")
        
        conn.commit()
        logger.info("Detección de umbrales completada")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al detectar umbrales: {e}")

def main():
    """Función principal para el procesamiento de datos."""
    try:
        # Configurar entorno
        setup_environment()
        
        # Establecer conexión con la base de datos
        conn = get_db_connection()
        
        # Buscar archivos NetCDF para procesar
        nc_files = glob.glob(str(DOWNLOAD_DIR / "*.nc"))
        
        if not nc_files:
            logger.info("No hay archivos nuevos para procesar")
            return
        
        logger.info(f"Encontrados {len(nc_files)} archivos para procesar")
        
        # Procesar cada archivo
        successfully_processed = 0
        
        for file_path in nc_files:
            try:
                # Obtener información del dataset a partir del nombre de archivo
                dataset_name, dataset_id, variables = get_dataset_info_from_filename(file_path)
                
                # Obtener o crear el dataset en la base de datos
                dataset_db_id = get_or_create_dataset(conn, dataset_name, dataset_id, variables)
                
                # Procesar el archivo
                success = process_netcdf_file(file_path, dataset_db_id, conn)
                
                if success:
                    # Mover a directorio de procesados
                    processed_path = PROCESSED_DIR / os.path.basename(file_path)
                    shutil.move(file_path, processed_path)
                    logger.info(f"Archivo movido a {processed_path}")
                    successfully_processed += 1
                else:
                    # Mover a directorio de fallidos
                    failed_path = FAILED_DIR / os.path.basename(file_path)
                    shutil.move(file_path, failed_path)
                    logger.warning(f"Archivo movido a {failed_path} debido a errores")
            except Exception as e:
                logger.error(f"Error al procesar archivo {file_path}: {e}")
                # Intentar mover a directorio de fallidos
                try:
                    failed_path = FAILED_DIR / os.path.basename(file_path)
                    shutil.move(file_path, failed_path)
                    logger.warning(f"Archivo movido a {failed_path} debido a errores")
                except:
                    pass
        
        # Actualizar umbrales para las variables
        if successfully_processed > 0:
            detect_variable_thresholds(conn)
        
        logger.info(f"Proceso completado. {successfully_processed}/{len(nc_files)} archivos procesados correctamente")
        
        # Cerrar conexión
        conn.close()
        
    except Exception as e:
        logger.error(f"Error en el proceso principal: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()