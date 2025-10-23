# 🔄 Guía de Migración - Refactorización GlorIA

## 📋 Resumen

Esta guía te ayudará a migrar el código existente para usar los nuevos módulos refactorizados.

---

## 🚨 IMPORTANTE: Antes de Empezar

1. **Crear archivo `.env`**:
   ```bash
   cp .env.example .env
   # Editar .env con tus credenciales
   nano .env
   ```

2. **ELIMINAR credenciales del código**:
   - ❌ NO dejar `password: 'JAHEDE11'` en ningún archivo
   - ✅ Usar solo `DB_PASSWORD` desde `.env`

3. **Instalar dependencias** (si es necesario):
   ```bash
   cd backend
   npm install
   ```

---

## 🔧 Cambios Necesarios en `api.js`

### Paso 1: Agregar Imports

Al inicio de `backend/src/routes/api.js`, **agregar**:

```javascript
// Imports de configuración
import {
  CORRIENTES_UMBRALES,
  OLAS_UMBRALES,
  PESOS_RIESGO,
  NIVELES_RIESGO,
  VARIABLES_AMBIENTALES_UMBRALES,
  LIMITES_CONSULTA,
  MENSAJES_ERROR,
  HTTP_STATUS
} from '../config/constants.js';

// Imports de servicios
import {
  generarAnalisisRiesgo,
  calcularRiesgoCorrientes,
  calcularMagnitudCorriente
} from '../services/riskCalculator.js';

import {
  getAllPiscifactorias,
  getPiscifactoriaById,
  piscifactoriaExists
} from '../services/piscifactoriasService.js';

// Imports de queries
import {
  PiscifactoriasQueries,
  VariablesAmbientalesQueries,
  AlertasQueries,
  PrediccionesQueries,
  RiesgoQueries
} from '../database/queries.js';

// Imports de validadores
import {
  validateId,
  validateDatosAmbientalesParams,
  validateHistoricoParams
} from '../utils/validators.js';
```

---

### Paso 2: Reemplazar Magic Numbers

#### Ejemplo: Endpoint de Corrientes

**❌ ANTES:**
```javascript
router.get('/corrientes/riesgo/:id', async (req, res) => {
  // ...
  const umbralAdvertencia = 0.5; // m/s
  const umbralPeligro = 0.8;     // m/s
  // ...
});
```

**✅ DESPUÉS:**
```javascript
router.get('/corrientes/riesgo/:id', async (req, res) => {
  // ...
  const { UMBRAL_ADVERTENCIA, UMBRAL_PELIGRO } = CORRIENTES_UMBRALES;
  // ...
});
```

---

### Paso 3: Usar Servicios de Negocio

#### Ejemplo: Endpoint de Piscifactorías

**❌ ANTES (líneas 838-887 en api.js):**
```javascript
router.get('/piscifactorias', async (req, res) => {
  const result = await queryDB(`
    SELECT
      id,
      nombre as name,
      // ... 50 líneas de SQL ...
  `);

  if (result.success && result.data.length > 0) {
    const piscifactorias = result.data.map(row => ({
      id: row.id,
      name: row.name,
      // ... transformación manual ...
    }));

    return res.json(piscifactorias);
  }

  res.json([]);
});
```

**✅ DESPUÉS:**
```javascript
router.get('/piscifactorias', async (req, res) => {
  try {
    const piscifactorias = await getAllPiscifactorias();
    res.json(piscifactorias);
  } catch (error) {
    console.error('Error al obtener piscifactorías:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: MENSAJES_ERROR.SERVIDOR_INTERNO,
      details: error.message
    });
  }
});
```

---

#### Ejemplo: Endpoint de Análisis de Riesgo

