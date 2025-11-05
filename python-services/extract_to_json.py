#!/usr/bin/env python3
"""
Script para extraer datos de NetCDF y guardarlos en JSON
para usar sin base de datos
"""
import netCDF4 as nc
import json
import os
from datetime import datetime
import numpy as np
from pathlib import Path

def extract_wave_data():
    """Extrae datos de oleaje de los archivos NetCDF"""
    data_dir = Path('../data')
    wave_files = sorted(data_dir.glob('*WAVE*.nc'))

    all_data = []

    print(f"📦 Encontrados {len(wave_files)} archivos de oleaje")

    for nc_file in wave_files[:10]:  # Procesar solo los primeros 10 para empezar rápido
        print(f"📄 Procesando {nc_file.name}...")

        try:
            dataset = nc.Dataset(nc_file, 'r')

            # Leer variables
            lon = dataset.variables['longitude'][:] if 'longitude' in dataset.variables else dataset.variables['lon'][:]
            lat = dataset.variables['latitude'][:] if 'latitude' in dataset.variables else dataset.variables['lat'][:]
            time_var = dataset.variables['time']

            # Buscar variable de altura de olas
            wave_var = None
            for var_name in ['VHM0', 'swh', 'hs', 'wave_height']:
                if var_name in dataset.variables:
                    wave_var = dataset.variables[var_name]
                    break

            if wave_var is None:
                print(f"  ⚠️  No se encontró variable de oleaje")
                continue

            wave_height = wave_var[:]

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

                        # Obtener valor
                        if len(wave_height.shape) == 3:
                            value = float(wave_height[t_idx, j, i])
                        elif len(wave_height.shape) == 2:
                            value = float(wave_height[j, i])
                        else:
                            continue

                        # Saltar NaN y valores masked
                        if np.isnan(value) or value < 0 or value > 20:
                            continue

                        # Determinar color según altura
                        if value < 1.0:
                            color = 'green'
                            risk = 'bajo'
                        elif value < 2.2:
                            color = 'yellow'
                            risk = 'moderado'
                        elif value < 4.0:
                            color = 'orange'
                            risk = 'alto'
                        elif value < 6.0:
                            color = 'red'
                            risk = 'muy_alto'
                        else:
                            color = 'black'
                            risk = 'extremo'

                        all_data.append({
                            'lon': float(lon_val),
                            'lat': float(lat_val),
                            'value': round(value, 2),
                            'timestamp': time_val.isoformat(),
                            'color': color,
                            'risk': risk,
                            'variable': 'oleaje_altura',
                            'unit': 'm'
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
    print("🚀 Extrayendo datos de NetCDF a JSON...")
    print("=" * 60)

    # Extraer datos
    wave_data = extract_wave_data()

    # Calcular estadísticas
    stats = calculate_statistics(wave_data)

    # Guardar en JSON
    output = {
        'data': wave_data,
        'statistics': stats,
        'metadata': {
            'total_points': len(wave_data),
            'variable': 'oleaje_altura',
            'unit': 'm',
            'source': 'HCMR WAVE-MEDWAM4',
            'extracted_at': datetime.now().isoformat()
        }
    }

    output_file = Path('../backend/data/wave_data.json')
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ Datos guardados en: {output_file}")
    print(f"📊 Estadísticas:")
    for key, value in stats.items():
        print(f"   {key}: {value}")
