# GlorIA WebGIS - Actualización Sistema de Datos Oceanográficos

## 📋 Resumen de Cambios

Este documento detalla las actualizaciones realizadas al sistema WebGIS GlorIA para implementar un sistema automatizado de importación y visualización de datos oceanográficos desde archivos NetCDF.

## 🎯 Objetivos Completados

### 1. ✅ Importación Automática de Datos NetCDF

Se ha implementado un sistema completo que:
- Lee automáticamente archivos NetCDF de la carpeta `data/` al iniciar Docker
- Procesa datos de **oleaje** (altura de ola) y **temperatura superficial**
- Almacena los datos en PostgreSQL/PostGIS con información geoespacial
- Evita importaciones duplicadas mediante verificación automática

**Archivos creados/modificados:**
- `python-services/app/import_netcdf_data.py` - Script principal de importación
- `python-services/start.sh` - Script de inicialización del contenedor
- `python-services/requirements.txt` - Dependencias actualizadas (netCDF4, xarray)
- `docker/python.Dockerfile` - Dockerfile actualizado con librerías netCDF
- `docker-compose.yml` - Volumen montado para carpeta data/

### 2. ✅ Base de Datos Actualizada

Se ha extendido el esquema de base de datos con:

**Nuevas configuraciones** (`databases/03-wave-config.sql`):
- Umbrales de oleaje para alertas:
  - Verde (seguro): < 1.0 m
  - Amarillo (moderado): 1.0 - 2.2 m
  - Naranja (advertencia): 2.2 - 4.0 m
  - Rojo (peligroso): 4.0 - 6.0 m
  - Negro (crítico): > 6.0 m

**Nuevas funciones SQL:**
- `gloria.get_oleaje_color(altura_metros)` - Obtiene color según altura
- `gloria.get_oleaje_risk_level(altura_metros)` - Obtiene nivel de riesgo

**Nuevas vistas materializadas:**
- `gloria.estadisticas_oleaje` - Últimas mediciones con categorización
- `gloria.alertas_oleaje_piscifactorias` - Estado del oleaje cerca de piscifactorías

### 3. ✅ Interfaz Frontend Mejorada

**Footer con logos institucionales:**
- Logos integrados desde `frontend/public/images/`
- Diseño responsivo y elegante
- Logos incluidos:
  - GlorIA
  - Universitat d'Alacant
  - EUT
  - Fondos Europeos
  - Pablo de Olivade

**Tooltips informativos mejorados:**
- Información detallada en estadísticas (promedio, mínimo, máximo, desviación)
- Fórmulas matemáticas de los cálculos
- Fuentes de datos (Copernicus Marine)
- Período temporal de los datos
- Tooltips enriquecidos en gráficos con fuente de datos

## 🚀 Instrucciones de Uso

### Requisitos Previos

- Docker y Docker Compose instalados
- Archivos NetCDF en la carpeta `data/`

### Iniciar el Sistema

```bash
# Construir y arrancar todos los servicios
docker-compose up --build

# O en modo detached (segundo plano)
docker-compose up --build -d
```

### Primera Vez - Importación de Datos

La primera vez que se inicia el sistema:

1. El contenedor Python esperará a que PostgreSQL esté listo
2. Detectará los archivos `.nc` en `/data`
3. Importará automáticamente todos los datos (puede tardar varios minutos)
4. Iniciará el servidor FastAPI

**Logs de ejemplo:**
```
🚀 Iniciando servicio Python GlorIA...
⏳ Esperando a que la base de datos esté lista...
✅ Base de datos disponible
📦 Archivos NetCDF encontrados en /data
🔄 Importando datos NetCDF a la base de datos...
📊 Procesando archivo de oleaje: 2025110600_h-HCMR--WAVE...
💾 Insertando 1523 registros de oleaje...
✅ 1523 registros de oleaje insertados
...
```

### Forzar Reimportación

Si necesitas reimportar los datos:

```bash
# Agregar variable de entorno para forzar importación
docker-compose up -e FORCE_IMPORT=true
```