**❌ ANTES (líneas 265-427 en api.js - 160+ líneas):**
```javascript
router.get('/riesgo/escapes/:id', async (req, res) => {
  const piscifactoriaId = parseInt(req.params.id, 10);

  try {
    // 20 líneas de queries
    const result = await queryDB(`...`);
    const corrientesResult = await queryDB(`...`);

    // 100+ líneas de cálculos hardcodeados
    let indiceRiesgo = 0;
    if (alturaActual < 1.5) {
      contribucionActual = alturaActual / 1.5 * 3;
    } else if (alturaActual < 3) {
      contribucionActual = 3 + (alturaActual - 1.5) / 1.5 * 3;
    } else {
      contribucionActual = 6 + Math.min(4, (alturaActual - 3) * 2);
    }
    // ... más código duplicado ...

    res.json({ /* respuesta manual */ });
  } catch (error) {
    // ...
  }
});
```

**✅ DESPUÉS:**
```javascript
router.get('/riesgo/escapes/:id', async (req, res) => {
  try {
    // Validar entrada
    const idResult = validateId(req.params.id, 'piscifactoriaId');
    if (!idResult.valid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: idResult.errors
      });
    }

    const piscifactoriaId = idResult.sanitized;

    // Obtener datos de olas
    const olasResult = await queryDB(
      RiesgoQueries.getOlasRecientes,
      [piscifactoriaId]
    );

    if (!olasResult.success || olasResult.data.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: MENSAJES_ERROR.DATOS_NO_ENCONTRADOS
      });
    }

    const [olasActual, olasPrevia] = olasResult.data;

    // Obtener datos de corrientes
    const corrientesResult = await queryDB(
      RiesgoQueries.getCorrientesRecientes,
      [piscifactoriaId]
    );

    let velocidadCorriente = 0;
    if (corrientesResult.success && corrientesResult.data.length >= 2) {
      const [uo, vo] = corrientesResult.data;
      velocidadCorriente = calcularMagnitudCorriente(
        uo.valor || 0,
        vo.valor || 0
      );
    }

    // Generar análisis usando el servicio
    const analisis = generarAnalisisRiesgo({
      alturaActual: olasActual.altura_olas || 0,
      alturaPrevia: olasPrevia?.altura_olas || 0,
      velocidadCorriente,
      fechaAnalisis: olasActual.fecha_tiempo
    });

    // Responder
    res.json({
      piscifactoria: {
        id: piscifactoriaId,
        nombre: olasActual.nombre,
        tipo: olasActual.tipo
      },
      analisisRiesgo: analisis
    });

  } catch (error) {
    console.error('Error al obtener análisis de riesgo:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: MENSAJES_ERROR.SERVIDOR_INTERNO,
      details: error.message
    });
  }
});
```

**Reducción**: De 160+ líneas a 55 líneas (65% menos código)

---

### Paso 4: Agregar Validación

#### Plantilla para Endpoints

```javascript
router.get('/endpoint/:id', async (req, res) => {
  try {
    // 1. VALIDAR entrada
    const idResult = validateId(req.params.id, 'id');
    if (!idResult.valid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: idResult.errors
      });
    }

    const id = idResult.sanitized;

    // 2. EJECUTAR lógica de negocio
    const resultado = await miServicio(id);

    // 3. RESPONDER
    res.json(resultado);

  } catch (error) {
    // 4. MANEJAR errores
    console.error('Error en endpoint:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: MENSAJES_ERROR.SERVIDOR_INTERNO,
      details: error.message
    });
  }
});
```

---

## 📝 Checklist de Migración por Endpoint

### Piscifactorías
- [ ] `GET /piscifactorias` - Usar `getAllPiscifactorias()`
- [ ] `GET /piscifactorias/:id` - Usar `getPiscifactoriaById(id)`

### Datos Ambientales
- [ ] `GET /datos-ambientales` - Validar con `validateDatosAmbientalesParams()`
- [ ] `GET /historico/:variable` - Validar con `validateHistoricoParams()`
- [ ] Reemplazar magic numbers con `VARIABLES_AMBIENTALES_UMBRALES`

