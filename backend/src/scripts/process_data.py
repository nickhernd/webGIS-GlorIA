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
Fecha: Abril 2025
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

# Variables principales a procesar - PRIORIZAR ESTAS
PRIORITY_VARIABLES = ['temperatura', 'temperature', 'temp', 'uo', 'vo', 'so', 'salinity', 'currents']

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

def find_closest_piscifactoria(conn, lon, lat, max_distance_km=10.0):
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
            if dentro_area:
                logger.debug(f"Punto dentro del área de piscifactoría ID: {piscifactoria_id}")
            else:
                logger.debug(f"Piscifactoría más cercana (ID: {piscifactoria_id}) a {distance:.2f} metros")
            return piscifactoria_id
        else:
            logger.debug(f"No se encontró piscifactoría cercana para coordenadas ({lon}, {lat})")
            return None
    except Exception as e:
        logger.error(f"Error al buscar piscifactoría cercana: {e}")
        return None

def normalize_variable_name(var_name):
    """Normaliza los nombres de variables a un formato estándar."""
    var_mapping = {
        'temperature': 'temperatura',
        'temp': 'temperatura',
        'sst': 'temperatura',
        'sea_water_temperature': 'temperatura',
        'thetao': 'temperatura',
        
        'salinity': 'salinidad',
        'so': 'salinidad',
        'sea_water_salinity': 'salinidad',
        
        'currents': 'corrientes',
        'current': 'corrientes',
        'uo': 'corriente_u',
        'vo': 'corriente_v',
        'sea_water_velocity': 'corrientes',
        
        'oxygen': 'oxigeno',
        'o2': 'oxigeno',
        'dissolved_oxygen': 'oxigeno'
    }
    
    return var_mapping.get(var_name.lower(), var_name.lower())