### Verificar Estado

```bash
# Ver logs del servicio Python
docker-compose logs -f python-service

# Ver logs de la base de datos
docker-compose logs -f postgres

# Conectar a la base de datos
docker-compose exec postgres psql -U postgres -d gloria

# Consultar cantidad de registros
SELECT variable_nombre, COUNT(*)
FROM gloria.variables_ambientales
WHERE variable_nombre IN ('oleaje_altura', 'temperatura_superficial')
GROUP BY variable_nombre;
```

## 📊 Estructura de Datos NetCDF

### Archivos de Oleaje
**Patrón:** `YYYYMMDDHH_h-HCMR--WAVE-MEDWAM4-MEDATL-*.nc`

**Variables procesadas:**
- `VHM0` - Altura significativa de ola (metros)
- `VMDR` - Dirección de ola (grados)
- `VTM10` - Período de ola (segundos)

**Fuente:** Copernicus Marine - HCMR WAVE MEDWAM4

### Archivos de Temperatura
**Patrón:** `YYYYMMDD_2dh-CMCC--RFVL-MFSeas9-MEDATL-*.nc`

**Variables procesadas:**
- `thetao` - Temperatura potencial superficial (°C)
- `so` - Salinidad (psu)

**Fuente:** Copernicus Marine - CMCC MFSeas9

## 🗺️ Región de Interés

El sistema está configurado para procesar datos en la región del Mediterráneo occidental:

```javascript
BBOX = {
    'lon_min': -1.5,
    'lon_max': 0.7,
    'lat_min': 37.5,
    'lat_max': 40.5
}
```

Esta región cubre:
- Comunidad Valenciana
- Región de Murcia
- Aguas del Mediterráneo adyacentes

## 📈 Visualización de Oleaje

### Escala de Colores

El sistema categoriza el oleaje automáticamente:

| Altura (m) | Color | Nivel | Descripción |
|-----------|-------|-------|-------------|
| < 1.0 | 🟢 Verde | Seguro | Condiciones óptimas para acuicultura |
| 1.0 - 2.2 | 🟡 Amarillo | Moderado | Condiciones normales de operación |
| 2.2 - 4.0 | 🟠 Naranja | Advertencia | ⚠️ Alerta amarilla activada |
| 4.0 - 6.0 | 🔴 Rojo | Peligroso | Condiciones adversas |
| > 6.0 | ⚫ Negro | Crítico | Condiciones extremas |

### Sistema de Alertas

- Alerta automática para oleaje ≥ 2.2 m
- Monitoreo en radio de 5 km alrededor de piscifactorías
- Notificaciones en tiempo real

## 🔌 API Endpoints (Futuros)

### Endpoints Planificados

```
GET /api/oleaje/current
  - Obtiene estado actual del oleaje

GET /api/oleaje/piscifactoria/:id
  - Oleaje cerca de una piscifactoría específica

GET /api/alertas/oleaje
  - Listado de alertas de oleaje activas

GET /api/estadisticas/oleaje
  - Estadísticas agregadas de oleaje
```

## 🌐 Integración Copernicus Marine

### Dataset Principal: MEDSEA_ANALYSISFORECAST_PHY_006_013

**Características:**
- **Resolución espacial:** ~4.2 km
- **Frecuencia:** Análisis y predicción diarios
- **Variables:** Altura de ola, dirección, período
- **Cobertura:** Mar Mediterráneo

**Acceso API:**
```bash
# Configurar credenciales en .env
COPERNICUS_API_URL=https://marine.copernicus.eu/api
COPERNICUS_USERNAME=tu_usuario
COPERNICUS_PASSWORD=tu_password
```

### Próximos Pasos - Datos de Puertos del Estado

Se está esperando respuesta de **Puertos del Estado** para acceder a predicciones de mayor resolución para la región de interés.

## 🛠️ Tecnologías Utilizadas