### Análisis de Riesgo
- [ ] `GET /riesgo/escapes/:id` - Usar `generarAnalisisRiesgo()`
- [ ] `GET /corrientes/riesgo/:id` - Usar `calcularRiesgoCorrientes()`
- [ ] `GET /riesgo/prediccion/:id` - Usar servicios de cálculo
- [ ] Reemplazar todos los umbrales hardcodeados

### Alertas
- [ ] `GET /alertas` - Usar `AlertasQueries.getAllActive`
- [ ] `GET /alertas/piscifactoria/:id` - Usar `AlertasQueries.getByFarm`

### Predicciones
- [ ] `GET /predicciones/escapes/:id` - Usar `PrediccionesQueries.getLatestByFarm`
- [ ] `GET /predicciones/escapes/:id/historial` - Usar `PrediccionesQueries.getHistorialByFarm`

---

## 🧪 Testing de la Migración

### Paso 1: Verificar que el servidor inicia

```bash
cd backend
npm run dev
```

**Debe mostrar**:
```
✅ Conexión al servidor PostgreSQL establecida
✅ Esquema "gloria" encontrado
✅ Todas las tablas requeridas están presentes (5)
🔌 Nueva conexión establecida en el pool
✅ Conexión a la base de datos establecida correctamente
Servidor escuchando en http://localhost:3000
```

### Paso 2: Probar cada endpoint migrado

```bash
# Test piscifactorías
curl http://localhost:3000/api/piscifactorias

# Test piscifactoría específica
curl http://localhost:3000/api/piscifactorias/1

# Test con validación (debería fallar)
curl http://localhost:3000/api/piscifactorias/abc
# Respuesta esperada: { "error": ["id debe ser un número válido"] }
```

### Paso 3: Verificar logs

Buscar en la consola:
- ✅ No deben aparecer warnings de "Query lenta" (a menos que sea > 1s)
- ✅ No deben aparecer stack traces
- ✅ Mensajes de error deben ser claros

---

## 🐛 Resolución de Problemas

### Error: "Cannot find module './config/constants.js'"

**Solución**:
```bash
# Verificar que el archivo existe
ls backend/src/config/constants.js

# Si no existe, los archivos están en la estructura nueva
# Verificar ruta relativa en el import
```

### Error: "DB_PASSWORD no está definido"

**Solución**:
```bash
# Crear archivo .env desde el ejemplo
cp .env.example .env

# Editar y agregar tu contraseña
nano .env
```

### Error: "validateId is not a function"

**Solución**:
```javascript
// Verificar que el import sea correcto
import { validateId } from '../utils/validators.js';

// NO:
import validateId from '../utils/validators.js';
```

### Queries SQL fallan

**Solución**:
```javascript
// Verificar que usas pool.query, no solo pool
import { pool } from '../db.js';

const result = await pool.query(sql, params);
// NO: const result = await pool(sql, params);
```

---

## 📚 Recursos Adicionales

- **Documentación JSDoc**: Ver comentarios en cada archivo
- **Ejemplos**: Ver `@example` en JSDoc
- **Constantes**: Ver `backend/src/config/constants.js`
- **Queries**: Ver `backend/src/database/queries.js`

---

## ✅ Verificación Final

Antes de considerar la migración completa:

1. [ ] Todos los endpoints responden correctamente
2. [ ] No hay credenciales hardcodeadas en el código
3. [ ] Todos los magic numbers reemplazados por constantes
4. [ ] Validación agregada a endpoints críticos
5. [ ] Logs son claros y útiles
6. [ ] README actualizado
7. [ ] `.env.example` documentado
8. [ ] Código formateado consistentemente

---

## 🎯 Siguiente Nivel

Después de completar la migración básica:

1. **Agregar tests unitarios**
2. **Implementar middleware de validación genérico**
3. **Agregar rate limiting**
4. **Configurar ESLint y Prettier**
5. **Agregar documentación Swagger**

---

**¿Dudas?** Revisa `REFACTORING_SUMMARY.md` para más detalles.

**Última actualización**: Enero 2025
