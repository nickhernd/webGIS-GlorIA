#!/bin/bash
set -e

echo "======================================"
echo "  Setup WebGIS GlorIA (Sin Docker)"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Instalar PostgreSQL y PostGIS
echo -e "${YELLOW}[1/7] Instalando PostgreSQL 16 y PostGIS...${NC}"
sudo apt update
sudo apt install -y postgresql-16 postgresql-16-postgis-3 postgresql-contrib-16 libpq-dev

# 2. Iniciar PostgreSQL
echo -e "${YELLOW}[2/7] Iniciando PostgreSQL...${NC}"
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. Crear base de datos y usuario
echo -e "${YELLOW}[3/7] Creando base de datos 'gloria'...${NC}"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS gloria;"
sudo -u postgres psql -c "CREATE DATABASE gloria;"
sudo -u postgres psql -c "DROP USER IF EXISTS gloriauser;"
sudo -u postgres psql -c "CREATE USER gloriauser WITH PASSWORD 'gloria2025';"
sudo -u postgres psql -c "ALTER DATABASE gloria OWNER TO gloriauser;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gloria TO gloriauser;"

# 4. Ejecutar scripts de inicialización
echo -e "${YELLOW}[4/7] Ejecutando scripts de inicialización...${NC}"
sudo -u postgres psql -d gloria -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d gloria -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"
sudo -u postgres psql -d gloria < databases/init.sql
sudo -u postgres psql -d gloria < databases/03-wave-config.sql

# 5. Instalar dependencias Python (en virtual environment)
echo -e "${YELLOW}[5/7] Instalando dependencias Python...${NC}"
cd python-services

# Crear virtual environment si no existe
if [ ! -d "venv" ]; then
    echo "Creando entorno virtual de Python..."
    python3 -m venv venv
fi

# Activar y instalar dependencias
echo "Instalando dependencias en el entorno virtual..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

cd ..

# 6. Instalar dependencias Backend
echo -e "${YELLOW}[6/7] Instalando dependencias Backend (Node.js)...${NC}"
cd backend
npm install
cd ..

# 7. Instalar dependencias Frontend
echo -e "${YELLOW}[7/7] Instalando dependencias Frontend (Vue.js)...${NC}"
cd frontend
npm install
cd ..

echo ""
echo -e "${GREEN}✅ Instalación completada!${NC}"
echo ""
echo "======================================"
echo "  Próximos pasos:"
echo "======================================"
echo ""
echo "1. Importar datos NetCDF:"
echo "   cd python-services"
echo "   python3 app/import_netcdf_data.py"
echo ""
echo "2. Iniciar Backend (en una terminal):"
echo "   cd backend"
echo "   npm start"
echo ""
echo "3. Iniciar Frontend (en otra terminal):"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "4. Acceder a la aplicación:"
echo "   http://localhost:5173"
echo ""
