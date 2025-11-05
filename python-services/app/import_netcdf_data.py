#!/usr/bin/env python3
"""
Script para importar datos de archivos NetCDF a la base de datos PostgreSQL/PostGIS.
Procesa archivos de oleaje y temperatura desde la carpeta /data.
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path
import re
import psycopg2
from psycopg2.extras import execute_batch
import netCDF4 as nc
import numpy as np

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuración de la base de datos desde variables de entorno
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5433'),
    'database': os.getenv('DB_NAME', 'gloria'),
    'user': os.getenv('DB_USER', 'gloria'),
    'password': os.getenv('DB_PASSWORD', 'gloria')
}

# Directorio de datos
DATA_DIR = Path('../data')
if not DATA_DIR.exists():
    DATA_DIR = Path('./data')

# Configuración de la región de interés (Mediterráneo - zona de Valencia/Murcia)
# Estos límites definen el área de interés
BBOX = {
    'lon_min': -1.5,
    'lon_max': 0.7,
    'lat_min': 37.5,
    'lat_max': 40.5
}


def connect_db():
    """Conectar a la base de datos PostgreSQL."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        logger.info("✅ Conexión exitosa a la base de datos")
        return conn
    except Exception as e:
        logger.error(f"❌ Error conectando a la base de datos: {e}")
        sys.exit(1)


def parse_filename(filename):
    """
    Parsear el nombre del archivo NetCDF para extraer metadatos.

    Ejemplos:
    - 2025110600_h-HCMR--WAVE-MEDWAM4-MEDATL-b20251104_fc00-sv09.00.nc
    - 20251013_2dh-CMCC--RFVL-MFSeas9-MEDATL-b20251028_an-sv10.00.nc
    """
    filename = Path(filename).stem

    # Extraer fecha del inicio del nombre
    date_match = re.match(r'^(\d{8}|\d{10})', filename)
    if date_match:
        date_str = date_match.group(1)
        if len(date_str) == 8:  # YYYYMMDD
            date = datetime.strptime(date_str, '%Y%m%d')
        elif len(date_str) == 10:  # YYYYMMDDHH
            date = datetime.strptime(date_str, '%Y%m%d%H')
    else:
        date = None

    # Determinar el tipo de archivo (WAVE o RFVL)
    if 'WAVE' in filename:
        data_type = 'oleaje'
    elif 'RFVL' in filename:
        data_type = 'temperatura'
    else:
        data_type = 'unknown'

    return {
        'date': date,
        'data_type': data_type,
        'filename': filename
    }


def get_or_create_dataset(conn, data_type):
    """Obtener o crear el dataset en la base de datos."""
    cursor = conn.cursor()

    if data_type == 'oleaje':
        dataset_name = 'Oleaje Mediterráneo HCMR'
        dataset_id_str = 'HCMR-WAVE-MEDWAM4-MEDATL'
        variables = ['VHM0', 'VMDR', 'VTM10']  # Altura significativa, dirección, período
        descripcion = 'Datos de oleaje del Mediterráneo - altura de ola, dirección y período'
    elif data_type == 'temperatura':
        dataset_name = 'Temperatura Superficial CMCC'
        dataset_id_str = 'CMCC-RFVL-MFSeas9-MEDATL'
        variables = ['thetao', 'so']  # Temperatura y salinidad
        descripcion = 'Datos de temperatura y salinidad superficial del Mediterráneo'
    else:
        return None

    # Verificar si existe
    cursor.execute(
        "SELECT id FROM gloria.datasets WHERE dataset_id = %s",
        (dataset_id_str,)
    )
    result = cursor.fetchone()

    if result:
        dataset_id = result[0]
        logger.debug(f"Dataset existente encontrado: {dataset_name} (ID: {dataset_id})")
    else:
        # Crear nuevo dataset
        cursor.execute("""
            INSERT INTO gloria.datasets
            (nombre, descripcion, fuente, dataset_id, variables, formato, frecuencia_actualizacion, bbox_geom)
            VALUES (%s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakeEnvelope(%s, %s, %s, %s), 4326))
            RETURNING id
        """, (
            dataset_name,
            descripcion,
            'Copernicus Marine',
            dataset_id_str,
            variables,
            'NetCDF',
            'horaria' if data_type == 'oleaje' else 'diaria',
            BBOX['lon_min'], BBOX['lat_min'], BBOX['lon_max'], BBOX['lat_max']
        ))
        dataset_id = cursor.fetchone()[0]
        conn.commit()
        logger.info(f"✅ Nuevo dataset creado: {dataset_name} (ID: {dataset_id})")

    cursor.close()
    return dataset_id