def process_netcdf_file(file_path, dataset_db_id, conn):
    """
    Procesa un archivo NetCDF y carga sus datos en la base de datos.
    """
    try:
        logger.info(f"Procesando archivo: {file_path}")
        
        # Abrir el archivo NetCDF con modo de manejo de memoria eficiente
        with Dataset(file_path, 'r', diskless=False, persist=False) as nc:
            # Inspeccionar estructura detallada del archivo
            logger.info(f"Estructura del archivo NetCDF:")
            logger.info(f"Dimensiones: {nc.dimensions.keys()}")
            logger.info(f"Variables: {nc.variables.keys()}")
            logger.info(f"Atributos globales: {nc.ncattrs()}")
            
            # Obtener las variables y filtrar las que no son datos (coordenadas, etc.)
            all_variables = [var for var in nc.variables 
                             if var not in ['time', 'lat', 'lon', 'latitude', 'longitude', 
                                           'depth', 'level', 'height']]
            
            # Identificar variables de coordenadas
            lat_var_name = next((v for v in nc.variables if v.lower() in ['latitude', 'lat']), None)
            lon_var_name = next((v for v in nc.variables if v.lower() in ['longitude', 'lon']), None)
            time_var_name = next((v for v in nc.variables if v.lower() in ['time', 't']), None)
            depth_var_name = next((v for v in nc.variables if v.lower() in ['depth', 'deptht', 'level']), None)
            
            if not all([lat_var_name, lon_var_name, time_var_name]):
                logger.error(f"No se pudieron identificar las variables de coordenadas básicas en {file_path}")
                return False
            
            # Obtener las coordenadas
            lats = nc.variables[lat_var_name][:]
            lons = nc.variables[lon_var_name][:]
            
            # Obtener los tiempos
            times = nc.variables[time_var_name][:]
            time_units = nc.variables[time_var_name].units
            
            # Convertir tiempos a fechas
            import netCDF4
            dates = netCDF4.num2date(times, time_units)
            
            # Verificar si hay dimensión de profundidad
            has_depth = depth_var_name is not None
            depths = nc.variables[depth_var_name][:] if has_depth else [None]
            
            # Para los archivos grandes, reducir el número de puntos
            max_points = 100000  # Limitar el número máximo de puntos
            
            # Calcular factores de muestreo para no exceder max_points
            total_points = len(lats) * len(lons) * len(dates) * (len(depths) if has_depth else 1)
            logger.info(f"Archivo contiene {total_points} puntos potenciales")
            
            sample_factor = max(1, int(np.sqrt(total_points / max_points)))
            
            if sample_factor > 1:
                logger.info(f"Aplicando factor de muestreo {sample_factor} para reducir puntos")
            
            # Subconjunto de índices para coordenadas
            lat_indices = list(range(0, len(lats), sample_factor))
            lon_indices = list(range(0, len(lons), sample_factor))
            time_indices = list(range(len(dates)))
            depth_indices = list(range(len(depths))) if has_depth else [0]
            
            # Mapear y filtrar variables prioritarias
            variables = []
            for var in all_variables:
                # Normalizar nombre
                norm_var = normalize_variable_name(var)
                
                # Añadir la variable si es prioritaria o hay pocas variables
                if norm_var in [normalize_variable_name(v) for v in PRIORITY_VARIABLES] or len(all_variables) <= 3:
                    variables.append((var, norm_var))
            
            # Si no hay variables prioritarias, usar todas
            if not variables:
                variables = [(var, normalize_variable_name(var)) for var in all_variables]
                logger.warning(f"No se encontraron variables prioritarias en {file_path}. Procesando todas las variables.")
            else:
                logger.info(f"Procesando variables prioritarias: {[v[0] for v in variables]}")
            
            # Preparar cursor para inserciones masivas
            cursor = conn.cursor()
            
            # Contador total de registros
            inserted_count = 0
            
            # Para cada variable
            for var_name, db_var_name in variables:
                logger.info(f"Procesando variable: {var_name} -> {db_var_name}")
                
                # Lista para valores a insertar de esta variable
                values_to_insert = []
                
                # Obtener los datos de la variable con manejo específico para masked arrays
                var = nc.variables[var_name]
                
                # Determinar la estructura de los datos
                var_shape = var.shape
                
                # Procesar según la forma de los datos
                if len(var_shape) == 4:  # [tiempo, profundidad, lat, lon]
                    # Contar puntos procesados para mostrar progreso
                    processed = 0
                    total = len(time_indices) * len(depth_indices) * len(lat_indices) * len(lon_indices)
                    
                    for t_idx in time_indices:
                        date = dates[t_idx]
                        date_str = date.strftime('%Y-%m-%dT%H:%M:%S')
                        
                        for d_idx in depth_indices:
                            depth = depths[d_idx] if has_depth else None
                            
                            # Procesar por bloques para cada combinación de tiempo y profundidad
                            chunk_values = []
                            
                            for y_idx in lat_indices:
                                lat = lats[y_idx]
                                
                                for x_idx in lon_indices:
                                    lon = lons[x_idx]
                                    processed += 1
                                    
                                    # Mostrar progreso cada 10%
                                    if processed % max(1, int(total * 0.1)) == 0:
                                        progress = processed / total * 100
                                        logger.info(f"Progreso: {progress:.1f}% ({processed}/{total})")
                                    
                                    try:
                                        # Acceder al valor con manejo seguro
                                        value_mask = var[t_idx, d_idx, y_idx, x_idx] if has_depth else var[t_idx, y_idx, x_idx]
                                        
                                        # Para arreglos enmascarados
                                        if hasattr(value_mask, 'mask') and value_mask.mask:
                                            continue
                                        
                                        # Convertir a valor Python nativo si es un tipo NumPy
                                        value = np.asscalar(value_mask) if hasattr(value_mask, 'item') else float(value_mask)
                                        
                                        # Validar el valor
                                        if np.isnan(value) or value < -9990:
                                            continue
                                        
                                        # Buscar piscifactoría cercana
                                        piscifactoria_id = find_closest_piscifactoria(conn, float(lon), float(lat), max_distance_km=20.0)
                                        
                                        # Preparar punto geográfico
                                        geom = f"SRID=4326;POINT({float(lon)} {float(lat)})"
                                        
                                        # Añadir a la lista para inserción
                                        chunk_values.append((
                                            dataset_db_id,
                                            db_var_name,
                                            date_str,
                                            value,
                                            piscifactoria_id,
                                            geom,
                                            float(depth) if depth is not None else None,
                                            90  # Calidad por defecto
                                        ))
                                    except Exception as e:
                                        # Registrar error pero continuar con el siguiente punto
                                        continue
                            
                            # Añadir valores de este chunk a la lista principal
                            values_to_insert.extend(chunk_values)
                            
                            # Insertar cada chunk de inmediato para liberar memoria
                            if len(values_to_insert) >= 1000:
                                try:
                                    execute_values(cursor, """
                                        INSERT INTO gloria.variables_ambientales
                                        (dataset_id, variable_nombre, fecha_tiempo, valor, piscifactoria_id, geometria, profundidad, calidad)
                                        VALUES %s
                                        ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO UPDATE
                                        SET valor = EXCLUDED.valor, calidad = EXCLUDED.calidad
                                    """, values_to_insert, template="(%s, %s, %s, %s, %s, %s, %s, %s)")
                                    
                                    conn.commit()
                                    inserted_count += len(values_to_insert)
                                    logger.info(f"Insertados {len(values_to_insert)} registros (total: {inserted_count})")
                                    values_to_insert = []  # Liberar memoria
                                except Exception as e:
                                    conn.rollback()
                                    logger.error(f"Error al insertar lote: {e}")
                                    values_to_insert = []  # Liberar memoria aunque haya error
                
                elif len(var_shape) == 3:  # [tiempo, lat, lon]
                    # Contar puntos procesados para mostrar progreso
                    processed = 0
                    total = len(time_indices) * len(lat_indices) * len(lon_indices)
                    
                    for t_idx in time_indices:
                        date = dates[t_idx]
                        date_str = date.strftime('%Y-%m-%dT%H:%M:%S')
                        
                        # Procesar por bloques para cada momento del tiempo
                        chunk_values = []
                        
                        for y_idx in lat_indices:
                            lat = lats[y_idx]
                            
                            for x_idx in lon_indices:
                                lon = lons[x_idx]
                                processed += 1
                                
                                # Mostrar progreso cada 10%
                                if processed % max(1, int(total * 0.1)) == 0:
                                    progress = processed / total * 100
                                    logger.info(f"Progreso: {progress:.1f}% ({processed}/{total})")
                                
                                try:
                                    # Acceder al valor con manejo seguro
                                    value_mask = var[t_idx, y_idx, x_idx]
                                    
                                    # Para arreglos enmascarados
                                    if hasattr(value_mask, 'mask') and value_mask.mask:
                                        continue
                                    
                                    # Convertir a valor Python nativo si es un tipo NumPy
                                    if hasattr(value_mask, 'item'):
                                        value = value_mask.item()
                                    else:
                                        value = float(value_mask)
                                    
                                    # Validar el valor
                                    if np.isnan(value) or value < -9990:
                                        continue
                                    
                                    # Buscar piscifactoría cercana
                                    piscifactoria_id = find_closest_piscifactoria(conn, float(lon), float(lat), max_distance_km=20.0)
                                    
                                    # Preparar punto geográfico
                                    geom = f"SRID=4326;POINT({float(lon)} {float(lat)})"
                                    
                                    # Añadir a la lista para inserción
                                    chunk_values.append((
                                        dataset_db_id,
                                        db_var_name,
                                        date_str,
                                        value,
                                        piscifactoria_id,
                                        geom,
                                        None,  # No hay profundidad
                                        90  # Calidad por defecto
                                    ))
                                except Exception as e:
                                    # Registrar error pero continuar con el siguiente punto
                                    continue
                        
                        # Añadir valores de este chunk a la lista principal
                        values_to_insert.extend(chunk_values)
                        
                        # Insertar cada chunk de inmediato para liberar memoria
                        if len(values_to_insert) >= 1000:
                            try:
                                execute_values(cursor, """
                                    INSERT INTO gloria.variables_ambientales
                                    (dataset_id, variable_nombre, fecha_tiempo, valor, piscifactoria_id, geometria, profundidad, calidad)
                                    VALUES %s
                                    ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO UPDATE
                                    SET valor = EXCLUDED.valor, calidad = EXCLUDED.calidad
                                """, values_to_insert, template="(%s, %s, %s, %s, %s, %s, %s, %s)")
                                
                                conn.commit()
                                inserted_count += len(values_to_insert)
                                logger.info(f"Insertados {len(values_to_insert)} registros (total: {inserted_count})")
                                values_to_insert = []  # Liberar memoria
                            except Exception as e:
                                conn.rollback()
                                logger.error(f"Error al insertar lote: {e}")
                                values_to_insert = []  # Liberar memoria aunque haya error
                
                # Insertar los valores restantes
                if values_to_insert:
                    try:
                        execute_values(cursor, """
                            INSERT INTO gloria.variables_ambientales
                            (dataset_id, variable_nombre, fecha_tiempo, valor, piscifactoria_id, geometria, profundidad, calidad)
                            VALUES %s
                            ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO UPDATE
                            SET valor = EXCLUDED.valor, calidad = EXCLUDED.calidad
                        """, values_to_insert, template="(%s, %s, %s, %s, %s, %s, %s, %s)")
                        
                        conn.commit()
                        inserted_count += len(values_to_insert)
                        logger.info(f"Insertados {len(values_to_insert)} registros finales (total: {inserted_count})")
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error al insertar lote final: {e}")
            
            logger.info(f"Proceso completado para {file_path}. {inserted_count} registros insertados.")
            
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
            
            return inserted_count > 0
            
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al procesar archivo {file_path}: {e}")
        import traceback
        logger.error(traceback.format_exc())
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
            #'cmems_mod_med_phy-cur_anfc_4.2km-2D_PT1H-m': {
            #    'name': 'Corrientes Mediterráneo',
            #    'variables': ['uo', 'vo']
            #},
            #'cmems_mod_med_phy-cur_anfc_4.2km_P1D-m': {
            #    'name': 'Corrientes Mediterráneo',
            #    'variables': ['uo', 'vo']
            #},
