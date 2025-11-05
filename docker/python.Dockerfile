# Multi-stage build para optimizar tamaño de imagen

# Etapa 1: Builder
FROM python:3.11-slim AS builder

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Instalar dependencias del sistema para compilación y netCDF4
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libnetcdf-dev \
    libhdf5-dev \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio virtual para dependencias
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias Python en el venv
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Etapa 2: Runtime
FROM python:3.11-slim

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Instalar wget para healthcheck, librerías runtime para netCDF4 y postgresql-client
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    libnetcdf-dev \
    libhdf5-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root para seguridad
RUN useradd -m -u 1001 -s /bin/bash appuser

WORKDIR /app

# Copiar virtual environment desde builder
COPY --from=builder /opt/venv /opt/venv

# Copiar código fuente
COPY --chown=appuser:appuser . .

# Copiar y hacer ejecutable el script de inicio (antes de cambiar a appuser)
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh && chown appuser:appuser /app/start.sh

# Cambiar a usuario no-root
USER appuser

# Exponer puerto
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8000/health || exit 1

# Comando de inicio con script personalizado
CMD ["/app/start.sh"]
