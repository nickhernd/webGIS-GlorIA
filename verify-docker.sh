#!/bin/bash

echo "🔍 Verificación de Dockerización - WebGIS GlorIA"
echo "================================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
PASS=0
FAIL=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $2 (no encontrado: $1)"
        FAIL=$((FAIL + 1))
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $2 (no encontrado: $1)"
        FAIL=$((FAIL + 1))
    fi
}

echo "📋 Archivos Docker..."
check_file "docker-compose.yml" "docker-compose.yml"
check_file "docker/python.Dockerfile" "Dockerfile Python"
check_file "docker/backend.Dockerfile" "Dockerfile Backend"
check_file "docker/frontend.Dockerfile" "Dockerfile Frontend"
check_file ".dockerignore" ".dockerignore principal"
check_file "python-services/.dockerignore" ".dockerignore Python"

echo ""
echo "🐍 Servicio Python..."
check_file "python-services/start.sh" "Script de inicio"
check_file "python-services/requirements.txt" "Requirements.txt"
check_file "python-services/app/import_netcdf_data.py" "Script de importación NC"
check_file "python-services/app/main.py" "API FastAPI"

echo ""
echo "💾 Base de Datos..."
check_file "databases/init.sql" "Script de inicialización principal"
check_file "databases/init-extensions.sql" "Extensiones PostgreSQL"
check_file "databases/03-wave-config.sql" "Configuración de oleaje"

echo ""
echo "🎨 Frontend..."
check_dir "frontend/public/images" "Directorio de imágenes"
check_file "frontend/public/images/gloria.png" "Logo GlorIA"
check_file "frontend/public/images/universitat_alacant.png" "Logo UA"
check_file "frontend/src/views/Home.vue" "Vista principal"
check_file "frontend/src/components/StatisticsPanel.vue" "Panel de estadísticas"

echo ""
echo "📦 Datos..."
# check_dir "data" "Directorio data/"

# Verificar archivos NetCDF
NC_COUNT=$(find data -name "*.nc" 2>/dev/null | wc -l)
if [ "$NC_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Archivos NetCDF encontrados: $NC_COUNT"
    PASS=$((PASS + 1))
else
    echo -e "${YELLOW}⚠${NC} No se encontraron archivos NetCDF en data/"
    echo "  (El sistema funcionará, pero no habrá datos para importar)"
fi

echo ""
echo "🔐 Configuración..."
check_file ".env" "Archivo .env"

# Verificar variables críticas en docker-compose
echo ""
echo "🔧 Docker Compose - Volúmenes y configuración..."

if grep -q "./data:/data" docker-compose.yml; then
    echo -e "${GREEN}✓${NC} Volumen data montado correctamente"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} Volumen data no configurado"
    FAIL=$((FAIL + 1))
fi

if grep -q "03-wave-config.sql" docker-compose.yml; then
    echo -e "${GREEN}✓${NC} Script de oleaje configurado"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} Script de oleaje no montado"
    FAIL=$((FAIL + 1))
fi

echo ""
echo "📝 Scripts ejecutables..."
if [ -x "python-services/start.sh" ]; then
    echo -e "${GREEN}✓${NC} start.sh tiene permisos de ejecución"
    PASS=$((PASS + 1))
else
    echo -e "${YELLOW}⚠${NC} start.sh no es ejecutable (se corregirá en Docker)"
    PASS=$((PASS + 1))
fi

echo ""
echo "================================================"
echo -e "Resultado: ${GREEN}${PASS} ✓${NC} | ${RED}${FAIL} ✗${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ Todo listo para ejecutar docker-compose up --build${NC}"
    echo ""
    echo "Comandos recomendados:"
    echo "  docker-compose up --build          # Construir y arrancar"
    echo "  docker-compose up --build -d       # En segundo plano"
    echo "  docker-compose logs -f python-service  # Ver logs de importación"
    exit 0
else
    echo -e "${RED}❌ Hay problemas que necesitan atención${NC}"
    exit 1
fi