#
            #'med-cmcc-sal-rean-d': {
            #    'name': 'Salinidad Mediterráneo',
            #    'variables': ['so']
            #},
            #'med-cmcc-ssh-rean-d': {
            #    'name': 'Nivel del Mar Mediterráneo',
            #    'variables': ['zos']
            #},
            'cmems_mod_med_phy-sst_anfc_4.2km_P1D-m': {
                'name': 'Temperatura Mediterráneo',
                'variables': ['temperature', 'temperatura']
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
        
        # Lista de variables para las que calcular umbrales (priorizando corrientes, temperatura y salinidad)
        variables = ['temperatura', 'uo', 'vo', 'so', 'o2']
        
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
                if var == 'temperatura':
                    umbral_min = 18.0  # Temperatura mínima fija
                    umbral_max = 28.0  # Temperatura máxima fija
                    umbral_critico_min = 16.0  # Temperatura crítica mínima
                    umbral_critico_max = 30.0  # Temperatura crítica máxima
                elif var == 'so':  # Salinidad
                    umbral_min = 34.0  # Salinidad mínima
                    umbral_max = 40.0  # Salinidad máxima
                    umbral_critico_min = 32.0  # Salinidad crítica mínima
                    umbral_critico_max = 42.0  # Salinidad crítica máxima
                elif var in ['uo', 'vo']:  # Corrientes
                    umbral_min = p05 if p05 is not None else -0.8
                    umbral_max = p95 if p95 is not None else 0.8
                    umbral_critico_min = p05 * 1.5 if p05 is not None else -1.2  # 150% del percentil 5 (más negativo)
                    umbral_critico_max = p95 * 1.5 if p95 is not None else 1.2  # 150% del percentil 95 (más positivo)
                else:  # Para otras variables
                    umbral_min = p05 if p05 is not None else 0
                    umbral_max = p95 if p95 is not None else 1
                    umbral_critico_min = p05 * 0.9 if p05 is not None else 0  # 90% del percentil 5
                    umbral_critico_max = p95 * 1.1 if p95 is not None else 1  # 110% del percentil 95
                
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