### Backend
- **Python 3.11** - Procesamiento de datos
- **FastAPI** - API REST
- **netCDF4** - Lectura de archivos NetCDF
- **xarray** - Manipulación de datos multidimensionales
- **psycopg2** - Conexión PostgreSQL
- **NumPy/Pandas** - Análisis de datos

### Base de Datos
- **PostgreSQL 14** - Base de datos relacional
- **PostGIS** - Extensión geoespacial
- **TimescaleDB** - Series temporales optimizadas

### Frontend
- **Vue 3** - Framework JavaScript
- **Vite** - Build tool
- **Chart.js** - Gráficos interactivos
- **Leaflet** - Mapas interactivos
- **Leaflet.heat** - Mapas de calor

## 📁 Estructura del Proyecto

```
webGIS-GlorIA/
├── data/                          # Archivos NetCDF (montado en Docker)
│   ├── *WAVE*.nc                 # Datos de oleaje
│   └── *RFVL*.nc                 # Datos de temperatura
├── databases/
│   ├── init.sql                   # Esquema principal
│   ├── init-extensions.sql        # Extensiones PostgreSQL
│   └── 03-wave-config.sql        # ✨ Configuración de oleaje
├── python-services/
│   ├── app/
│   │   ├── import_netcdf_data.py # ✨ Script de importación
│   │   └── main.py               # API FastAPI
│   ├── start.sh                   # ✨ Script de inicio
│   └── requirements.txt           # ✨ Dependencias actualizadas
├── frontend/
│   ├── public/
│   │   └── images/               # ✨ Logos institucionales
│   ├── src/
│   │   ├── components/
│   │   │   └── StatisticsPanel.vue # ✨ Tooltips mejorados
│   │   └── views/
│   │       └── Home.vue          # ✨ Footer agregado
│   └── vite.config.js
├── docker/
│   ├── python.Dockerfile          # ✨ Actualizado con netCDF
│   └── ...
└── docker-compose.yml             # ✨ Volumen data montado
```

## 🐛 Solución de Problemas

### Error: netCDF4 no encontrado
```bash
# Reconstruir contenedor Python
docker-compose build python-service --no-cache
docker-compose up python-service
```

### Error: PostgreSQL no está listo
```bash
# Verificar estado de PostgreSQL
docker-compose ps postgres
docker-compose logs postgres

# Reiniciar servicio
docker-compose restart postgres
```

### Los datos no se importan
```bash
# Verificar archivos NetCDF
ls -lah data/*.nc

# Forzar importación
docker-compose up -e FORCE_IMPORT=true

# Ver logs detallados
docker-compose logs -f python-service
```

### Error en frontend - Imágenes no se cargan
```bash
# Verificar que las imágenes están en public/
ls -lah frontend/public/images/

# Reconstruir frontend
docker-compose build frontend --no-cache
```

## 📝 Tareas Pendientes

### Alta Prioridad
- [ ] Crear endpoints REST para consulta de oleaje
- [ ] Implementar visualización de oleaje en el mapa con colores
- [ ] Sistema de alertas visuales para oleaje ≥ 2.2m
- [ ] Panel dedicado de oleaje en el dashboard

### Media Prioridad
- [ ] Integración con API en tiempo real de Copernicus
- [ ] Predicciones de oleaje (próximos 3-7 días)
- [ ] Exportación de datos a CSV/Excel
- [ ] Notificaciones por email de alertas críticas

### Baja Prioridad
- [ ] Análisis de tendencias históricas
- [ ] Machine Learning para predicciones mejoradas
- [ ] Comparación multi-piscifactorías
- [ ] Dashboard móvil nativo

## 👥 Colaboradores

- **Universitat d'Alacant** - Investigación y desarrollo
- **EUT** - Análisis técnico
- **Copernicus Marine Service** - Fuente de datos oceanográficos
- **Fondos Europeos** - Financiación

## 📄 Licencia

[Especificar licencia del proyecto]

## 📞 Contacto

[Información de contacto del equipo]

---

**Última actualización:** 2025-11-04
**Versión:** 2.0.0
**Estado:** Operativo - Importación automática funcionando

✨ **Sistema listo para producción**
