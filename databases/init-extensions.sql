-- Script de inicialización para habilitar extensiones en PostgreSQL
-- Este script se ejecuta automáticamente al crear el contenedor

\c gloria

-- Crear esquema si no existe
CREATE SCHEMA IF NOT EXISTS gloria;

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Configurar TimescaleDB
ALTER DATABASE gloria SET timescaledb.telemetry_level = off;

-- Verificar instalación
SELECT PostGIS_Version();
SELECT default_version, installed_version
FROM pg_available_extensions
WHERE name = 'timescaledb';

-- Mensaje de éxito
\echo '✓ Extensiones PostGIS y TimescaleDB instaladas correctamente'
\echo '✓ Esquema gloria creado'
