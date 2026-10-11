# Tareas pequeñas MIG-00 a MIG-08

> Todas comienzan pendientes. Ejecutar una por conversación o por turno delimitado; no repartir simultáneamente los mismos archivos. Fuentes: MIG-GENERAL y roadmap sección Miguel. Cada tarea puede dividirse si supera una entrega verificable.

> Actualización (10/10/2026): MIG-02 sigue en propuesta y debe alinearse con `BD/` y `Middleware/n8n/` (D-005); MIG-05 recibe extracción transitoria de n8n (D-005/D-007), sin cliente Gemini en Spring ni historial persistente. Detalle en [revisión MIG-REV-001](revision-integracion-andres.md).

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

Criterio adicional D-009: VAL-03: JWT/membresía, organización y permisos por objeto/campo; contexto transaccional, reutilización del pool y rol runtime real. Ver [DB-VAL-001](../../../../BD/validaciones-pre-supabase.md).

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-01/02; memberships/políticas de Andrés y configuración Auth.

**Trabajo acotado:** Spring Security Resource Server; emisor/JWKS/audiencia/expiración; resolver organización por membresía; roles verificación/aplicación/resultados. Credencial n8n por hash/instancia y contexto app.organizacion_id + usuario o servicio por transacción; RLS V4/V5, CORS conocido, permisos por endpoint. No confiar en organization_id del cliente ni JWT solo decodificado.

**Criterio de cierre:** Tests 401/403, JWT inválido/vencido/audiencia incorrecta y segunda organización; prueba real de sesión en integración. Faltan claves/proyecto: mantener bloqueo explícito.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-04 — Entrada manual y evidencias privadas

Criterio adicional D-009: VAL-03: aislamiento del uploader y lectura de vouchers, usuarios anónimos y otra organización; URLs y credenciales privilegiadas validadas por el backend. Ver [DB-VAL-001](../../../../BD/validaciones-pre-supabase.md).

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-02/03; esquema evidence y Storage/políticas acordados.

**Trabajo acotado:** Solo archivo voucher privado (D-007), con datos estructurados de negocio; sin texto/audio persistente: validar tipo/tamaño, origen/hash/autor/organización. Registro evidencia y carga/lectura privadas, URLs autorizadas. No aceptar URLs arbitrarias para descargar ni abrir bucket público.

**Criterio de cierre:** Carga y consulta real; sin acceso cruzado; fallos reintentables sin registro engañoso. No datos ERP/CRM ni verificación bancaria.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-05 — Ingesta n8n y borrador extraído

Criterio adicional D-009: VAL-02: creación concurrente con misma clave; replay tras timeout después de commit; contenido distinto produce conflicto y nunca doble operación. Ver [DB-VAL-001](../../../../BD/validaciones-pre-supabase.md).

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-04; secreto/modelo accesible.

**Trabajo acotado:** Implementar /ordenes/ingesta y /pagos/voucher consumidos por WF1/WF2, con autenticación servicio y JSON DTO validado. Descartar transcript/crudo después de validación; conservar proyección de negocio y vouchers privados. No historial de mensajes/audio, otro cliente IA en Spring ni reglas de crédito/saldo en n8n. Resolver antes transporte seguro de imagen/hash/path faltante en WF2.

**Criterio de cierre:** Ingesta real revisable con voucher persistido, reintento sin duplicar, JSON inválido/campos ausentes, y ningún transcript en DB/logs/auditoría/ejecuciones n8n. Fixtures etiquetados no cierran integración real.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-06 — Revisión humana y pedido persistente

Criterio adicional D-009: VAL-02/04: confirmación idempotente y auditoría atómica; no duplicar cambios al reintentar. Ver [DB-VAL-001](../../../../BD/validaciones-pre-supabase.md).

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-05; esquema y servicio pedido de Andrés.

**Trabajo acotado:** Editar/confirmar/descartar borrador; auditoría quién/campo/fecha; crear pedido idempotente con vínculo a evidencia. Confirmar no significa verificar fondos ni aplicar pago. Consulta tras reinicio.

**Criterio de cierre:** Pedido real persistente y correcciones auditadas; repetición no duplica; campos incompletos fallan claramente. Tests contra persistencia/servicios acordados.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-07 — Exponer motor de Andrés y consultas

Criterio adicional D-009: VAL-01/02/04/05/06: motor real, límites financieros, FK entre organizaciones, anulación/reversión reconstruibles, dos pagos distintos sobre la misma obligación y carrera aplicar/anular. Aceptar costos compartidos, centro de resultados, vencimiento desde despacho y caja sin doble conteo. Ver [DB-VAL-001](../../../../BD/validaciones-pre-supabase.md).

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-02/03/06; motor y contrato de Andrés disponibles.

**Trabajo acotado:** Controllers/adapters para candidatos, verificación de fondos simulada rotulada, aplicación, saldo/alertas, estado de cuenta, costo/margen/caja/CSV. Autorización por rol; invocar servicios @Transactional de Andrés sin fórmula alternativa. Token de estado compartido solo si backend seguro disponible.

**Criterio de cierre:** Integración real verifica parcial/reintento/duplicado/rollback con Andrés; saldo400, cobrado400, margen110. Un adapter mock no cierra tarea. Rechazar acceso ajeno; token limitado/vencido si se implementa.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

## MIG-08 — QA integrado, operación y entrega

Criterio adicional D-009: Cerrar VAL-01 a VAL-06 con evidencia versionada, entorno, rol y resultados. Consolidación marca/línea/centro, reporte y recorrido real; los 141 tests previos o mocks no reemplazan esta aceptación. Ver [DB-VAL-001](../../../../BD/validaciones-pre-supabase.md).

**Responsable:** Miguel/Claude Code. **Estado inicial:** pendiente. **Dependencias:** MIG-00..07 completadas; frontend/motor disponibles para recorrido.

**Trabajo acotado:** Ejecutar demo real, negativo/duplicado/huérfano/error/permiso; JUnit/MockMvc/PostgreSQL y coordinación con Germán. Docker/Render config sin secretos, logs request_id, documentos de lanzamiento y recuperación. Publicar servicio solo con cuentas/entorno autorizados; no contratar por la tarea.

**Criterio de cierre:** Tests y recorrido reales con evidencia, limitaciones exactas, secretos ausentes y handoff reproducible. Sin despliegue o módulo dependiente, informar estado parcial, no todo terminado.

**Registro al terminar:** estado, archivos, comando/prueba y resultado real, bloqueo/dependencia y siguiente tarea. Actualizar estado.md. No cerrar tarea por compilar solo si el criterio requiere persistencia o integración.