def is_in_bbox(lon, lat):
    """Verificar si un punto está dentro del bounding box de interés."""
    return (BBOX['lon_min'] <= lon <= BBOX['lon_max'] and
            BBOX['lat_min'] <= lat <= BBOX['lat_max'])


def process_wave_file(file_path, conn, dataset_id):
    """
    Procesar archivo NetCDF de oleaje.
    Variables principales: VHM0 (altura significativa de ola), VMDR (dirección), VTM10 (período)
    """
    logger.info(f"📊 Procesando archivo de oleaje: {file_path.name}")

    try:
        ds = nc.Dataset(file_path, 'r')

        # Obtener dimensiones y variables
        times = ds.variables['time']
        lons = ds.variables['longitude'][:]
        lats = ds.variables['latitude'][:]

        # Variable principal: altura significativa de ola
        wave_height = ds.variables['VHM0']

        # Obtener fecha/hora y convertir a datetime estándar de Python
        time_units = times.units
        time_values = times[:]
        cftime_dates = nc.num2date(time_values, units=time_units)

        # Convertir cftime a datetime estándar de Python
        import datetime as dt
        dates = []
        for cftime_date in cftime_dates:
            try:
                # Convertir a datetime estándar
                python_date = dt.datetime(
                    cftime_date.year,
                    cftime_date.month,
                    cftime_date.day,
                    cftime_date.hour,
                    cftime_date.minute,
                    cftime_date.second,
                    tzinfo=dt.timezone.utc
                )
                dates.append(python_date)
            except:
                # Si falla, intentar sin microsegundos
                python_date = dt.datetime(
                    cftime_date.year,
                    cftime_date.month,
                    cftime_date.day,
                    cftime_date.hour,
                    cftime_date.minute,
                    cftime_date.second,
                    tzinfo=dt.timezone.utc
                )
                dates.append(python_date)

        cursor = conn.cursor()
        records_to_insert = []

        # Procesar cada timestamp
        for t_idx, date in enumerate(dates):
            wave_data = wave_height[t_idx, :, :]

            # Muestreo de datos (cada N puntos para reducir volumen)
            # Para un área pequeña, tomamos más resolución
            step = 2  # Tomar 1 de cada 2 puntos

            for i in range(0, len(lats), step):
                for j in range(0, len(lons), step):
                    lon = float(lons[j])
                    lat = float(lats[i])

                    # Verificar si está en nuestra región de interés
                    if not is_in_bbox(lon, lat):
                        continue

                    value = float(wave_data[i, j])

                    # Filtrar valores inválidos
                    if np.isnan(value) or np.isinf(value) or value < 0:
                        continue

                    records_to_insert.append((
                        dataset_id,
                        'oleaje_altura',  # variable_nombre
                        date,             # fecha_tiempo
                        value,            # valor (en metros)
                        lon,              # longitud
                        lat               # latitud
                    ))

        # Insertar en lotes
        if records_to_insert:
            logger.info(f"💾 Insertando {len(records_to_insert)} registros de oleaje...")

            execute_batch(cursor, """
                INSERT INTO gloria.variables_ambientales
                (dataset_id, variable_nombre, fecha_tiempo, valor, geometria, profundidad, calidad)
                VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), 0, 100)
                ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO NOTHING
            """, records_to_insert, page_size=1000)

            conn.commit()
            logger.info(f"✅ {len(records_to_insert)} registros de oleaje insertados")

        cursor.close()
        ds.close()

        return len(records_to_insert)

    except Exception as e:
        logger.error(f"❌ Error procesando archivo de oleaje {file_path.name}: {e}")
        conn.rollback()
        return 0


