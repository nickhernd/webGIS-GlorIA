erDiagram
    PISCIFACTORIAS {
        SERIAL id PK "Identificador único"
        VARCHAR nombre "Nombre de la piscifactoría"
        TEXT descripcion "Descripción de la piscifactoría"
        VARCHAR tipo "Tipo: marina, continental, etc."
        TEXT[] especies "Especies cultivadas"
        VARCHAR ciudad "Ciudad de ubicación"
        VARCHAR provincia "Provincia de ubicación"
        VARCHAR comunidad_autonoma "Comunidad Autónoma"
        TIMESTAMP fecha_registro "Fecha de registro"
        TIMESTAMP fecha_actualizacion "Fecha de actualización"
        FLOAT capacidad_produccion "Capacidad en toneladas"
        FLOAT area "Área en metros cuadrados"
        FLOAT profundidad_media "Profundidad media en metros"
        BOOLEAN activo "Estado activo/inactivo"
        GEOMETRY geometria "Ubicación geográfica (punto central)"
        GEOMETRY geom_area "Área geográfica (polígono opcional)"
    }
    DATASETS {
        SERIAL id PK "Identificador único"
        VARCHAR nombre "Nombre del dataset"
        TEXT descripcion "Descripción del dataset"
        VARCHAR fuente "Fuente del dataset"
        VARCHAR dataset_id "ID del dataset en la fuente original"
        TEXT[] variables "Variables incluidas"
        VARCHAR url_base "URL base para acceso o descarga"
        VARCHAR formato "Formato del dataset (NetCDF, CSV, JSON, etc.)"
        VARCHAR frecuencia_actualizacion "Frecuencia de actualización (diaria, horaria, etc.)"
        TIMESTAMP fecha_registro "Fecha de registro"
        TIMESTAMP fecha_ultima_actualizacion "Fecha de última actualización"
        BOOLEAN activo "Estado activo/inactivo"
        GEOMETRY bbox_geom "Área cubierta (bounding box)"
        JSONB metadatos "Metadatos en formato JSON"
    }
    VARIABLES_AMBIENTALES {
        BIGSERIAL id PK "Identificador único"
        INTEGER dataset_id FK "Referencia al dataset"
        VARCHAR variable_nombre "Nombre de la variable"
        TIMESTAMP fecha_tiempo "Fecha y hora del dato"
        FLOAT valor "Valor de la variable"
        INTEGER piscifactoria_id FK "Referencia a la piscifactoría"
        GEOMETRY geometria "Ubicación geográfica del dato"
        FLOAT profundidad "Profundidad en metros"
        INTEGER calidad "Calidad del dato (0-100)"
        TEXT observaciones "Observaciones adicionales"
    }
    ALERTAS {
        SERIAL id PK "Identificador único"
        INTEGER piscifactoria_id FK "Referencia a la piscifactoría"
        VARCHAR tipo "Tipo de alerta (temperatura, corriente, etc.)"
        VARCHAR nivel "Nivel de alerta (informativo, advertencia, crítico)"
        TEXT descripcion "Descripción de la alerta"
        TIMESTAMP fecha_inicio "Fecha de inicio de la alerta"
        TIMESTAMP fecha_fin "Fecha de fin de la alerta (opcional)"
        TIMESTAMP fecha_registro "Fecha de registro de la alerta"
        VARCHAR variable_nombre "Nombre de la variable asociada"
        FLOAT valor_umbral "Valor umbral para la alerta"
        FLOAT valor_actual "Valor actual de la variable"
        BOOLEAN activa "Estado activa/inactiva"
        TEXT accion_recomendada "Acción recomendada"
        GEOMETRY geometria "Ubicación específica (opcional)"
        JSONB metadatos "Información adicional en formato JSON"
    }
    CONFIGURACIONES {
        SERIAL id PK "Identificador único"
        VARCHAR categoria "Categoría de la configuración"
        VARCHAR clave "Clave única de la configuración"
        TEXT valor "Valor de la configuración"
        TEXT descripcion "Descripción de la configuración"
        TIMESTAMP fecha_creacion "Fecha de creación"
        TIMESTAMP fecha_actualizacion "Fecha de actualización"
        VARCHAR usuario "Usuario que realizó la configuración"
    }

    %% Relaciones entre tablas
    PISCIFACTORIAS ||--o{ VARIABLES_AMBIENTALES : contiene
    DATASETS ||--o{ VARIABLES_AMBIENTALES : incluye
    PISCIFACTORIAS ||--o{ ALERTAS : recibe
    PISCIFACTORIAS ||--o{ CONFIGURACIONES : tiene
    VARIABLES_AMBIENTALES }o--|| DATASETS : pertenece
    ALERTAS }o--|| PISCIFACTORIAS : afecta
    CONFIGURACIONES }o--|| PISCIFACTORIAS : aplica
