crontab -e
# Añadir estas líneas:
0 1 * * * cd /ruta/a/tu/proyecto && python3 copernicus_data_collector.py
30 1 * * * cd /ruta/a/tu/proyecto && python3 netcdf_processor.py






-- Contar el número total de registros en variables_ambientales
SELECT COUNT(*) FROM gloria.variables_ambientales;

-- Contar por variable
SELECT variable_nombre, COUNT(*) 
FROM gloria.variables_ambientales 
GROUP BY variable_nombre 
ORDER BY COUNT(*) DESC;

-- Contar por piscifactoría
SELECT p.nombre, COUNT(v.*) 
FROM gloria.variables_ambientales v
JOIN gloria.piscifactorias p ON v.piscifactoria_id = p.id
GROUP BY p.nombre
ORDER BY COUNT(v.*) DESC;

-- Ver los datos más recientes (10 registros)
SELECT 
  va.id,
  va.variable_nombre,
  va.fecha_tiempo,
  va.valor,
  p.nombre as piscifactoria,
  ST_X(va.geometria) as longitud,
  ST_Y(va.geometria) as latitud
FROM gloria.variables_ambientales va
LEFT JOIN gloria.piscifactorias p ON va.piscifactoria_id = p.id
ORDER BY va.fecha_tiempo DESC
LIMIT 10;

-- Verificar datos para una piscifactoría específica y variable
SELECT 
  va.variable_nombre,
  va.fecha_tiempo,
  va.valor
FROM gloria.variables_ambientales va
WHERE va.piscifactoria_id = 1  -- Cambia este ID por el de la piscifactoría que quieras comprobar
AND va.variable_nombre = 'o2'  -- Cambia a la variable que quieras comprobar
ORDER BY va.fecha_tiempo DESC
LIMIT 20;

-- Fecha más antigua y la mas nueva --
SELECT 
  MIN(fecha_tiempo) AS fecha_mas_antigua,
  MAX(fecha_tiempo) AS fecha_mas_nueva
FROM gloria.variables_ambientales
WHERE valor IS NOT NULL 
AND valor != 'NaN';

-- Script para eliminar datos de variables específicas
-- Mantiene: uo, vo, zos, evs, hfss, hfds, hfls, so, pr, ph

-- Lista de variables a conservar
-- Nota: 'ua' no aparece en la lista mostrada, pero lo incluimos ya que se mencionó que se quiere mantener
DELETE FROM gloria.variables_ambientales
WHERE variable_nombre NOT IN (
    'ua', 'vo', 'zos', 'evs', 'hfss', 'hfds', 'hfls', 'so', 'pr', 'ph'
);

--  actualizar las vistas materializadas después de eliminar datos
SELECT gloria.refresh_materialized_views();

-- Mostrar conteo de registros por variable después de la eliminación
SELECT variable_nombre, COUNT(*) AS registros
FROM gloria.variables_ambientales
GROUP BY variable_nombre
ORDER BY variable_nombre;

COMMIT;