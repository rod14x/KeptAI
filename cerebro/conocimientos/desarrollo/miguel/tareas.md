# Tareas pequeñas MIG-00 a MIG-08

> Todas comienzan pendientes. Ejecutar una por conversación o por turno delimitado; no repartir simultáneamente los mismos archivos. Fuentes: MIG-GENERAL y roadmap sección Miguel. Cada tarea puede dividirse si supera una entrega verificable.

## MIG-00 — Verificar entorno y acordar fronteras

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** Sin dependencia. Leer AGENTS/CLAUDE y tarea general; consultar infra/modelo solo secciones pertinentes.

**Trabajo acotado:** Verificar cwd/root, estado Git sin mutaciones, JDK21/JAVA_HOME Linux, Maven Wrapper futuro, Docker daemon/WSL, puertos ocupados sin matar procesos, CLI y acceso a fuentes. Revisar diagrama Spring actualizado como dato. Acordar nombres/DTOs y archivos con Andrés; registrar hallazgos y comandos faltantes.

**Criterio de cierre:** Informe reproducible con herramientas reales, bloqueos y plan mínimo MIG-01/02. No scaffold ni aplicación todavía.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-01 — Arranque Spring y configuración

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-00; entorno Java apto.

**Trabajo acotado:** Inicializar Backend/ solo si está vacío; reutilizar código si aparece. Maven Wrapper, versión Boot estable compatible, config por perfiles, health mínimo sin datos privados, errores básicos y .env.example sin secretos. Tests de arranque; evitar activar servicios/políticas ficticias como prod.

**Criterio de cierre:** ./mvnw verify pasa y arranque local/health verificables. Documentar comandos y versión. No ampliar a pagos/captura.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-02 — Contrato API y DTOs

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-01; acuerdo de esquema/campos con Andrés.

**Trabajo acotado:** Versionar Backend/docs/openapi.yaml: evidencias, extracción, borradores, confirmación, pedidos, conciliación, verificación/aplicación, resultados/caja/CSV. DTOs centavos/moneda/fechas/origen/estados, request_id/códigos, ejemplos ficticios y validación. Distinguir rutas de Miguel y adapters pendientes Andrés.

**Criterio de cierre:** Contrato validado, ejemplos coherentes para Germán, tests de DTO/error; ninguna ruta simulada se anuncia operativa. Si hace falta, partir endpoints por grupo.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-03 — Autenticación JWT y permisos

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-01/02; memberships/políticas de Andrés y configuración Auth.

**Trabajo acotado:** Spring Security Resource Server; emisor/JWKS/audiencia/expiración; resolver organización por membresía; roles verificación/aplicación/resultados. CORS conocido, permisos por endpoint. No confiar en organization_id del cliente ni JWT solo decodificado.

**Criterio de cierre:** Tests 401/403, JWT inválido/vencido/audiencia incorrecta y segunda organización; prueba real de sesión en integración. Faltan claves/proyecto: mantener bloqueo explícito.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-04 — Entrada manual y evidencias privadas

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-02/03; esquema evidence y Storage/políticas acordados.

**Trabajo acotado:** Texto pegado/cargado y archivo voucher/audio: validar tipo/tamaño, origen/hash/autor/organización. Registro evidencia y carga/lectura privadas, URLs autorizadas. No aceptar URLs arbitrarias para descargar ni abrir bucket público.

**Criterio de cierre:** Carga y consulta real; sin acceso cruzado; fallos reintentables sin registro engañoso. No datos ERP/CRM ni verificación bancaria.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-05 — Cliente Gemini y borrador extraído

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-04; secreto/modelo accesible.

**Trabajo acotado:** Adapter HTTP Java con timeout/límites/reintentos; texto/imagen/audio; JSON DTO validado, ausentes/ilegibles, fragmento de procedencia. Contenido es evidencia, nunca instrucción; no IA de crédito/saldo. Persistir estado/error del trabajo; no worker Python.

**Criterio de cierre:** Muestras por modalidad guardadas y revisables, tests timeout/JSON inválido/ausente y recuperación. Sin API key: fixtures para tests etiquetados, task bloqueada para extracción real.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-06 — Revisión humana y pedido persistente

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-05; esquema y servicio pedido de Andrés.

**Trabajo acotado:** Editar/confirmar/descartar borrador; auditoría quién/campo/fecha; crear pedido idempotente con vínculo a evidencia. Confirmar no significa verificar fondos ni aplicar pago. Consulta tras reinicio.

**Criterio de cierre:** Pedido real persistente y correcciones auditadas; repetición no duplica; campos incompletos fallan claramente. Tests contra persistencia/servicios acordados.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-07 — Exponer motor de Andrés y consultas

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-02/03/06; motor y contrato de Andrés disponibles.

**Trabajo acotado:** Controllers/adapters para candidatos, verificación de fondos simulada rotulada, aplicación, saldo/alertas, estado de cuenta, costo/margen/caja/CSV. Autorización por rol; invocar servicios @Transactional de Andrés sin fórmula alternativa. Token de estado compartido solo si backend seguro disponible.

**Criterio de cierre:** Integración real verifica parcial/reintento/duplicado/rollback con Andrés; saldo400, cobrado400, margen110. Un adapter mock no cierra tarea. Rechazar acceso ajeno; token limitado/vencido si se implementa.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-08 — QA integrado, operación y entrega

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-00..07 completadas; frontend/motor disponibles para recorrido.

**Trabajo acotado:** Ejecutar demo real, negativo/duplicado/huérfano/error/permiso; JUnit/MockMvc/PostgreSQL y coordinación con Germán. Docker/Render config sin secretos, logs request_id, documentos de lanzamiento y recuperación. Publicar servicio solo con cuentas/entorno autorizados; no contratar por la tarea.

**Criterio de cierre:** Tests y recorrido reales con evidencia, limitaciones exactas, secretos ausentes y handoff reproducible. Sin despliegue o módulo dependiente, informar estado parcial, no todo terminado.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

