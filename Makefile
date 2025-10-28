.PHONY: help build up down restart logs ps clean prune dev prod backup restore health

# Variables
DOCKER_COMPOSE = docker-compose
ENV_FILE = .env

# Colores para output
GREEN  = \033[0;32m
YELLOW = \033[0;33m
RED    = \033[0;31m
NC     = \033[0m # No Color

help: ## Mostrar esta ayuda
	@echo "$(GREEN)GlorIA - Docker Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ============================================
# Setup inicial
# ============================================

setup: ## Configuración inicial del proyecto
	@echo "$(GREEN)Configurando GlorIA...$(NC)"
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "$(YELLOW)Copiando .env.docker.example a .env$(NC)"; \
		cp .env.docker.example .env; \
		echo "$(RED)¡IMPORTANTE! Edita .env con tus credenciales antes de continuar$(NC)"; \
	else \
		echo "$(YELLOW).env ya existe, saltando...$(NC)"; \
	fi

# ============================================
# Build y gestión de contenedores
# ============================================

build: ## Construir todas las imágenes
	@echo "$(GREEN)Construyendo imágenes Docker...$(NC)"
	$(DOCKER_COMPOSE) build --no-cache

build-fast: ## Construir imágenes (sin cache, más rápido)
	@echo "$(GREEN)Construyendo imágenes Docker (fast)...$(NC)"
	$(DOCKER_COMPOSE) build

up: ## Iniciar todos los servicios
	@echo "$(GREEN)Iniciando servicios...$(NC)"
	$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)✓ Servicios iniciados$(NC)"
	@make health

down: ## Detener todos los servicios
	@echo "$(YELLOW)Deteniendo servicios...$(NC)"
	$(DOCKER_COMPOSE) down
	@echo "$(GREEN)✓ Servicios detenidos$(NC)"

restart: ## Reiniciar todos los servicios
	@echo "$(YELLOW)Reiniciando servicios...$(NC)"
	@make down
	@make up

# ============================================
# Logs y monitoreo
# ============================================

logs: ## Ver logs de todos los servicios
	$(DOCKER_COMPOSE) logs -f

logs-backend: ## Ver logs del backend
	$(DOCKER_COMPOSE) logs -f backend

logs-frontend: ## Ver logs del frontend
	$(DOCKER_COMPOSE) logs -f frontend

logs-postgres: ## Ver logs de PostgreSQL
	$(DOCKER_COMPOSE) logs -f postgres

logs-python: ## Ver logs del servicio Python
	$(DOCKER_COMPOSE) logs -f python-service

ps: ## Listar contenedores activos
	$(DOCKER_COMPOSE) ps

health: ## Verificar salud de los servicios
	@echo "$(GREEN)Verificando salud de servicios...$(NC)"
	@sleep 5
	@docker ps --filter "name=gloria" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ============================================
# Desarrollo
# ============================================

dev: ## Modo desarrollo (con PgAdmin)
	@echo "$(GREEN)Iniciando en modo desarrollo...$(NC)"
	$(DOCKER_COMPOSE) --profile dev up -d
	@echo "$(GREEN)✓ Servicios de desarrollo iniciados$(NC)"
	@echo "$(YELLOW)PgAdmin disponible en: http://localhost:5050$(NC)"

prod: ## Modo producción
	@echo "$(GREEN)Iniciando en modo producción...$(NC)"
	$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)✓ Servicios de producción iniciados$(NC)"

shell-backend: ## Shell en contenedor backend
	$(DOCKER_COMPOSE) exec backend sh

shell-postgres: ## Shell de PostgreSQL
	$(DOCKER_COMPOSE) exec postgres psql -U postgres -d gloria

shell-python: ## Shell en contenedor Python
	$(DOCKER_COMPOSE) exec python-service sh

# ============================================
# Base de datos
# ============================================

db-init: ## Inicializar base de datos
	@echo "$(GREEN)Inicializando base de datos...$(NC)"
	$(DOCKER_COMPOSE) exec postgres psql -U postgres -d gloria -f /docker-entrypoint-initdb.d/01-init.sql

db-backup: ## Backup de la base de datos
	@echo "$(GREEN)Creando backup de la base de datos...$(NC)"
	@mkdir -p backups
	$(DOCKER_COMPOSE) exec -T postgres pg_dump -U postgres gloria > backups/gloria_backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Backup creado en backups/$(NC)"

db-restore: ## Restaurar base de datos (usar: make db-restore FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: especifica el archivo con FILE=backup.sql$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Restaurando base de datos desde $(FILE)...$(NC)"
	cat $(FILE) | $(DOCKER_COMPOSE) exec -T postgres psql -U postgres -d gloria
	@echo "$(GREEN)✓ Base de datos restaurada$(NC)"

# ============================================
# Limpieza
# ============================================

clean: ## Detener y eliminar contenedores
	@echo "$(YELLOW)Limpiando contenedores...$(NC)"
	$(DOCKER_COMPOSE) down -v
	@echo "$(GREEN)✓ Contenedores eliminados$(NC)"

clean-all: ## Limpieza completa (contenedores + imágenes + volúmenes)
	@echo "$(RED)¿Estás seguro? Esto eliminará TODOS los datos (y/n)$(NC)"
	@read -p "" confirm; \
	if [ "$$confirm" = "y" ]; then \
		echo "$(YELLOW)Limpiando todo...$(NC)"; \
		$(DOCKER_COMPOSE) down -v --rmi all; \
		echo "$(GREEN)✓ Limpieza completa$(NC)"; \
	else \
		echo "$(YELLOW)Cancelado$(NC)"; \
	fi

prune: ## Limpiar recursos Docker no utilizados
	@echo "$(YELLOW)Limpiando recursos Docker no utilizados...$(NC)"
	docker system prune -f
	@echo "$(GREEN)✓ Recursos limpiados$(NC)"

# ============================================
# Testing
# ============================================

test-backend: ## Ejecutar tests del backend
	$(DOCKER_COMPOSE) exec backend npm test

test-all: ## Ejecutar todos los tests
	@echo "$(GREEN)Ejecutando tests...$(NC)"
	@make test-backend

# ============================================
# URLs útiles
# ============================================

urls: ## Mostrar URLs de los servicios
	@echo ""
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"
	@echo "$(GREEN)  GlorIA - URLs de Servicios$(NC)"
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"
	@echo ""
	@echo "  $(YELLOW)Frontend:$(NC)      http://localhost:5173"
	@echo "  $(YELLOW)Backend API:$(NC)   http://localhost:3000"
	@echo "  $(YELLOW)Python API:$(NC)    http://localhost:8000"
	@echo "  $(YELLOW)PostgreSQL:$(NC)    localhost:5432"
	@echo "  $(YELLOW)Redis:$(NC)         localhost:6379"
	@echo "  $(YELLOW)PgAdmin:$(NC)       http://localhost:5050 (solo en modo dev)"
	@echo ""
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"
	@echo ""
