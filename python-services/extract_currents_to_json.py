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
    """Extrae datos de corrientes de los archivos NetCDF RFVL (velocidad como proxy de temperatura)"""
    data_dir = Path('../data')
    temp_files = sorted(data_dir.glob('*RFVL*.nc'))

    all_data = []

    print(f"📦 Encontrados {len(temp_files)} archivos de corrientes")

    for nc_file in temp_files[:10]:  # Procesar solo los primeros 10 para empezar rápido
        print(f"📄 Procesando {nc_file.name}...")

        try:
            dataset = nc.Dataset(nc_file, 'r')

            # Leer variables
            lon = dataset.variables['longitude'][:] if 'longitude' in dataset.variables else dataset.variables['lon'][:]
            lat = dataset.variables['latitude'][:] if 'latitude' in dataset.variables else dataset.variables['lat'][:]
            time_var = dataset.variables['time']

            # Buscar variables de corrientes (uo, vo)
            uo_var = dataset.variables.get('uo')
            vo_var = dataset.variables.get('vo')

            if uo_var is None or vo_var is None:
                print(f"  ⚠️  No se encontraron variables de corrientes")
                continue

            uo = uo_var[:]
            vo = vo_var[:]

            # Filtrar región Mediterráneo (costa Alicante)
            lon_min, lon_max = -1.5, 0.7
            lat_min, lat_max = 37.5, 40.5

            lon_mask = (lon >= lon_min) & (lon <= lon_max)
            lat_mask = (lat >= lat_min) & (lat <= lat_max)

            # Procesar timestamps
            times = nc.num2date(time_var[:], time_var.units)

            # Extraer datos
            count = 0
            for t_idx, time_val in enumerate(times):
                if t_idx >= 1:  # Solo primer timestamp por archivo
                    break

                for i, lon_val in enumerate(lon):
                    if not lon_mask[i]:
                        continue
                    for j, lat_val in enumerate(lat):
                        if not lat_mask[j]:
                            continue

                        # Obtener valores de corrientes (puede tener dimensión de profundidad)
                        uo_val = None
                        vo_val = None

                        if len(uo.shape) == 4:  # time, depth, lat, lon
                            uo_val = float(uo[t_idx, 0, j, i])  # Superficie (depth=0)
                            vo_val = float(vo[t_idx, 0, j, i])
                        elif len(uo.shape) == 3:  # time, lat, lon
                            uo_val = float(uo[t_idx, j, i])
                            vo_val = float(vo[t_idx, j, i])
                        elif len(uo.shape) == 2:  # lat, lon
                            uo_val = float(uo[j, i])
                            vo_val = float(vo[j, i])
                        else:
                            continue

                        # Saltar NaN y valores masked
                        if np.isnan(uo_val) or np.isnan(vo_val):
                            continue

                        # Calcular magnitud de la corriente
                        value = np.sqrt(uo_val**2 + vo_val**2)

                        # Saltar valores extremos
                        if value < 0 or value > 5:
                            continue

                        # Determinar color según velocidad de corriente (en m/s)
                        if value < 0.1:
                            color = 'blue'
                            level = 'muy_lenta'
                        elif value < 0.3:
                            color = 'cyan'
                            level = 'lenta'
                        elif value < 0.5:
                            color = 'green'
                            level = 'moderada'
                        elif value < 0.8:
                            color = 'yellow'
                            level = 'rapida'
                        elif value < 1.2:
                            color = 'orange'
                            level = 'muy_rapida'
                        else:
                            color = 'red'
                            level = 'extrema'

                        all_data.append({
                            'lon': float(lon_val),
                            'lat': float(lat_val),
                            'value': round(value, 3),
                            'uo': round(uo_val, 3),
                            'vo': round(vo_val, 3),
                            'timestamp': time_val.isoformat(),
                            'color': color,
                            'level': level,
                            'variable': 'corriente',
                            'unit': 'm/s'
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
    print("🌊 Extrayendo datos de corrientes de NetCDF a JSON...")
    print("=" * 60)

    # Extraer datos
    current_data = extract_temperature_data()

    # Calcular estadísticas
    stats = calculate_statistics(current_data)

    # Guardar en JSON
    output = {
        'data': current_data,
        'statistics': stats,
        'metadata': {
            'total_points': len(current_data),
            'variable': 'corriente',
            'unit': 'm/s',
            'source': 'CMCC RFVL-MFSeas9',
            'extracted_at': datetime.now().isoformat()
        }
    }

    output_file = Path('../backend/data/current_data.json')
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ Datos guardados en: {output_file}")
    print(f"📊 Estadísticas:")
    for key, value in stats.items():
        print(f"   {key}: {value}")
