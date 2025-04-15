#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modelo de predicción de riesgo de escapes en piscifactorías basado en el paper:
"CLIMATE-DRIVEN FORCAST OF ESCAPES IN MEDITERRANEAN FINFISH AQUACULTURE"

Este script:
1. Obtiene datos históricos de altura de olas y corrientes
2. Implementa modelos de predicción para calcular el riesgo de escape
3. Genera alertas cuando se detecta un riesgo elevado
4. Guarda las predicciones en la base de datos

Fecha: Abril 2025
"""

import os
import sys
import logging
import psycopg2
import numpy as np
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("escape_prediction.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constantes
ROOT_DIR = Path(os.path.expanduser("~/webGIS-GlorIA"))

def setup_environment():
    """Configura el entorno y carga las credenciales de base de datos."""
    env_path = ROOT_DIR / '.env'
    load_dotenv(dotenv_path=env_path)
    
    required_vars = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    for var in required_vars:
        if not os.getenv(var):
            logger.error(f"La variable de entorno {var} no está configurada")
            raise ValueError(f"La variable de entorno {var} no está configurada")
    
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

def get_marine_data(conn, piscifactoria_id, days_back=30):
    """
    Obtiene datos de altura de olas y corrientes para una piscifactoría.
    Según el paper, estos son los principales factores de riesgo.
    """
    try:
        cursor = conn.cursor()
        
        # Fecha inicial para obtener datos
        start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        
        # Obtener datos de corrientes (uo, vo)
        cursor.execute("""
            SELECT 
                fecha_tiempo, 
                variable_nombre, 
                valor
            FROM gloria.variables_ambientales
            WHERE piscifactoria_id = %s
            AND variable_nombre IN ('uo', 'vo')
            AND fecha_tiempo >= %s
            ORDER BY fecha_tiempo
        """, (piscifactoria_id, start_date))
        
        current_data = cursor.fetchall()
        
        # Obtener datos de altura de olas si están disponibles
        # En el paper, la altura de olas es el factor más importante
        cursor.execute("""
            SELECT 
                fecha_tiempo, 
                variable_nombre, 
                valor
            FROM gloria.variables_ambientales
            WHERE piscifactoria_id = %s
            AND variable_nombre IN ('wave_height', 'altura_olas', 'significant_wave_height')
            AND fecha_tiempo >= %s
            ORDER BY fecha_tiempo
        """, (piscifactoria_id, start_date))
        
        wave_data = cursor.fetchall()
        
        # Si no hay datos de olas, intentar usar datos de viento como proxy
        if len(wave_data) == 0:
            logger.warning(f"No hay datos de altura de olas para piscifactoría {piscifactoria_id}. Usando viento como proxy.")
            
            cursor.execute("""
                SELECT 
                    fecha_tiempo, 
                    variable_nombre, 
                    valor
                FROM gloria.variables_ambientales
                WHERE piscifactoria_id = %s
                AND variable_nombre IN ('wind_speed', 'velocidad_viento')
                AND fecha_tiempo >= %s
                ORDER BY fecha_tiempo
            """, (piscifactoria_id, start_date))
            
            wind_data = cursor.fetchall()
            
            # Convertir velocidad del viento a altura de olas (aproximación)
            # Usando la relación de Beaufort: h ≈ 0.02 * v^2 (v en m/s, h en m)
            wave_data = []
            for date, var_name, wind_speed in wind_data:
                # Estimar altura de olas basado en velocidad del viento
                wave_height = 0.02 * (wind_speed ** 2)
                wave_data.append((date, 'estimated_wave_height', wave_height))
        
        # Convertir a DataFrame para facilitar el análisis
        df_currents = pd.DataFrame(current_data, columns=['fecha', 'variable', 'valor'])
        df_waves = pd.DataFrame(wave_data, columns=['fecha', 'variable', 'valor'])
        
        return df_currents, df_waves
        
    except Exception as e:
        logger.error(f"Error al obtener datos marinos: {e}")
        return pd.DataFrame(), pd.DataFrame()

def prepare_data_for_prediction(df_currents, df_waves):
    """
    Prepara los datos para el modelo de predicción.
    
    Según el paper, necesitamos:
    1. Altura de olas actual
    2. Altura de olas del día anterior (muy importante)
    3. Velocidad de corriente
    """
    try:
        # Si no hay datos suficientes, devolver DataFrame vacío
        if df_waves.empty or df_currents.empty:
            logger.warning("Datos insuficientes para preparar predicción")
            return pd.DataFrame()
        
        # Pivotar DataFrame de corrientes para tener uo y vo como columnas
        # Consideramos solo un valor diario (promedio)
        df_currents['fecha_dia'] = pd.to_datetime(df_currents['fecha']).dt.date
        daily_currents = df_currents.pivot_table(
            index='fecha_dia',
            columns='variable',
            values='valor',
            aggfunc='mean'
        ).reset_index()
        
        # Pivotar DataFrame de olas para tener altura de olas como columna
        df_waves['fecha_dia'] = pd.to_datetime(df_waves['fecha']).dt.date
        daily_waves = df_waves.pivot_table(
            index='fecha_dia',
            values='valor',
            aggfunc='mean'
        ).reset_index()
        daily_waves.columns = ['fecha_dia', 'wave_height']
        
        # Combinar dataframes
        merged_df = pd.merge(
            daily_waves,
            daily_currents,
            on='fecha_dia',
            how='outer'
        )
        
        # Ordenar por fecha
        merged_df = merged_df.sort_values('fecha_dia')
        
        # Calcular la magnitud de la corriente si tenemos uo y vo
        if 'uo' in merged_df.columns and 'vo' in merged_df.columns:
            merged_df['current_magnitude'] = np.sqrt(merged_df['uo']**2 + merged_df['vo']**2)
        
        # Crear características para el día anterior
        merged_df['prev_day_wave'] = merged_df['wave_height'].shift(1)
        
        # Según el paper, el día anterior tiene mayor importancia
        # Añadir características específicas basadas en el paper
        merged_df['wave_change'] = merged_df['wave_height'] - merged_df['prev_day_wave']
        merged_df['wave_ratio'] = merged_df['wave_height'] / merged_df['prev_day_wave'].replace(0, 0.1)
        
        # Eliminar filas con valores faltantes
        merged_df = merged_df.dropna()
        
        return merged_df
        
    except Exception as e:
        logger.error(f"Error al preparar datos para predicción: {e}")
        return pd.DataFrame()

def calculate_escape_risk(marine_data):
    """
    Calcula el índice de riesgo de escape basado en el paper.
    
    El paper indica que los factores son:
    - Altura de olas del día anterior (peso 0.7)
    - Altura de olas actual (peso 0.3)
    - Velocidad de corriente (peso 0.2)
    """
    try:
        # Si no hay datos suficientes, devolver riesgo bajo
        if marine_data.empty:
            logger.warning("Datos insuficientes para calcular riesgo")
            return {
                'indice_riesgo': 2.0,
                'nivel_riesgo': 'bajo',
                'probabilidad': 0.2,
                'factores': [
                    {
                        'nombre': "Altura de olas (día anterior)",
                        'valor': 0,
                        'unidad': "m",
                        'contribucion': 0,
                        'umbral': 3.0
                    },
                    {
                        'nombre': "Altura de olas actual",
                        'valor': 0,
                        'unidad': "m",
                        'contribucion': 0,
                        'umbral': 3.0
                    },
                    {
                        'nombre': "Velocidad de corriente",
                        'valor': 0,
                        'unidad': "m/s",
                        'contribucion': 0,
                        'umbral': 0.8
                    }
                ]
            }
        
        # Obtener la fila más reciente (último día con datos)
        latest_data = marine_data.iloc[-1]
        
        # Pesos según el paper
        peso_olas_previo = 0.7
        peso_olas_actual = 0.3
        peso_corriente = 0.2
        
        # Altura de olas actual
        altura_olas = latest_data['wave_height']
        
        # Altura de olas del día anterior
        altura_olas_previa = latest_data['prev_day_wave']
        
        # Velocidad de corriente
        velocidad_corriente = latest_data.get('current_magnitude', 0)
        if np.isnan(velocidad_corriente):
            velocidad_corriente = 0
            if 'uo' in latest_data and 'vo' in latest_data:
                velocidad_corriente = np.sqrt(latest_data['uo']**2 + latest_data['vo']**2)
        
        # Calcular contribuciones al riesgo según el paper
        
        # Contribución de altura actual
        if altura_olas < 1.5:
            contribucion_actual = altura_olas / 1.5 * 3  # 0-3 para olas pequeñas
        elif altura_olas < 3:
            contribucion_actual = 3 + (altura_olas - 1.5) / 1.5 * 3  # 3-6 para olas medianas
        else:
            contribucion_actual = 6 + min(4, (altura_olas - 3) * 2)  # 6-10 para olas grandes
        
        # Contribución de altura previa (mayor peso según el paper)
        if altura_olas_previa < 1.5:
            contribucion_previa = altura_olas_previa / 1.5 * 3
        elif altura_olas_previa < 3:
            contribucion_previa = 3 + (altura_olas_previa - 1.5) / 1.5 * 3
        else:
            contribucion_previa = 6 + min(4, (altura_olas_previa - 3) * 2)
        
        # Contribución de corrientes
        if velocidad_corriente < 0.3:
            contribucion_corriente = velocidad_corriente / 0.3 * 3
        elif velocidad_corriente < 0.8:
            contribucion_corriente = 3 + (velocidad_corriente - 0.3) / 0.5 * 4
        else:
            contribucion_corriente = 7 + min(3, (velocidad_corriente - 0.8) * 5)
        
        # Índice combinado
        total_weights = peso_olas_actual + peso_olas_previo + peso_corriente
        indice_riesgo = (
            peso_olas_actual * contribucion_actual + 
            peso_olas_previo * contribucion_previa + 
            peso_corriente * contribucion_corriente
        ) / total_weights
        
        # Limitar a 10
        indice_riesgo = min(10, indice_riesgo)
        
        # Determinar nivel de riesgo
        if indice_riesgo >= 7:
            nivel_riesgo = 'alto'
        elif indice_riesgo >= 3.5:
            nivel_riesgo = 'medio'
        else:
            nivel_riesgo = 'bajo'
        
        # Calcular probabilidad de escape según el paper
        probabilidad_escape = indice_riesgo / 10
        
        # Crear lista de factores que contribuyen al riesgo
        factores = [
            {
                'nombre': "Altura de olas (día anterior)",
                'valor': round(altura_olas_previa, 2),
                'unidad': "m",
                'contribucion': round(contribucion_previa, 1),
                'umbral': 3.0
            },
            {
                'nombre': "Altura de olas actual",
                'valor': round(altura_olas, 2),
                'unidad': "m",
                'contribucion': round(contribucion_actual, 1),
                'umbral': 3.0
            },
            {
                'nombre': "Velocidad de corriente",
                'valor': round(velocidad_corriente, 2),
                'unidad': "m/s",
                'contribucion': round(contribucion_corriente, 1),
                'umbral': 0.8
            }
        ]
        
        return {
            'indice_riesgo': round(indice_riesgo, 1),
            'nivel_riesgo': nivel_riesgo,
            'probabilidad': round(probabilidad_escape, 2),
            'factores': factores
        }
        
    except Exception as e:
        logger.error(f"Error al calcular riesgo de escape: {e}")
        return {
            'indice_riesgo': 2.0,
            'nivel_riesgo': 'bajo',
            'probabilidad': 0.2,
            'factores': [
                {
                    'nombre': "Altura de olas (día anterior)",
                    'valor': 0,
                    'unidad': "m",
                    'contribucion': 0,
                    'umbral': 3.0
                },
                {
                    'nombre': "Altura de olas actual",
                    'valor': 0,
                    'unidad': "m",
                    'contribucion': 0,
                    'umbral': 3.0
                },
                {
                    'nombre': "Velocidad de corriente",
                    'valor': 0,
                    'unidad': "m/s",
                    'contribucion': 0,
                    'umbral': 0.8
                }
            ]
        }

def save_prediction_to_db(conn, piscifactoria_id, risk_data):
    """Guarda la predicción de riesgo en la base de datos."""
    try:
        cursor = conn.cursor()
        
        # Fecha actual
        current_date = datetime.now().date()
        
        # Extraer datos de riesgo
        indice_riesgo = risk_data['indice_riesgo']
        nivel_riesgo = risk_data['nivel_riesgo']
        probabilidad = risk_data['probabilidad']
        
        # Extraer factores
        factores = risk_data['factores']
        altura_olas = next((f['valor'] for f in factores if f['nombre'] == "Altura de olas actual"), 0)
        altura_olas_dia_anterior = next((f['valor'] for f in factores if f['nombre'] == "Altura de olas (día anterior)"), 0)
        velocidad_corriente = next((f['valor'] for f in factores if f['nombre'] == "Velocidad de corriente"), 0)
        
        # Verificar si ya existe una predicción para esta fecha y piscifactoría
        cursor.execute("""
            SELECT id FROM gloria.prediccion_escapes
            WHERE piscifactoria_id = %s AND fecha = %s
        """, (piscifactoria_id, current_date))
        
        existing_prediction = cursor.fetchone()
        
        if existing_prediction:
            # Actualizar predicción existente
            cursor.execute("""
                UPDATE gloria.prediccion_escapes
                SET 
                    altura_olas = %s,
                    altura_olas_dia_anterior = %s,
                    velocidad_corriente = %s,
                    indice_riesgo = %s,
                    nivel_riesgo = %s,
                    prediccion_probabilidad = %s,
                    fecha_prediccion = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (
                altura_olas,
                altura_olas_dia_anterior,
                velocidad_corriente,
                indice_riesgo,
                nivel_riesgo,
                probabilidad,
                existing_prediction[0]
            ))
            
            logger.info(f"Predicción actualizada para piscifactoría {piscifactoria_id}, fecha {current_date}")
            
        else:
            # Insertar nueva predicción
            cursor.execute("""
                INSERT INTO gloria.prediccion_escapes
                (piscifactoria_id, fecha, altura_olas, altura_olas_dia_anterior, 
                 velocidad_corriente, indice_riesgo, nivel_riesgo, prediccion_probabilidad)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                piscifactoria_id,
                current_date,
                altura_olas,
                altura_olas_dia_anterior,
                velocidad_corriente,
                indice_riesgo,
                nivel_riesgo,
                probabilidad
            ))
            
            logger.info(f"Nueva predicción insertada para piscifactoría {piscifactoria_id}, fecha {current_date}")
        
        conn.commit()
        
        # Si el riesgo es alto, generar una alerta
        if nivel_riesgo == 'alto':
            cursor.execute("""
                INSERT INTO gloria.alertas
                (piscifactoria_id, tipo, nivel, descripcion, fecha_inicio, activa, accion_recomendada)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (
                piscifactoria_id,
                'escape_riesgo',
                'crítico' if indice_riesgo > 8 else 'advertencia',
                f"Riesgo elevado de escape de peces. Índice: {indice_riesgo}/10 ({int(indice_riesgo*10)}%)",
                datetime.now(),
                True,
                "Reforzar estructuras, reducir biomasa, verificar anclajes y redes."
            ))
            
            conn.commit()
            logger.warning(f"¡ALERTA! Riesgo alto de escape para piscifactoría {piscifactoria_id}")
        
        return True
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al guardar predicción en base de datos: {e}")
        return False

