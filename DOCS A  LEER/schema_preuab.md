-- Crear la base de datos
CREATE DATABASE marine_data;

-- Conectar a la base de datos
\c marine_data;

-- Habilitar la extensión PostGIS (para manejar datos geoespaciales)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Crear la tabla de datasets
CREATE TABLE datasets (
    id SERIAL PRIMARY KEY,
    dataset_id VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    min_lon FLOAT,
    max_lon FLOAT,
    min_lat FLOAT,
    max_lat FLOAT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    min_depth FLOAT,
    max_depth FLOAT
);

-- Crear la tabla de variables
CREATE TABLE variables (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(id),
    variable_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50),
    description TEXT
);

-- Crear la tabla de datos marinos
CREATE TABLE datos_marinos (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(id),
    variable_id INTEGER REFERENCES variables(id),
    fecha_hora TIMESTAMP NOT NULL,
    latitud FLOAT NOT NULL,
    longitud FLOAT NOT NULL,
    profundidad FLOAT,
    valor FLOAT NOT NULL
);

-- Crear la tabla de metadatos
CREATE TABLE metadata (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(id),
    download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path VARCHAR(255) NOT NULL
);