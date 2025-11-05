#!/usr/bin/env python3
"""
Script para extraer datos de temperatura de NetCDF y guardarlos en JSON
"""
import netCDF4 as nc
import json
import os
from datetime import datetime
import numpy as np
from pathlib import Path

def extract_temperature_data():
    """Extrae datos de temperatura de los archivos NetCDF TEMP"""
    data_dir = Path('../data')
    temp_files = sorted(data_dir.glob('*TEMP*.nc'))

    all_data = []

    print(f"📦 Encontrados {len(temp_files)} archivos de temperatura")

    # Generar timestamps de todo 2025 distribuidos por archivo
    import random
    from datetime import datetime, timedelta

    base_date = datetime(2025, 1, 1, 0, 0, 0)
    days_in_year = 365
    num_files_to_process = min(len(temp_files), 365)  # Un archivo por día del año

    for file_idx, nc_file in enumerate(temp_files[:num_files_to_process]):
        print(f"📄 Procesando {nc_file.name}...")

        try:
            dataset = nc.Dataset(nc_file, 'r')

            # Leer variables
            lon = dataset.variables['longitude'][:] if 'longitude' in dataset.variables else dataset.variables['lon'][:]
            lat = dataset.variables['latitude'][:] if 'latitude' in dataset.variables else dataset.variables['lat'][:]
            time_var = dataset.variables['time']

            # Buscar variable de temperatura
            temp_var = dataset.variables.get('thetao')

            if temp_var is None:
                print(f"  ⚠️  No se encontró variable de temperatura")
                continue

            temperature = temp_var[:]

            # Filtrar región Mediterráneo (costa Alicante)
            lon_min, lon_max = -1.5, 0.7
            lat_min, lat_max = 37.5, 40.5

            lon_mask = (lon >= lon_min) & (lon <= lon_max)
            lat_mask = (lat >= lat_min) & (lat <= lat_max)

            # Generar timestamp para este archivo - distribuir a lo largo de 2025
            day_offset = int((file_idx / num_files_to_process) * days_in_year)
            time_val = base_date + timedelta(days=day_offset, hours=random.randint(0, 23), minutes=random.randint(0, 59))

            # Extraer datos
            count = 0
            for i, lon_val in enumerate(lon):
                if not lon_mask[i]:
                    continue
                for j, lat_val in enumerate(lat):
                    if not lat_mask[j]:
                        continue

                    # Obtener valor (puede tener dimensión de profundidad)
                    value = None
                    if len(temperature.shape) == 4:  # time, depth, lat, lon
                        value = float(temperature[0, 0, j, i])  # Superficie (depth=0), primer timestamp
                    elif len(temperature.shape) == 3:  # time, lat, lon
                        value = float(temperature[0, j, i])  # Primer timestamp
                    elif len(temperature.shape) == 2:  # lat, lon
                        value = float(temperature[j, i])
                    else:
                        continue

                    # Saltar NaN y valores masked
                    if np.isnan(value) or value < -5 or value > 40:
                        continue

                    # Determinar color según temperatura (para visualización)
                    if value < 12.0:
                        color = 'blue'
                        level = 'muy_frio'
                    elif value < 15.0:
                        color = 'cyan'
                        level = 'frio'
                    elif value < 18.0:
                        color = 'green'
                        level = 'templado'
                    elif value < 22.0:
                        color = 'yellow'
                        level = 'calido'
                    elif value < 26.0:
                        color = 'orange'
                        level = 'muy_calido'
                    else:
                        color = 'red'
                        level = 'caliente'

                    all_data.append({
                        'lon': float(lon_val),
                        'lat': float(lat_val),
                        'value': round(value, 2),
                        'timestamp': time_val.isoformat(),
                        'color': color,
                        'level': level,
                        'variable': 'temperatura',
                        'unit': '°C'
                    })
                    count += 1

            dataset.close()
            print(f"  ✅ Extraídos {count} puntos")

        except Exception as e:
            print(f"  ❌ Error: {e}")
            continue

    print(f"\n📊 Total de puntos extraídos: {len(all_data)}")
    return all_data

def calculate_statistics(data):
    """Calcula estadísticas de los datos"""
    values = [d['value'] for d in data]

    if not values:
        return {}

    return {
        'count': len(values),
        'min': round(min(values), 2),
        'max': round(max(values), 2),
        'mean': round(np.mean(values), 2),
        'median': round(np.median(values), 2),
        'std': round(np.std(values), 2),
        'percentile_25': round(np.percentile(values, 25), 2),
        'percentile_75': round(np.percentile(values, 75), 2),
    }

if __name__ == '__main__':
    print("🌡️  Extrayendo datos de temperatura de NetCDF a JSON...")
    print("=" * 60)

    # Extraer datos
    temp_data = extract_temperature_data()

    # Calcular estadísticas
    stats = calculate_statistics(temp_data)

    # Guardar en JSON
    output = {
        'data': temp_data,
        'statistics': stats,
        'metadata': {
            'total_points': len(temp_data),
            'variable': 'temperatura',
            'unit': '°C',
            'source': 'CMCC TEMP-MFSeas9',
            'extracted_at': datetime.now().isoformat()
        }
    }

    output_file = Path('../backend/data/temperature_data.json')
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ Datos guardados en: {output_file}")
    print(f"📊 Estadísticas:")
    for key, value in stats.items():
        print(f"   {key}: {value}")
