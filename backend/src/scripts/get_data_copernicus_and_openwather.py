import os
from dotenv import load_dotenv
import copernicusmarine
from pathlib import Path
from datetime import datetime

# Obtener la fecha de hoy
hoy = datetime.today()

# Establecer la fecha de inicio al 1 de enero del año pasado
fecha_inicio = datetime(hoy.year - 1, 1, 1)
fecha_fin = hoy

# Formatear las fechas al formato que necesita la consulta
fecha_inicio_str = fecha_inicio.strftime("%Y-%m-%dT%H:%M:%S")
fecha_fin_str = fecha_fin.strftime("%Y-%m-%dT%H:%M:%S")

# Ruta al archivo .env
env_path = Path('~/WebGis-GLORiA/.env').expanduser()

# Cargar el archivo .env desde esa ruta
load_dotenv(dotenv_path=env_path)

# Obtener las credenciales
username = os.getenv("COPERNICUS_USERNAME")
password = os.getenv("COPERNICUS_PASSWORD")

# Verificar que las credenciales estén presentes
if not username or not password:
    raise ValueError("Las credenciales de Copernicus Marine no están configuradas en el archivo .env")

# Configurar las credenciales
copernicusmarine.login()

# Ruta de guardado
output_directory = os.path.expanduser("~/WebGis-GLORiA/databases/copernicus_marine")

# Verificar si la ruta existe y si no, crearla
if not os.path.exists(output_directory):
    os.makedirs(output_directory, exist_ok=True)

# Función para descargar y guardar datos
def download_and_save(dataset_id, variables, min_lon, max_lon, min_lat, max_lat, start_date, end_date, min_depth=None, max_depth=None):
    print(f"Descargando datos del dataset: {dataset_id}")
    try:
        # Descargar los datos
        result = copernicusmarine.subset(
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
        
        # Definir el nombre del archivo y la ruta completa
        output_filename = os.path.join(output_directory, f"{dataset_id}.nc")

        # Guardar los datos en la ruta especificada
        with open(output_filename, 'wb') as f:
            f.write(result['data'])  # Asumiendo que los datos son binarios
            print(f"Datos guardados en: {output_filename}")
    except Exception as e:
        print(f"Error al descargar {dataset_id}: {e}")

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
        "start_date": "2025-02-12T00:00:00",
        "end_date": "2025-02-12T00:00:00",
    },
]

# Llamada a la función de descarga para cada dataset
for dataset in datasets:
    download_and_save(
        dataset_id=dataset["id"],
        variables=dataset["variables"],
        min_lon=dataset.get("min_lon"),
        max_lon=dataset.get("max_lon"),
        min_lat=dataset.get("min_lat"),
        max_lat=dataset.get("max_lat"),
        start_date=fecha_inicio_str,
        end_date=fecha_fin_str,
        min_depth=dataset.get("min_depth"),
        max_depth=dataset.get("max_depth"),
    )
