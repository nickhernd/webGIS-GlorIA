import os
import psycopg2
import xarray as xr
import pandas as pd
import traceback
import gc
from dotenv import load_dotenv
from pathlib import Path

# Ruta completa al archivo .env
dotenv_path = '/home/nickhernd/WebGis-GLORiA/.env'

# Cargar las variables de entorno desde el archivo .env especificado
load_dotenv(dotenv_path=dotenv_path)

# Conexión a la base de datos
def connect_db():
    try:
        # Leer las variables de entorno
        dbname = os.getenv("DB_NAME")
        user = os.getenv("DB_USER")
        password = os.getenv("DB_PASSWORD")
        host = os.getenv("DB_HOST")
        port = os.getenv("DB_PORT")
        
        # Conectar a la base de datos usando las variables de entorno
        conn = psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port
        )
        return conn
    except Exception as e:
        print(f"Error al conectar a la base de datos: {e}")
        return None

# Ruta al directorio de Copernicus Marine
copernicus_directory = Path("~/WebGis-GLORiA").expanduser()

# Obtener todos los archivos .nc en la ruta especificada
nc_files = list(copernicus_directory.glob("*.nc"))

# Función para migrar un archivo .nc a PostGIS
def migrate_nc_to_postgis(nc_file):
    try:
        # Cargar el archivo .nc sin Dask, usando xarray directamente
        ds = xr.open_dataset(nc_file, engine="netcdf4")

        # Extraer metadatos del dataset (por ejemplo, fechas, coordenadas)
        dataset_id = nc_file.stem

        # Buscar las coordenadas de latitud y longitud de manera flexible
        lon_var = None
        lat_var = None
        for coord in ['longitude', 'lon']:
            if coord in ds:
                lon_var = coord
                break
        for coord in ['latitude', 'lat']:
            if coord in ds:
                lat_var = coord
                break
        
        # Si no se encuentran coordenadas válidas, se genera un error
        if lon_var is None or lat_var is None:
            print(f"Error: No se encontraron coordenadas de latitud o longitud en el archivo {nc_file}.")
            return
        
        # Acceder a las coordenadas de longitud y latitud de forma segura
        min_lon = float(ds[lon_var].min().item())
        max_lon = float(ds[lon_var].max().item())
        min_lat = float(ds[lat_var].min().item())
        max_lat = float(ds[lat_var].max().item())

        start_date = pd.to_datetime(ds.time.values[0])
        end_date = pd.to_datetime(ds.time.values[-1])
        min_depth = float(ds.depth.min().item()) if 'depth' in ds else None
        max_depth = float(ds.depth.max().item()) if 'depth' in ds else None

        # Conectar a la base de datos
        conn = connect_db()
        if not conn:
            return

        cur = conn.cursor()

        # Comprobar si el dataset_id ya existe
        cur.execute("SELECT id FROM datasets WHERE dataset_id = %s;", (dataset_id,))
        existing_dataset = cur.fetchone()

        if existing_dataset:
            print(f"El dataset {dataset_id} ya existe en la base de datos. Saltando migración.")
            cur.close()
            conn.close()
            return  # Si el dataset ya existe, se salta la migración

        # Insertar metadatos en la tabla datasets
        cur.execute(""" 
            INSERT INTO datasets (dataset_id, description, min_lon, max_lon, min_lat, max_lat, start_date, end_date, min_depth, max_depth)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (dataset_id, "Descripción del dataset", min_lon, max_lon, min_lat, max_lat, start_date, end_date, min_depth, max_depth))
        dataset_id_db = cur.fetchone()[0]

        # Insertar metadatos en la tabla metadata
        cur.execute(""" 
            INSERT INTO metadata (dataset_id, file_path) 
            VALUES (%s, %s);
        """, (dataset_id_db, str(nc_file)))
        
        # Iterar sobre las variables y almacenarlas en la tabla variables
        for var_name in ds.data_vars:
            unit = "unidad"  # Cambia según el contenido de tu dataset
            description = f"Descripción de {var_name}"  # Ajusta la descripción si es necesario
            cur.execute(""" 
                INSERT INTO variables (dataset_id, variable_name, unit, description)
                VALUES (%s, %s, %s, %s) RETURNING id;
            """, (dataset_id_db, var_name, unit, description))
            variable_id = cur.fetchone()[0]

            # Extraer los datos para la variable
            var_data = ds[var_name].values

            # Insertar los valores en la tabla datos_marinos
            for t, lat, lon, depth, value in zip(ds.time.values, ds[lat_var].values, ds[lon_var].values, ds.depth.values if 'depth' in ds else [None]*len(ds[lat_var]), var_data.flatten()):
                cur.execute(""" 
                    INSERT INTO datos_marinos (dataset_id, variable_id, fecha_hora, latitud, longitud, profundidad, valor)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (dataset_id_db, variable_id, pd.to_datetime(t), float(lat), float(lon), float(depth) if depth is not None else None, float(value)))

        # Confirmar los cambios y cerrar la conexión
        conn.commit()
        cur.close()
        conn.close()

        print(f"Datos de {nc_file} migrados a PostGIS y archivo eliminado.")
        
        # Eliminar el archivo .nc original
        os.remove(nc_file)
        print(f"Archivo {nc_file} eliminado.")

        # Liberar memoria explícitamente
        del ds
        gc.collect()

    except Exception as e:
        print(f"Error al migrar {nc_file} a PostGIS: {e}")
        traceback.print_exc()  # Mostrar más detalles del error

# Procesar los archivos secuencialmente
for nc_file in nc_files:
    migrate_nc_to_postgis(nc_file)
