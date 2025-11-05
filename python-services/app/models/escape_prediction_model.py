import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
import joblib
import os

class EscapePredictionModel:
    def __init__(self):
        self.model = self._create_model()
        
    def _create_model(self):
        """Crea un modelo de regresión logística basado en los hallazgos del paper"""
        model = LogisticRegression(random_state=42)
        
        # Los coeficientes se basan en el paper - la altura de olas del día anterior 
        # es el predictor más importante
        # Los resultados indicaron que olas > 3m significativamente aumentan la probabilidad de escapes
        
        # Configurar coeficientes manualmente basados en el paper
        model.classes_ = np.array([0, 1])  # 0=no escape, 1=escape
        model.coef_ = np.array([[0.5, 2.1, 0.3, 0.1]])  # [current_day_waves, prev_day_waves, temperature, currents]
        model.intercept_ = np.array([-4.0])  # Umbral para que predicciones sean razonables
        
        return model
    
    def predict_escape_risk(self, wave_height, prev_day_wave_height, temperature=22, current_velocity=0.3):
        """
        Predice el riesgo de escape basado en altura de olas actual y del día anterior
        
        Args:
            wave_height: Altura de ola actual (m)
            prev_day_wave_height: Altura de ola del día anterior (m)
            temperature: Temperatura del agua (°C)
            current_velocity: Velocidad de corriente (m/s)
            
        Returns:
            Probabilidad de escape (0-1)
        """
        # Crear un array con las variables predictoras
        X = np.array([[wave_height, prev_day_wave_height, temperature, current_velocity]])
        
        # Obtener probabilidad de escape
        escape_prob = self.model.predict_proba(X)[0, 1]
        
        return escape_prob
    
    def get_risk_assessment(self, wave_height, prev_day_wave_height, temperature=22, current_velocity=0.3):
        """
        Genera una evaluación completa del riesgo
        
        Returns:
            Diccionario con información de riesgo
        """
        # Obtener probabilidad de escape
        prob = self.predict_escape_risk(wave_height, prev_day_wave_height, temperature, current_velocity)
        
        # Determinar nivel de riesgo
        risk_level = "bajo"
        if prob > 0.6:
            risk_level = "alto"
        elif prob > 0.3:
            risk_level = "medio"
            
        # Índice de riesgo (0-10)
        risk_index = min(10, round(prob * 10, 1))
        
        # Factores que contribuyen al riesgo
        risk_factors = [
            {
                "nombre": "Altura de olas actual",
                "valor": round(wave_height, 2),
                "unidad": "m",
                "contribucion": min(10, round(wave_height * 2, 1)),
                "umbral": 3.0
            },
            {
                "nombre": "Altura de olas (día anterior)",
                "valor": round(prev_day_wave_height, 2),
                "unidad": "m",
                "contribucion": min(10, round(prev_day_wave_height * 3, 1)),  # Mayor peso basado en el paper
                "umbral": 3.0
            },
            {
                "nombre": "Velocidad de corriente",
                "valor": round(current_velocity, 2),
                "unidad": "m/s",
                "contribucion": min(10, round(current_velocity * 8, 1)),
                "umbral": 0.8
            }
        ]
        
        return {
            "probabilidad": round(float(prob), 4),
            "nivel": risk_level,
            "indice": risk_index,
            "factores": risk_factors
        }