def generate_predictions_for_all_farms(conn):
    """Genera predicciones para todas las piscifactorías activas."""
    try:
        cursor = conn.cursor()
        
        # Obtener todas las piscifactorías activas
        cursor.execute("""
            SELECT id, nombre, tipo
            FROM gloria.piscifactorias
            WHERE activo = TRUE
        """)
        
        farms = cursor.fetchall()
        logger.info(f"Generando predicciones para {len(farms)} piscifactorías")
        
        predictions = []
        
        for farm_id, farm_name, farm_type in farms:
            # Las piscifactorías marinas son las que tienen riesgo de escape por altura de olas
            if farm_type.lower() in ['marina', 'mar', 'maricultura', 'offshore']:
                logger.info(f"Procesando piscifactoría: {farm_name} (ID: {farm_id})")
                
                # Obtener datos marinos
                df_currents, df_waves = get_marine_data(conn, farm_id)
                
                # Preparar datos para predicción
                marine_data = prepare_data_for_prediction(df_currents, df_waves)
                
                # Calcular riesgo de escape
                risk_data = calculate_escape_risk(marine_data)
                
                # Guardar predicción en la base de datos
                success = save_prediction_to_db(conn, farm_id, risk_data)
                
                if success:
                    predictions.append({
                        'farm_id': farm_id,
                        'farm_name': farm_name,
                        'risk_index': risk_data['indice_riesgo'],
                        'risk_level': risk_data['nivel_riesgo'],
                        'probability': risk_data['probabilidad']
                    })
                    
                    logger.info(f"Predicción generada para {farm_name}: Índice {risk_data['indice_riesgo']}, Nivel {risk_data['nivel_riesgo']}")
            else:
                logger.info(f"Omitiendo piscifactoría {farm_name} por ser de tipo {farm_type}")
        
        return predictions
        
    except Exception as e:
        logger.error(f"Error al generar predicciones: {e}")
        return []

def main():
    """Función principal del script."""
    try:
        # Configurar entorno
        setup_environment()
        
        # Establecer conexión con la base de datos
        conn = get_db_connection()
        
        # Generar predicciones para todas las piscifactorías
        predictions = generate_predictions_for_all_farms(conn)
        
        # Mostrar resumen de predicciones
        print("\n=== RESUMEN DE PREDICCIONES DE RIESGO DE ESCAPE ===")
        print(f"Fecha: {datetime.now().strftime('%Y-%m-%d')}")
        print(f"Total predicciones: {len(predictions)}")
        
        if predictions:
            print("\nNivel de riesgo por piscifactoría:")
            for pred in sorted(predictions, key=lambda x: x['risk_index'], reverse=True):
                print(f"{pred['farm_name']}: {pred['risk_index']}/10 ({pred['risk_level'].upper()}) - Prob: {pred['probability']*100:.1f}%")
        
        # Cerrar conexión
        conn.close()
        
        logger.info("Proceso completado exitosamente")
        
    except Exception as e:
        logger.error(f"Error en el proceso principal: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()