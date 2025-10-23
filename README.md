# 🐟 GlorIA - Sistema de Monitoreo de Piscifactorías

Sistema de información geográfica web para el monitoreo y análisis de riesgo de piscifactorías marinas, con predicción de escapes basada en variables ambientales.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [API Documentation](#api-documentation)
- [Buenas Prácticas Implementadas](#buenas-prácticas-implementadas)
- [Contribuir](#contribuir)

## ✨ Características

### 🗺️ Visualización Geoespacial
- Mapa interactivo con ubicación de piscifactorías
- Capas de datos ambientales (temperatura, corrientes, olas)
- Visualización de vectores de corrientes
- Heatmaps de riesgo

### 📊 Análisis de Riesgo
- Cálculo de índice de riesgo de escapes
- Análisis basado en múltiples factores ambientales
- Predicciones basadas en datos históricos
- Alertas automáticas según umbrales configurables

### 📈 Monitoreo en Tiempo Real
- Dashboard con métricas clave
- Alertas activas por piscifactoría
- Gráficos de tendencias históricas
- Indicadores ambientales en tiempo real

### 🔄 Integración de Datos
- Copernicus Marine Service API
- OpenWeather API
- Base de datos PostgreSQL con PostGIS

## 🏗️ Arquitectura

### Backend (Node.js/Express)
```
backend/
├── src/
│   ├── config/              # Configuración centralizada
│   │   ├── constants.js     # Constantes y umbrales
│   │   └── config.js        # Variables de entorno
│   │
│   ├── database/            # Capa de base de datos
│   │   └── queries.js       # Queries SQL organizadas
│   │
│   ├── services/            # Lógica de negocio
│   │   ├── riskCalculator.js        # Cálculos de riesgo
│   │   └── piscifactoriasService.js # Gestión de piscifactorías
│   │
│   ├── utils/               # Utilidades
│   │   └── validators.js    # Validación de entrada
│   │
│   ├── routes/              # Rutas API
│   │   └── api.js           # Endpoints REST
│   │
│   ├── db.js                # Pool de conexiones PostgreSQL
│   ├── app.js               # Configuración Express
│   └── server.js            # Punto de entrada
```

### Frontend (Vue 3)
```
frontend/
├── src/
│   ├── views/               # Vistas principales
│   ├── components/          # Componentes reutilizables
│   ├── services/            # Servicios de API
│   ├── router/              # Configuración de rutas
│   └── assets/              # Assets estáticos
```

## 📁 Estructura del Proyecto

```
webGIS-GlorIA/
├── backend/
│   ├── src/
│   │   ├── config/          # ⚙️ Configuración
│   │   ├── database/        # 💾 Acceso a datos
│   │   ├── services/        # 🔧 Lógica de negocio
│   │   ├── routes/          # 🛣️ Endpoints API
│   │   └── utils/           # 🛠️ Utilidades
│   │
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── views/           # 📄 Páginas
│   │   ├── components/      # 🧩 Componentes
│   │   └── services/        # 🌐 Llamadas API
│   │
│   └── package.json
│
├── .env.example             # 📝 Plantilla de variables de entorno
├── .gitignore               # 🚫 Archivos ignorados
└── README.md                # 📖 Este archivo
```

## 📦 Requisitos

### Software Requerido
- **Node.js**: >= 16.x
- **PostgreSQL**: >= 13.x con extensión PostGIS
- **npm** o **yarn**: Gestor de paquetes

### APIs Externas (Opcional)
- Copernicus Marine Service (para datos oceanográficos)
- OpenWeather API (para datos meteorológicos)

## 🚀 Instalación

### 1. Clonar el Repositorio
```bash
git clone https://github.com/tu-usuario/webGIS-GlorIA.git
cd webGIS-GlorIA
```

### 2. Configurar Base de Datos

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE gloria;

# Conectar a la base de datos
\c gloria

# Habilitar extensión PostGIS
CREATE EXTENSION postgis;

# Crear esquema
CREATE SCHEMA gloria;

# Importar esquema (si tienes un archivo SQL)
\i path/to/schema.sql
```

### 3. Instalar Dependencias

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

### 4. Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales
nano .env
```

## ⚙️ Configuración

### Variables de Entorno Críticas

```env
# Base de Datos
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña_segura
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gloria
DB_SCHEMA=gloria

# Servidor
PORT=3000
NODE_ENV=development

# Seguridad
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_ENABLED=true
```

**⚠️ IMPORTANTE**:
- Nunca incluyas el archivo `.env` en el control de versiones
- Usa contraseñas seguras en producción
- Configura `CORS_ORIGIN` apropiadamente en producción

### Constantes y Umbrales

Los umbrales del sistema se encuentran en `/backend/src/config/constants.js`:

```javascript
// Ejemplo de configuración de umbrales
export const OLAS_UMBRALES = {
  OLAS_PEQUENAS: 1.5,   // metros
  OLAS_MEDIANAS: 3.0,   // metros
  OLAS_GRANDES: 3.0     // metros (umbral crítico)
};
```

Puedes modificar estos valores según tus necesidades sin cambiar la lógica del negocio.

## 🎯 Uso

### Modo Desarrollo

#### Backend
```bash
cd backend
npm run dev
```
El servidor estará disponible en `http://localhost:3000`

#### Frontend
```bash
cd frontend
npm run dev
```
El frontend estará disponible en `http://localhost:5173`

### Modo Producción

#### Backend
```bash
cd backend
npm start
```

#### Frontend
```bash
cd frontend
npm run build
# Los archivos se generarán en /frontend/dist
```

## 📡 API Documentation

### Endpoints Principales

#### Piscifactorías
```
GET    /api/piscifactorias          # Listar todas
GET    /api/piscifactorias/:id      # Obtener una específica
```

#### Datos Ambientales
```
GET    /api/datos-ambientales       # Obtener datos ambientales
       ?fecha=2024-01-15
       &variable=temperatura
       &piscifactoriaId=5

GET    /api/historico/:variable     # Histórico de variable
       ?periodo=week
       &piscifactoriaId=5
```

#### Análisis de Riesgo
```
GET    /api/riesgo/resumen           # Resumen de riesgo de todas
GET    /api/riesgo/escapes/:id       # Análisis de riesgo específico
GET    /api/predicciones/escapes/:id # Predicción de escapes
```

#### Alertas
```
GET    /api/alertas                        # Todas las alertas
GET    /api/alertas/piscifactoria/:id      # Alertas por piscifactoría
```

### Formato de Respuesta

Todas las respuestas siguen este formato:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Para errores:
```json
{
  "success": false,
  "error": "Mensaje de error",
  "code": "ERROR_CODE"
}
```

## ✅ Buenas Prácticas Implementadas

### 🏛️ Arquitectura en Capas
- **Separación de responsabilidades**: Rutas → Servicios → Base de datos
- **Lógica de negocio aislada**: Reutilizable y testeable
- **Queries SQL centralizadas**: Fácil mantenimiento

### 📝 Documentación
- **JSDoc completo**: Todas las funciones documentadas
- **Comentarios descriptivos**: Explicando el "por qué"
- **README comprehensivo**: Guía completa de uso

### 🔒 Seguridad
- **Variables de entorno**: Credenciales nunca en código
- **Validación de entrada**: Todas las rutas validadas
- **Queries parametrizadas**: Prevención de SQL injection
- **Rate limiting**: Protección contra abuso

### 🧩 Modularidad
- **Constantes centralizadas**: Sin "magic numbers"
- **Configuración unificada**: Un solo punto de configuración
- **Funciones pequeñas y enfocadas**: Principio de responsabilidad única

### 🛠️ Mantenibilidad
- **Código DRY**: Sin duplicación
- **Funciones puras**: Predecibles y testeables
- **Nombres descriptivos**: Auto-documentación

### 📊 Monitoreo
- **Logging estructurado**: Errores y eventos importantes
- **Métricas de rendimiento**: Detección de queries lentas
- **Manejo graceful de errores**: Recuperación sin crashes

## 🤝 Contribuir

### Workflow de Contribución

1. **Fork** el repositorio
2. **Crea una rama** para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. **Abre un Pull Request**

### Estándares de Código

- Usa **JSDoc** para documentar funciones
- Sigue las convenciones de nombres existentes
- Escribe **tests** para nuevas funcionalidades
- Mantén funciones pequeñas (< 50 líneas idealmente)
- Usa **constantes** en lugar de valores hardcodeados

## 👥 Equipo

**GlorIA Team**
- Desarrollo y mantenimiento del sistema

## 🙏 Agradecimientos

- **Copernicus Marine Service** - Datos oceanográficos
- **OpenWeather** - Datos meteorológicos
- **Leaflet** - Biblioteca de mapas
- **Vue.js** - Framework frontend
- **Express.js** - Framework backend

---

**Nota**: Este proyecto está en desarrollo activo. Las funcionalidades y la API pueden cambiar.

Última actualización: Enero 2025