def process_temperature_file(file_path, conn, dataset_id):
    """
    Procesar archivo NetCDF de temperatura superficial.
    Variables principales: thetao (temperatura potencial)
    """
    logger.info(f"🌡️  Procesando archivo de temperatura: {file_path.name}")

    try:
        ds = nc.Dataset(file_path, 'r')

        # Obtener dimensiones y variables
        times = ds.variables['time']

        # Los nombres de coordenadas pueden variar
        if 'longitude' in ds.variables:
            lons = ds.variables['longitude'][:]
            lats = ds.variables['latitude'][:]
        elif 'lon' in ds.variables:
            lons = ds.variables['lon'][:]
            lats = ds.variables['lat'][:]
        elif 'x' in ds.variables and 'y' in ds.variables:
            lons = ds.variables['x'][:]
            lats = ds.variables['y'][:]
        else:
            logger.error(f"No se encontraron coordenadas en el archivo {file_path.name}")
            return 0

        # Variable principal: temperatura (puede tener diferentes nombres)
        if 'thetao' in ds.variables:
            temp_var = ds.variables['thetao']
        elif 'temperature' in ds.variables:
            temp_var = ds.variables['temperature']
        elif 'temp' in ds.variables:
            temp_var = ds.variables['temp']
        else:
            logger.error(f"No se encontró variable de temperatura en {file_path.name}")
            logger.error(f"Variables disponibles: {list(ds.variables.keys())}")
            return 0

        # Obtener fecha/hora y convertir a datetime estándar de Python
        time_units = times.units
        time_values = times[:]
        cftime_dates = nc.num2date(time_values, units=time_units)

        # Convertir cftime a datetime estándar de Python
        import datetime as dt
        dates = []
        for cftime_date in cftime_dates:
            try:
                # Convertir a datetime estándar
                python_date = dt.datetime(
                    cftime_date.year,
                    cftime_date.month,
                    cftime_date.day,
                    cftime_date.hour,
                    cftime_date.minute,
                    cftime_date.second,
                    tzinfo=dt.timezone.utc
                )
                dates.append(python_date)
            except:
                # Si falla, usar valores por defecto
                python_date = dt.datetime(
                    cftime_date.year,
                    cftime_date.month,
                    cftime_date.day,
                    0, 0, 0,
                    tzinfo=dt.timezone.utc
                )
                dates.append(python_date)

        cursor = conn.cursor()
        records_to_insert = []

        # Procesar cada timestamp
        for t_idx, date in enumerate(dates):
            # Tomar la capa superficial (profundidad 0)
            temp_data = temp_var[t_idx, 0, :, :]  # [time, depth, lat, lon]

            # Muestreo de datos
            step = 2  # Tomar 1 de cada 2 puntos

            for i in range(0, len(lats), step):
                for j in range(0, len(lons), step):
                    lon = float(lons[j])
                    lat = float(lats[i])

                    # Verificar si está en nuestra región de interés
                    if not is_in_bbox(lon, lat):
                        continue

                    value = float(temp_data[i, j])

                    # Filtrar valores inválidos
                    if np.isnan(value) or np.isinf(value):
                        continue

                    records_to_insert.append((
                        dataset_id,
                        'temperatura_superficial',  # variable_nombre
                        date,                        # fecha_tiempo
                        value,                       # valor (en °C)
                        lon,                         # longitud
                        lat                          # latitud
                    ))

        # Insertar en lotes
        if records_to_insert:
            logger.info(f"💾 Insertando {len(records_to_insert)} registros de temperatura...")

            execute_batch(cursor, """
                INSERT INTO gloria.variables_ambientales
                (dataset_id, variable_nombre, fecha_tiempo, valor, geometria, profundidad, calidad)
                VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), 0, 100)
                ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO NOTHING
            """, records_to_insert, page_size=1000)

            conn.commit()
            logger.info(f"✅ {len(records_to_insert)} registros de temperatura insertados")

        cursor.close()
        ds.close()

        return len(records_to_insert)

    except Exception as e:
        logger.error(f"❌ Error procesando archivo de temperatura {file_path.name}: {e}")
        conn.rollback()
        return 0


