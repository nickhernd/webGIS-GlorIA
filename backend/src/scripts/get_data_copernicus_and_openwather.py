#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script mejorado para la recolección de datos de Copernicus con manejo de errores, 
prevención de duplicados y descarga incremental.

Versión final corregida para manejar correctamente la respuesta de copernicusmarine.subset()

Este script:
1. Lee las credenciales desde un archivo .env
2. Recolecta datos cronológicamente (del más antiguo al más reciente)
3. Implementa manejo de errores y reintentos en caso de fallos
4. Verifica para evitar descargas duplicadas
5. Realiza descarga incremental (solo nuevos datos)

Proyecto: WebGIS GlorIA
Fecha: Febrero 2025
"""

import os
import sys
import time
import json
import glob
import logging
import hashlib
import copernicusmarine
import pandas as pd
import numpy as np
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta
import urllib3

class EnhancedPoolManager(urllib3.PoolManager):
    def __init__(self, *args, **kwargs):
        if 'maxsize' not in kwargs:
            kwargs['maxsize'] = 50  # Aumentar de 10 a 50
        super().__init__(*args, **kwargs)

# Reemplazar el PoolManager por defecto
original_pool_manager = urllib3.PoolManager
urllib3.PoolManager = EnhancedPoolManager

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("copernicus_data_collector.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Capturador personalizado para los mensajes de copernicusmarine
class CopernicusLogCapture(logging.Handler):
    def __init__(self):
        super().__init__()
        self.download_path = None
        
    def emit(self, record):
        # Captura la ruta del archivo descargado del mensaje de log
        if record.levelname == "INFO" and "Successfully downloaded to" in record.getMessage():
            self.download_path = record.getMessage().split("Successfully downloaded to ")[1].strip()

# Constantes
MAX_RETRY_ATTEMPTS = 5
RETRY_DELAY = 180    # Segundos
ROOT_DIR = Path(os.path.expanduser("~/webGIS-GlorIA"))
DOWNLOAD_DIR = ROOT_DIR / "databases" / "copernicus_marine"
METADATA_FILE = DOWNLOAD_DIR / "metadata.json"

# Crear directorios si no existen
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

def setup_environment():
    """Configura el entorno y carga las credenciales."""
    # Ruta al archivo .env
    env_path = ROOT_DIR / '.env'

    # Cargar el archivo .env desde esa ruta
    load_dotenv(dotenv_path=env_path)

    # Obtener las credenciales
    username = os.getenv("COPERNICUS_USERNAME")
    password = os.getenv("COPERNICUS_PASSWORD")

    # Verificar que las credenciales estén presentes
    if not username or not password:
        logger.error("Las credenciales de Copernicus Marine no están configuradas en el archivo .env")
        raise ValueError("Las credenciales de Copernicus Marine no están configuradas en el archivo .env")

    try:
        # Configurar las credenciales
        copernicusmarine.login()
        logger.info("Inicio de sesión en Copernicus Marine exitoso")
    except Exception as e:
        logger.error(f"Error al iniciar sesión en Copernicus Marine: {e}")
        raise

def load_metadata():
    """Carga los metadatos de descargas previas o crea un nuevo archivo si no existe."""
    if not METADATA_FILE.exists():
        return {}
    
    try:
        with open(METADATA_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error al cargar metadatos: {e}")
        return {}

def save_metadata(metadata):
    """Guarda los metadatos de las descargas."""
    try:
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"Metadatos guardados en {METADATA_FILE}")
    except Exception as e:
        logger.error(f"Error al guardar metadatos: {e}")

def get_download_period(dataset_id, metadata):
    """
    Determina el período de descarga basado en los metadatos existentes.
    Para descargas incrementales.
    """
    # Período predeterminado: desde el principio del año pasado hasta hoy
    #hoy = datetime.today()RETRY_DELAY 
    #fecha_inicio_default = datetime(hoy.year - 1, 1, 1)
    #fecha_fin = hoy

    hoy = datetime.today()
    fecha_inicio_default = hoy - timedelta(days=7)  # Solo una semana de datos
    fecha_fin = hoy
    
    # Si hay datos previos, comenzar desde la última fecha descargada
    if dataset_id in metadata and 'last_download_date' in metadata[dataset_id]:
        last_date_str = metadata[dataset_id]['last_download_date']
        try:
            # Convertir string a datetime y añadir un día para evitar solapamiento
            last_date = datetime.strptime(last_date_str, "%Y-%m-%dT%H:%M:%S")
            fecha_inicio = last_date + timedelta(days=1)
            logger.info(f"Descarga incremental para {dataset_id} desde {fecha_inicio.strftime('%Y-%m-%d')}")
        except Exception as e:
            logger.warning(f"Error al parsear última fecha de descarga: {e}. Usando fecha predeterminada.")
            fecha_inicio = fecha_inicio_default
    else:
        fecha_inicio = fecha_inicio_default
        logger.info(f"Primera descarga para {dataset_id} desde {fecha_inicio.strftime('%Y-%m-%d')}")
    
    # Formatear las fechas al formato que necesita la consulta
    fecha_inicio_str = fecha_inicio.strftime("%Y-%m-%dT%H:%M:%S")
    fecha_fin_str = fecha_fin.strftime("%Y-%m-%dT%H:%M:%S")
    
    return fecha_inicio_str, fecha_fin_str

def calculate_checksum(filepath):
    """Calcula un checksum para un archivo."""
    try:
        with open(filepath, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception as e:
        logger.error(f"Error al calcular checksum: {e}")
        return None

def is_duplicate(dataset_id, checksum, metadata):
    """Verifica si los datos ya han sido descargados basándose en el checksum."""
    if dataset_id in metadata and 'checksums' in metadata[dataset_id]:
        if checksum in metadata[dataset_id]['checksums']:
            return True
    return False

def find_last_downloaded_file(dataset_id):
    """
    Encuentra el archivo más reciente descargado para un dataset.
    Busca en el directorio de trabajo actual y en el directorio de descargas.
    """
    # Buscar en el directorio actual
    files = glob.glob(f"{dataset_id}*.nc")
    
    # Si no se encuentra, buscar en el directorio de descargas
    if not files:
        files = glob.glob(str(DOWNLOAD_DIR / f"{dataset_id}*.nc"))
    
    # Ordenar por fecha de modificación, más reciente primero
    files.sort(key=os.path.getmtime, reverse=True)
    
    if files:
        return files[0]
    return None

def download_with_retry(dataset_id, variables, min_lon, max_lon, min_lat, max_lat, start_date, end_date, min_depth=None, max_depth=None):
    """Descarga datos con reintentos en caso de error."""
    attempts = 0
    
    while attempts < MAX_RETRY_ATTEMPTS:
        try:
            logger.info(f"Intentando descargar {dataset_id} - Intento {attempts + 1}")
            
            # Registra los logs de copernicusmarine para capturar la ruta del archivo
            log_capture = CopernicusLogCapture()
            copernicusmarine_logger = logging.getLogger("copernicusmarine")
            copernicusmarine_logger.addHandler(log_capture)
            
            # Llamada a la API de Copernicus
            copernicusmarine.subset(
                dataset_id=dataset_id,
                variables=variables,
                minimum_longitude=min_lon,
                maximum_longitude=max_lon,
                minimum_latitude=min_lat,
                maximum_latitude=max_lat,
                start_datetime=start_date,
                end_datetime=end_date,
                minimum_depth=min_depth,
                maximum_depth=max_depth,
            )
            
            # Elimina el capturador de logs
            copernicusmarine_logger.removeHandler(log_capture)
            
            # Si capturamos la ruta del archivo, la devolvemos
            if log_capture.download_path:
                return log_capture.download_path
            
            # Si no se captura la ruta del archivo pero la descarga parece exitosa,
            # intentamos encontrar el archivo descargado
            downloaded_file = find_last_downloaded_file(dataset_id)
            if downloaded_file:
                return downloaded_file
            
            # Si no podemos encontrar el archivo, lanzamos una excepción
            raise ValueError("No se pudo determinar la ruta del archivo descargado")
            
        except Exception as e:
            attempts += 1
            logger.warning(f"Error al descargar {dataset_id} (intento {attempts}): {e}")
            
            # Intentar encontrar el archivo por última vez
            downloaded_file = find_last_downloaded_file(dataset_id)
            if downloaded_file:
                return downloaded_file
                
            if attempts >= MAX_RETRY_ATTEMPTS:
                logger.error(f"No se pudo descargar {dataset_id} después de {MAX_RETRY_ATTEMPTS} intentos")
                raise
            
            # Esperar antes de reintentar
            logger.info(f"Esperando {RETRY_DELAY} segundos antes de reintentar...")
            time.sleep(RETRY_DELAY)

def download_and_save(dataset_id, variables, min_lon, max_lon, min_lat, max_lat, metadata, 
                     start_date=None, end_date=None, min_depth=None, max_depth=None):
    """Descarga y guarda datos, verifica duplicados y actualiza metadatos."""
    # Determinar el período de descarga
    if not start_date or not end_date:
        start_date, end_date = get_download_period(dataset_id, metadata)
    
    # Iniciar el proceso de descarga
    logger.info(f"Descargando datos de {dataset_id} desde {start_date} hasta {end_date}")
    
    try:
        # Descargar los datos con reintentos
        downloaded_file = download_with_retry(
            dataset_id=dataset_id,
            variables=variables,
            min_lon=min_lon,
            max_lon=max_lon,
            min_lat=min_lat,
            max_lat=max_lat,
            start_date=start_date,
            end_date=end_date,
            min_depth=min_depth,
            max_depth=max_depth,
        )
        
        # Verificar que el archivo existe
        if not os.path.exists(downloaded_file):
            logger.error(f"El archivo descargado no existe: {downloaded_file}")
            return False
            
        # Calcular checksum
        checksum = calculate_checksum(downloaded_file)
        
        # Verificar si es un duplicado
        if checksum and is_duplicate(dataset_id, checksum, metadata):
            logger.info(f"Datos duplicados detectados para {dataset_id}. Omitiendo guardado.")
            # Eliminamos el archivo duplicado
            os.remove(downloaded_file)
            return False
        
        # Copiar el archivo a nuestro directorio de datos si es necesario
        if not str(downloaded_file).startswith(str(DOWNLOAD_DIR)):
            # Definir el nombre del archivo y la ruta completa
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = DOWNLOAD_DIR / f"{dataset_id}_{timestamp}.nc"
            
            # Copiar el archivo
            import shutil
            shutil.copy2(downloaded_file, output_filename)
            logger.info(f"Archivo copiado de {downloaded_file} a {output_filename}")
            
            # Usar la nueva ruta para el registro
            downloaded_file = output_filename
        
        # Actualizar metadatos
        if dataset_id not in metadata:
            metadata[dataset_id] = {
                'checksums': [],
                'files': [],
                'last_download_date': None
            }
        
        if checksum:
            metadata[dataset_id]['checksums'].append(checksum)
        metadata[dataset_id]['files'].append(str(downloaded_file))
        metadata[dataset_id]['last_download_date'] = end_date
        
        logger.info(f"Datos guardados en: {downloaded_file}")
        return True
        
    except Exception as e:
        logger.error(f"Error al procesar {dataset_id}: {e}")
        return False

def main():
    """Función principal que coordina todo el proceso."""
    try:
        # Configurar entorno y credenciales
        setup_environment()
        
        # Cargar metadatos existentes
        metadata = load_metadata()
        
        # Lista de datasets a descargar
        datasets = [
            {
                "id": "cmems_mod_med_phy-cur_anfc_4.2km_P1D-m",
                "variables": ["uo", "vo"],
                "min_lon": -1.5,
                "max_lon": 0.7,
                "min_lat": 37.5,
                "max_lat": 40.5,
                "min_depth": 1.0182366371154785,
                "max_depth": 1.0182366371154785,
            },
            {
                "id": "cmems_mod_med_bgc-co2_anfc_4.2km_P1D-m",
                "variables": ["fgco2", "spco2"],
                "min_lon": -1.5,
                "max_lon": 0.7,
                "min_lat": 37.5,
                "max_lat": 40.5,
            },
            {
                "id": "cmems_mod_med_bgc-nut_anfc_4.2km_P1D-m",
                "variables": ["nh4", "no3", "po4", "si"],
                "min_lon": -1.5,
                "max_lon": 0.7,
                "min_lat": 37.5,
                "max_lat": 40.5,
                "min_depth": 1.0182366371154785,
                "max_depth": 1.0182366371154785,
            },
            {
                "id": "cmems_mod_med_bgc-bio_anfc_4.2km_P1D-m",
                "variables": ["nppv", "o2"],
                "min_lon": -5.541666507720947,
                "max_lon": 36.29166793823242,
                "min_lat": 30.1875,
                "max_lat": 45.97916793823242,
                "min_depth": 1.0182366371154785,
                "max_depth": 1.0182366371154785,
            },
            {
                "id": "cmems_obs_oc_med_bgc_tur-spm-chl_nrt_l3-hr-mosaic_P1D-m",
                "variables": ["CHL", "SPM", "TUR"],
                "min_lon": -5.999338624338596,
                "max_lon": 36.999338624338655,
                "min_lat": 30.000462962962963,
                "max_lat": 45.99953703703704,
            },
        ]
        
        # Contador para estadísticas
        successful_downloads = 0
        
        # Llamada a la función de descarga para cada dataset
        for dataset in datasets:
            success = download_and_save(
                dataset_id=dataset["id"],
                variables=dataset["variables"],
                min_lon=dataset.get("min_lon"),
                max_lon=dataset.get("max_lon"),
                min_lat=dataset.get("min_lat"),
                max_lat=dataset.get("max_lat"),
                metadata=metadata,
                start_date=dataset.get("start_date"),
                end_date=dataset.get("end_date"),
                min_depth=dataset.get("min_depth"),
                max_depth=dataset.get("max_depth"),
            )
            
            if success:
                successful_downloads += 1
        
        # Guardar metadatos actualizados
        save_metadata(metadata)
        
        logger.info(f"Proceso completado. Descargas exitosas: {successful_downloads}/{len(datasets)}")
        
    except Exception as e:
        logger.error(f"Error en el proceso principal: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()