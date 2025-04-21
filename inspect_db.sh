#!/bin/bash

# Script para extraer información detallada de la base de datos Gloria
# Este script debe ejecutarse en el directorio raíz del proyecto

# Configuración de la base de datos
DB_NAME="gloria"
DB_USER="postgres"  # Cambia esto por tu usuario de PostgreSQL
DB_HOST="localhost"
DB_PORT="5432"      # Puerto por defecto de PostgreSQL
OUTPUT_FILE="gloria_db_info.txt"

echo "=== EXTRAYENDO INFORMACIÓN DETALLADA DE LA BASE DE DATOS GLORIA ===" > $OUTPUT_FILE
echo "Fecha de generación: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Función para ejecutar consultas SQL y almacenar la salida en el archivo
run_query() {
  echo "Ejecutando consulta: $1"
  echo "$2" >> $OUTPUT_FILE
  echo "-----------------------------------" >> $OUTPUT_FILE
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$1" >> $OUTPUT_FILE
  echo "" >> $OUTPUT_FILE
}

# 1. Estructura de tablas
echo "ESTRUCTURA DE LA BASE DE DATOS:" >> $OUTPUT_FILE
echo "-----------------------------------" >> $OUTPUT_FILE
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\d gloria.*" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# 2. Piscifactorías registradas
run_query "SELECT id, nombre, tipo, ciudad, provincia, ST_X(geometria) as longitud, ST_Y(geometria) as latitud FROM gloria.piscifactorias ORDER BY nombre;" "PISCIFACTORÍAS REGISTRADAS:"

# 3. Variables ambientales disponibles
run_query "SELECT DISTINCT variable_nombre, COUNT(*) as num_registros, MIN(fecha_tiempo) as fecha_inicio, MAX(fecha_tiempo) as fecha_fin, AVG(valor) as valor_promedio FROM gloria.variables_ambientales GROUP BY variable_nombre ORDER BY variable_nombre;" "VARIABLES AMBIENTALES (RESUMEN):"

# 4. Datasets registrados
run_query "SELECT id, nombre, fuente, dataset_id, variables, fecha_ultima_actualizacion FROM gloria.datasets ORDER BY id;" "DATASETS REGISTRADOS:"

# 5. Alertas activas
run_query "SELECT a.id, a.variable_nombre, a.nivel, a.descripcion, a.fecha_inicio, p.nombre as piscifactoria FROM gloria.alertas a LEFT JOIN gloria.piscifactorias p ON a.piscifactoria_id = p.id WHERE a.activa = true ORDER BY a.fecha_inicio;" "ALERTAS ACTIVAS:"

# 6. Umbrales de alertas configurados
run_query "SELECT clave, valor, descripcion FROM gloria.configuraciones WHERE categoria = 'umbrales' ORDER BY clave;" "UMBRALES CONFIGURADOS:"

# 7. Métricas de rendimiento
run_query "SELECT COUNT(*) as total_registros_ambientales FROM gloria.variables_ambientales;" "MÉTRICAS DE RENDIMIENTO - TOTAL REGISTROS AMBIENTALES:"
run_query "SELECT COUNT(*) as total_alertas FROM gloria.alertas;" "MÉTRICAS DE RENDIMIENTO - TOTAL ALERTAS:"
run_query "SELECT COUNT(*) as total_alertas_activas FROM gloria.alertas WHERE activa = true;" "MÉTRICAS DE RENDIMIENTO - ALERTAS ACTIVAS:"

# 8. Datos más recientes por variable (útil para depuración)
run_query "SELECT DISTINCT ON (variable_nombre) variable_nombre, fecha_tiempo, valor FROM gloria.variables_ambientales ORDER BY variable_nombre, fecha_tiempo DESC LIMIT 10;" "VALORES MÁS RECIENTES POR VARIABLE:"

# 9. Historial de importaciones recientes (para diagnosticar problemas)
run_query "SELECT dataset_id, fecha_inicio, fecha_fin, fecha_importacion, cantidad_registros, estado FROM gloria.importaciones ORDER BY fecha_importacion DESC LIMIT 10;" "IMPORTACIONES RECIENTES:"

echo "" >> $OUTPUT_FILE
echo "=== FIN DEL INFORME ===" >> $OUTPUT_FILE
echo "El informe se ha guardado en $OUTPUT_FILE"