def import_netcdf_files():
    """Función principal para importar todos los archivos NetCDF."""
    logger.info("🚀 Iniciando importación de datos NetCDF...")
    logger.info(f"📁 Directorio de datos: {DATA_DIR}")

    # Verificar que el directorio existe
    if not DATA_DIR.exists():
        logger.error(f"❌ El directorio {DATA_DIR} no existe")
        sys.exit(1)

    # Conectar a la base de datos
    conn = connect_db()

    # Obtener todos los archivos .nc
    nc_files = sorted(DATA_DIR.glob('*.nc'))
    logger.info(f"📦 Encontrados {len(nc_files)} archivos NetCDF")

    if not nc_files:
        logger.warning("⚠️  No se encontraron archivos NetCDF para procesar")
        return

    # Estadísticas
    total_records = 0
    processed_files = 0
    failed_files = 0

    # Procesar cada archivo
    for nc_file in nc_files:
        try:
            # Parsear nombre del archivo
            metadata = parse_filename(nc_file.name)
            data_type = metadata['data_type']

            if data_type == 'unknown':
                logger.warning(f"⚠️  Tipo de datos desconocido para {nc_file.name}, omitiendo...")
                continue

            logger.info(f"\n{'='*60}")
            logger.info(f"📄 Archivo: {nc_file.name}")
            logger.info(f"📅 Fecha: {metadata['date']}")
            logger.info(f"🏷️  Tipo: {data_type}")

            # Obtener o crear dataset
            dataset_id = get_or_create_dataset(conn, data_type)

            if not dataset_id:
                logger.error(f"❌ No se pudo obtener dataset_id para {data_type}")
                failed_files += 1
                continue

            # Procesar según el tipo
            if data_type == 'oleaje':
                records = process_wave_file(nc_file, conn, dataset_id)
            elif data_type == 'temperatura':
                records = process_temperature_file(nc_file, conn, dataset_id)
            else:
                records = 0

            if records > 0:
                total_records += records
                processed_files += 1
                logger.info(f"✅ Archivo procesado exitosamente: {records} registros")
            else:
                failed_files += 1
                logger.warning(f"⚠️  No se insertaron registros para {nc_file.name}")

        except Exception as e:
            logger.error(f"❌ Error procesando {nc_file.name}: {e}")
            failed_files += 1
            conn.rollback()

    # Refrescar vistas materializadas
    try:
        logger.info("\n🔄 Refrescando vistas materializadas...")
        cursor = conn.cursor()
        cursor.execute("SELECT gloria.refresh_materialized_views()")
        conn.commit()
        cursor.close()
        logger.info("✅ Vistas materializadas refrescadas")
    except Exception as e:
        logger.error(f"❌ Error refrescando vistas: {e}")

    # Cerrar conexión
    conn.close()

    # Resumen final
    logger.info("\n" + "="*60)
    logger.info("📊 RESUMEN DE IMPORTACIÓN")
    logger.info("="*60)
    logger.info(f"✅ Archivos procesados exitosamente: {processed_files}")
    logger.info(f"❌ Archivos con errores: {failed_files}")
    logger.info(f"💾 Total de registros insertados: {total_records}")
    logger.info("="*60)


if __name__ == '__main__':
    import_netcdf_files()
