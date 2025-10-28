# 🐳 GlorIA - Docker Quick Start Guide

Guía rápida para ejecutar GlorIA con Docker en menos de 5 minutos.

## 📋 Prerrequisitos

- ✅ Docker Engine 20.10+ instalado
- ✅ Docker Compose 2.0+ instalado
- ✅ 4GB RAM disponible
- ✅ 10GB espacio en disco

### Verificar instalación de Docker

```bash
docker --version
docker-compose --version
```

## 🚀 Inicio Rápido (3 pasos)

### 1. Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.docker.example .env

# Editar (IMPORTANTE: cambiar contraseñas)
nano .env  # Linux/Mac
notepad .env  # Windows
```

**Cambios mínimos requeridos:**
```env
DB_PASSWORD=tu_password_seguro_aqui
REDIS_PASSWORD=tu_redis_password_aqui
JWT_SECRET=genera_un_string_aleatorio_largo
```

### 2. Construir e iniciar servicios

```bash
# Opción A: Con Makefile (Linux/Mac)
make setup
make build
make up

# Opción B: Con Docker Compose (Windows/Linux/Mac)
docker-compose build
docker-compose up -d
```

### 3. Verificar que todo funciona

```bash
# Ver estado de contenedores
docker-compose ps

# Deberías ver 5 contenedores "healthy":
# - gloria-postgres
# - gloria-redis
# - gloria-backend
# - gloria-frontend
# - gloria-python
```

## 🌐 Acceder a la aplicación

Una vez iniciado, accede a:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Python API:** http://localhost:8000/docs (Swagger UI)
- **PostgreSQL:** localhost:5432

## 📊 Comandos Útiles

### Ver logs en tiempo real
```bash
# Todos los servicios
docker-compose logs -f

# Solo un servicio
docker-compose logs -f backend
```

### Detener servicios
```bash
docker-compose down
```

### Reiniciar servicios
```bash
docker-compose restart
```

### Backup de base de datos
```bash
# Con Makefile
make db-backup

# Con Docker Compose
docker-compose exec -T postgres pg_dump -U postgres gloria > backup_$(date +%Y%m%d).sql
```

## 🔧 Modo Desarrollo (con PgAdmin)

```bash
# Iniciar con PgAdmin
make dev
# o
docker-compose --profile dev up -d

# Acceder a PgAdmin en: http://localhost:5050
# Email: admin@gloria.local (configurable en .env)
# Password: admin (configurable en .env)
```

## ❌ Troubleshooting

### Puerto ya en uso

```bash
# Cambiar puerto en .env
FRONTEND_PORT=5174  # En lugar de 5173
BACKEND_PORT=3001   # En lugar de 3000
```

### Contenedor no inicia

```bash
# Ver logs de error
docker-compose logs nombre_servicio

# Reiniciar desde cero
docker-compose down -v
docker-compose up -d
```

### Postgres no se conecta

```bash
# Esperar a que esté listo (puede tomar 30-60 segundos)
docker-compose ps | grep healthy

# Verificar logs
docker-compose logs postgres
```

## 🧹 Limpieza

```bash
# Detener servicios
docker-compose down

# Eliminar todo (¡CUIDADO! Borra datos)
docker-compose down -v
docker system prune -a
```

## 📚 Más información

- [README.md](README.md) - Documentación completa
- [docker-compose.yml](docker-compose.yml) - Configuración de servicios
- `make help` - Lista de todos los comandos disponibles

## 🆘 ¿Problemas?

1. Revisa los logs: `docker-compose logs -f`
2. Verifica puertos libres: `docker-compose ps`
3. Revisa el README completo para troubleshooting detallado

---

**¡Listo!** Ya tienes GlorIA corriendo con Docker 🎉
