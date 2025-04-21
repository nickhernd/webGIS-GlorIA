from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timedelta
import numpy as np
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from .models.escape_prediction_model import EscapePredictionModel

app = FastAPI(title="GlorIA - Predicción de Riesgo de Escapes")

# Instanciar el modelo
model = EscapePredictionModel()

# Conexión a la base de datos
def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "gloria"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"), 
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432")
    )

# Modelo de datos para la respuesta
class RiskResponse(BaseModel):
    piscifactoria_id: int
    piscifactoria_nombre: str
    fecha_analisis: str
    probabilidad: float
    nivel: str
    indice: float
    factores: List[dict]

@app.get("/risk/{piscifactoria_id}", response_model=RiskResponse)
async def get_risk_assessment(piscifactoria_id: int):
    """
    Obtiene la evaluación de riesgo actual para una piscifactoría específica.
    Basado en los datos de altura de olas actual y del día anterior.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Obtener información de la piscifactoría
        cursor.execute("""
            SELECT id, nombre FROM gloria.piscifactorias WHERE id = %s
        """, (piscifactoria_id,))
        
        farm = cursor.fetchone()
        if not farm:
            raise HTTPException(status_code=404, detail="Piscifactoría no encontrada")
        
        # Obtener datos de altura de olas y corrientes más recientes
        cursor.execute("""
            SELECT 
                v1.variable_nombre, 
                v1.valor, 
                v1.fecha_tiempo 
            FROM gloria.variables_ambientales v1
            JOIN (
                SELECT 
                    variable_nombre, 
                    MAX(fecha_tiempo) as max_fecha 
                FROM gloria.variables_ambientales 
                WHERE piscifactoria_id = %s
                AND variable_nombre IN ('uo', 'vo')
                GROUP BY variable_nombre
            ) v2 ON v1.variable_nombre = v2.variable_nombre AND v1.fecha_tiempo = v2.max_fecha
            WHERE v1.piscifactoria_id = %s
        """, (piscifactoria_id, piscifactoria_id))
        
        current_data = cursor.fetchall()
        
        # Extraer los valores
        current_u = next((item['valor'] for item in current_data if item['variable_nombre'] == 'uo'), 0)
        current_v = next((item['valor'] for item in current_data if item['variable_nombre'] == 'vo'), 0)
        
        # Calcular la magnitud de la velocidad
        current_velocity = np.sqrt(current_u**2 + current_v**2)
        
        # Obtener datos de olas (hoy y ayer)
        cursor.execute("""
            SELECT 
                fecha_tiempo, 
                valor 
            FROM gloria.variables_ambientales 
            WHERE piscifactoria_id = %s 
            AND variable_nombre = 'wave_height'
            ORDER BY fecha_tiempo DESC 
            LIMIT 2
        """, (piscifactoria_id,))
        
        wave_data = cursor.fetchall()
        
        # Si no hay suficientes datos, usar valores simulados
        if len(wave_data) < 2:
            current_wave = 1.5
            prev_day_wave = 1.2
            temperatura = 22
        else:
            current_wave = wave_data[0]['valor']
            prev_day_wave = wave_data[1]['valor']
            
            # Obtener temperatura
            cursor.execute("""
                SELECT valor 
                FROM gloria.variables_ambientales 
                WHERE piscifactoria_id = %s 
                AND variable_nombre = 'temperature'
                ORDER BY fecha_tiempo DESC 
                LIMIT 1
            """, (piscifactoria_id,))
            
            temp_data = cursor.fetchone()
            temperatura = temp_data['valor'] if temp_data else 22
        
        cursor.close()
        conn.close()
        
        # Calcular el riesgo
        risk_assessment = model.get_risk_assessment(
            wave_height=current_wave,
            prev_day_wave_height=prev_day_wave,
            temperature=temperatura,
            current_velocity=current_velocity
        )
        
        # Crear respuesta
        return {
            "piscifactoria_id": piscifactoria_id,
            "piscifactoria_nombre": farm['nombre'],
            "fecha_analisis": datetime.now().isoformat(),
            "probabilidad": risk_assessment["probabilidad"],
            "nivel": risk_assessment["nivel"],
            "indice": risk_assessment["indice"],
            "factores": risk_assessment["factores"]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular riesgo: {str(e)}")

@app.get("/predict/{piscifactoria_id}")
async def get_prediction(piscifactoria_id: int, days: int = Query(7, ge=1, le=14)):
    """
    Genera una predicción de riesgo para los próximos días para una piscifactoría específica
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Obtener información de la piscifactoría
        cursor.execute("""
            SELECT id, nombre FROM gloria.piscifactorias WHERE id = %s
        """, (piscifactoria_id,))
        
        farm = cursor.fetchone()
        if not farm:
            raise HTTPException(status_code=404, detail="Piscifactoría no encontrada")
        
        # Obtener datos históricos de olas
        cursor.execute("""
            SELECT fecha_tiempo, valor 
            FROM gloria.variables_ambientales 
            WHERE piscifactoria_id = %s 
            AND variable_nombre = 'wave_height'
            ORDER BY fecha_tiempo DESC 
            LIMIT 7
        """, (piscifactoria_id,))
        
        historical_waves = cursor.fetchall()
        
        # Simular datos de predicción
        predictions = []
        now = datetime.now()
        
        # Usar el último valor conocido como base
        last_wave = historical_waves[0]['valor'] if historical_waves else 1.5
        last_temperature = 22
        last_current = 0.3
        
        # Simulamos un escenario meteorológico realista: una tormenta que llega en 3 días
        for i in range(days):
            date = now + timedelta(days=i)
            
            # Simular una tormenta que llega, alcanza su pico y luego disminuye
            if i < 3:  # Llegada de la tormenta
                wave_factor = 1 + (i * 0.4)  # Aumento gradual
            elif i < 5:  # Pico de la tormenta
                wave_factor = 2.2  # Olas altas
            else:  # Disminución
                wave_factor = 2.2 - ((i - 5) * 0.3)
                wave_factor = max(1, wave_factor)  # No bajar de 1
            
            # Calcular altura de olas simulada
            simulated_wave = last_wave * wave_factor
            
            # Si tenemos el día anterior, usarlo para predicción
            if i > 0:
                prev_day_wave = predictions[i-1]['wave_height']
            else:
                prev_day_wave = last_wave
            
            # Obtener evaluación de riesgo
            risk = model.get_risk_assessment(
                wave_height=simulated_wave,
                prev_day_wave_height=prev_day_wave,
                temperature=last_temperature,
                current_velocity=last_current
            )
            
            # Añadir predicción
            predictions.append({
                "fecha": date.isoformat(),
                "wave_height": round(simulated_wave, 2),
                "prev_day_wave": round(prev_day_wave, 2),
                "current": round(last_current, 2),
                "temperature": round(last_temperature, 1),
                "probabilidad": risk["probabilidad"],
                "nivel": risk["nivel"],
                "indice": risk["indice"]
            })
        
        cursor.close()
        conn.close()
        
        return {
            "piscifactoria_id": piscifactoria_id,
            "piscifactoria_nombre": farm['nombre'],
            "predicciones": predictions
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar predicción: {str(e)}")