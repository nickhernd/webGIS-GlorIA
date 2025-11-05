#!/bin/bash
set -e

echo "🚀 Iniciando servicio Python GlorIA..."

# Esperar a que la base de datos esté lista
echo "⏳ Esperando a que la base de datos esté lista..."
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "   Base de datos no disponible, esperando..."
  sleep 2
done

echo "✅ Base de datos disponible"

# Verificar si existen archivos NetCDF para importar
if [ -d "/data" ] && [ "$(ls -A /data/*.nc 2>/dev/null)" ]; then
    echo "📦 Archivos NetCDF encontrados en /data"

    # Verificar si ya se han importado datos
    RECORD_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM gloria.variables_ambientales WHERE variable_nombre IN ('oleaje_altura', 'temperatura_superficial');" 2>/dev/null | xargs)

    if [ "$RECORD_COUNT" -eq "0" ] || [ "$FORCE_IMPORT" = "true" ]; then
        echo "🔄 Importando datos NetCDF a la base de datos..."
        python3 /app/app/import_netcdf_data.py
        echo "✅ Importación completada"
    else
        echo "ℹ️  Ya existen $RECORD_COUNT registros en la base de datos"
        echo "ℹ️  Omitiendo importación (use FORCE_IMPORT=true para forzar)"
    fi
else
    echo "⚠️  No se encontraron archivos NetCDF en /data"
fi

# Iniciar el servidor FastAPI
echo "🌐 Iniciando servidor FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
