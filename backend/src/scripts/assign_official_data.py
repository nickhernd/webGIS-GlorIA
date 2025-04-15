#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv
from pathlib import Path
import logging
from datetime import datetime, timedelta

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("assign_official_data.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("assign_data")

# Función para obtener conexión a la base de datos
def get_db_connection():
    root_dir = Path(os.path.expanduser("~/webGIS-GlorIA"))
    env_path = root_dir / '.env'
    load_dotenv(dotenv_path=env_path)
    
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        logger.info("Conexión a la base de datos establecida")
        return conn
    except Exception as e:
        logger.error(f"Error al conectar a la base de datos: {e}")
        raise

# Función para obtener todas las piscifactorías
def get_all_farms(conn):
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.nombre, ST_X(p.geometria) AS lon, ST_Y(p.geometria) AS lat
            FROM gloria.piscifactorias p
            ORDER BY p.id
        """)
        farms = cursor.fetchall()
        logger.info(f"Encontradas {len(farms)} piscifactorías")
        return farms
    except Exception as e:
        logger.error(f"Error al obtener piscifactorías: {e}")
        return []

# Función para obtener las variables disponibles
def get_available_variables(conn):
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT variable_nombre, COUNT(*) as total
            FROM gloria.variables_ambientales
            WHERE piscifactoria_id IS NULL  -- Solo datos sin asignar a piscifactorías
            GROUP BY variable_nombre
            ORDER BY total DESC
        """)
        variables = cursor.fetchall()
        logger.info(f"Encontradas {len(variables)} variables disponibles")
        return variables
    except Exception as e:
        logger.error(f"Error al obtener variables disponibles: {e}")
        return []

# Función para obtener datos oficiales cercanos para una variable específica
def get_nearest_official_data(conn, variable, lon, lat, max_distance_km=50):
    try:
        cursor = conn.cursor()
        cursor.execute("""
            WITH datos_cercanos AS (
                SELECT 
                    va.id,
                    va.dataset_id,
                    va.fecha_tiempo,
                    va.valor,
                    ST_AsText(va.geometria) as geom_text,
                    va.profundidad,
                    va.calidad,
                    ST_Distance(
                        va.geometria::geography, 
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                    ) as distancia
                FROM gloria.variables_ambientales va
                WHERE va.variable_nombre = %s
                AND va.piscifactoria_id IS NULL
                AND ST_Distance(
                    va.geometria::geography, 
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                ) < %s * 1000  -- Convertir km a metros
                ORDER BY va.fecha_tiempo DESC, distancia ASC
            )
            SELECT DISTINCT ON (DATE(fecha_tiempo)) 
                id, dataset_id, fecha_tiempo, valor, geom_text, profundidad, calidad, distancia
            FROM datos_cercanos
            ORDER BY DATE(fecha_tiempo), distancia ASC
        """, (lon, lat, variable, lon, lat, max_distance_km))
        
        data = cursor.fetchall()
        logger.info(f"Encontrados {len(data)} puntos de datos para {variable} cercanos a ({lon}, {lat})")
        return data
    except Exception as e:
        logger.error(f"Error al obtener datos oficiales para {variable} en ({lon}, {lat}): {e}")
        return []

# Función para asignar datos a una piscifactoría
def assign_official_data_to_farm(conn, farm_id, variable, data_points):
    try:
        cursor = conn.cursor()
        count = 0
        
        # Obtener geometría de la piscifactoría
        cursor.execute("""
            SELECT ST_AsText(geometria) FROM gloria.piscifactorias WHERE id = %s
        """, (farm_id,))
        
        farm_geom_text = cursor.fetchone()[0]
        
        for point in data_points:
            _, dataset_id, fecha_tiempo, valor, _, profundidad, calidad, _ = point
            
            # Asignar a la piscifactoría
            cursor.execute("""
                INSERT INTO gloria.variables_ambientales
                (dataset_id, variable_nombre, fecha_tiempo, valor, piscifactoria_id, geometria, profundidad, calidad)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (variable_nombre, fecha_tiempo, geometria) DO UPDATE
                SET valor = EXCLUDED.valor, calidad = EXCLUDED.calidad
            """, (
                dataset_id,
                variable,
                fecha_tiempo,
                valor,
                farm_id,
                farm_geom_text,
                profundidad,
                calidad
            ))
            
            count += 1
            
            # Commit cada 100 registros
            if count % 100 == 0:
                conn.commit()
        
        # Commit final
        conn.commit()
        logger.info(f"Asignados {count} datos de {variable} a la piscifactoría ID {farm_id}")
        return count
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al asignar datos de {variable} a piscifactoría {farm_id}: {e}")
        return 0

# Función principal
def main():
    conn = None
    try:
        conn = get_db_connection()
        
        # Obtener todas las piscifactorías
        farms = get_all_farms(conn)
        
        # Obtener las variables disponibles
        variables = get_available_variables(conn)
        
        if not variables:
            logger.error("No hay variables disponibles en la base de datos")
            return
        
        logger.info(f"Variables disponibles: {[v[0] for v in variables]}")
        
        # Iniciar contadores
        total_assigned = 0
        farms_processed = 0
        
        # Procesar cada piscifactoría
        for farm in farms:
            farm_id, farm_name, farm_lon, farm_lat = farm
            logger.info(f"Procesando piscifactoría: {farm_name} ({farm_id})")
            
            farm_total = 0
            
            # Procesar cada variable
            for variable_name, _ in variables:
                logger.info(f"Procesando variable {variable_name} para {farm_name}")
                
                # Obtener datos cercanos
                data_points = get_nearest_official_data(conn, variable_name, farm_lon, farm_lat)
                
                # Si no hay suficientes datos, aumentar el radio de búsqueda
                if len(data_points) < 30:
                    data_points = get_nearest_official_data(conn, variable_name, farm_lon, farm_lat, max_distance_km=100)
                
                # Asignar los datos a la piscifactoría
                if data_points:
                    count = assign_official_data_to_farm(conn, farm_id, variable_name, data_points)
                    farm_total += count
                    total_assigned += count
                    
                    logger.info(f"Asignados {count} datos de {variable_name} a {farm_name}")
                else:
                    logger.warning(f"No se encontraron datos cercanos de {variable_name} para {farm_name}")
            
            logger.info(f"Total para {farm_name}: {farm_total} datos asignados")
            farms_processed += 1
            
            # Informar progreso
            logger.info(f"Progreso: {farms_processed}/{len(farms)} piscifactorías procesadas")
        
        logger.info(f"Proceso completado. Total de datos asignados: {total_assigned}")
        
    except Exception as e:
        logger.error(f"Error en el proceso principal: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()