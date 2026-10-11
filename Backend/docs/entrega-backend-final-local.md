> Evidencia vigente: 357 tests verify + 30 comprobaciones API con Supabase real. D-014 habilita crédito ADMIN; aceptación pública n8n/frontend y migraciones de destino pendientes. Secciones anteriores conservan resultados de entregas previas.

# Entrega de backend para integrar el frontend — 11/10/2026

Base: backend-partefinal / 29995f1. Cambios en el árbol de trabajo, sin merge automático con develop. El compañero integra frontend; esta entrega modifica backend, contrato y documentación.

## Qué se entrega

Auth real tiene aceptación previa con JWT Supabase y membresía local: 7/7 sin membresía y 15/15 con membresía. No se recreó la cuenta ni se cambiaron sus credenciales. `/me` conserva los tres campos de identidad existentes; los nombres opcionales del DTO no se emiten ni se deben exigir.

MIG-04: carga manual de JPEG/PNG/PDF hasta 10 MiB, adjunta a payment_id RECIBIDO y no crea un pago ficticio; metadata/listado y enlaces privados de 60 s, autorización tenant y ADMIN previa, auditoría y compensación de objeto si falla la transacción. Los vouchers WF2 también guardan MIME/tamaño reales. Bucket real probado privado con PNG sintético: upload/read/sign/read-signed/hash/delete, HTTP 200 en todos los pasos; no equivale a probar WF2 original ni toda la API con Storage real.

MIG-05 mantiene la ingesta idempotente estructurada y asociación por contacto registrada de la entrega anterior. No se persiste transcript, mensajes ni Base64 en la base.

MIG-06: list/get/patch/confirmation/discard de drafts. Corregir exige expected_revision; items reemplaza la lista completa, con description, quantity y unit_price (amount_cents/currency). Cliente se mantiene ligado al contacto; marca debe existir. payment_condition, credit_term_days y downpayment completan condiciones estructuradas. La hoja conserva extracción original con revision_humana estructurada y resumen generado; auditoría before/after y cambios. Confirmar exige Idempotency-Key, no duplica la decisión y deja PENDIENTE_APROBACION; no verifica fondos ni aprueba crédito. Motivo libre de descarte no se guarda.

MIG-07: consultas de pedidos/pagos/conciliación/cuentas por cobrar/alertas/estado de cuenta/auditoría, despacho y resultados/caja/CSV adaptan los motores existentes de Andrés. Se reutilizaron selectivamente fuentes de origin/develop 181a30e, sin copiar frontend, sin merge y sin rehacer fórmulas. Verificar/aplicar: ADMIN real de PostgreSQL, Idempotency-Key, dos usuarios distintos y transacción atómica para aplicación/liberación/auditoría/respuesta. Verificación es simulated_demo, no bancaria; nota libre no se persiste. GERENTE accede a resultados según contrato.

## Para el compañero del frontend

Usar Backend/docs/openapi.yaml como contrato vigente. Los DTOs de negocio incorporan campos opcionales del trabajo de develop; hay que alinear tipos y esquemas Zod estrictos del frontend antes de conectar respuestas reales. Las pruebas actuales del frontend usan fixtures previos y no acreditan esa conexión. JWT Bearer para panel; X-Api-Key queda solo en n8n. No enviar organization_id, usuario/autor, ruta Storage, hash ni claves Supabase del servidor. Céntimos enteros y PEN en la frontera, BigDecimal solo dentro del motor. Sin respaldo mock cuando falla API. Las rutas implementadas declaran implemented_local: no significa desplegadas.

Evidence admite data_origin=automated_extraction y uploaded_by_user_id=null para ingesta de servicio. MIME/tamaño históricos pueden ser null; no inventar autor ni tamaño. ExtractionDraft.evidence_id puede ser null porque un pedido ingresado no necesariamente tiene voucher. Revisiones requieren recargar ante 409. Un enlace privado caduca a los 60 s: obtener otro después, no persistirlo ni incluirlo en logs.

Rutas nuevas heredadas de develop que no estaban en el contrato (notifications, duplicate, resolution) siguen denegadas por defecto; no conectar sus controladores desde el frontend hasta acordar contrato y autorización. Texto/audio/extraction-jobs y confirmación/callback WhatsApp siguen cerrados.

## Migraciones y límites de release

V10 local es contacto_whatsapp. develop tiene otra V10 (obligación al aprobar crédito): para el juego de migraciones aislado se conserva su SQL como V11, sin alterar V1–V10. V12 permite descartar borradores incompletos y borrar/reemplazar items exclusivamente como ADMIN mientras el pedido siga BORRADOR. V13 añade metadatos de comprobantes, autor humano y validación de autoría. Todas se prueban en PostgreSQL desechable: no se aplicaron en Supabase ni en Docker activo.

Antes de release hay que leer keptai.flyway_schema_history remoto y reconciliar la colisión V10 con Andrés. Si su V10 de crédito ya está aplicada, este orden local NO se puede aplicar directamente. No editar una migración histórica ni hacer repair a ciegas. La API necesita las columnas de V13 y las políticas ADMIN de V14 para funcionar con estos cambios.

VENDEDOR queda bloqueado en servicios de panel hasta definir cartera/marca. D-014, aprobada por Miguel en esta revisión, habilita autorización de crédito por ADMIN en el MVP (API y RLS V14). La aprobación no asigna ni modifica vendedor_id; n8n no aprueba. Se elimina el bloqueo comercial del MVP sin abrir acceso general de vendedores. Segregación nueva de dos ADMIN está en la API, no en todo SQL/motores internos existentes.

La compensación Storage es best effort: un fallo de eliminación deja conciliación operativa pendiente; no se implementó una cola persistente de limpieza. Enlaces firmados pueden utilizarse hasta su expiración. Renovación real de token y dos cuentas Auth ADMIN distintas aún no acreditados en esta entrega. Roles y varias membresías se comprueban adicionalmente con JWT real y filas exclusivamente desechables; no se crean usuarios remotos.

## Aceptación externa pendiente

Miguel tiene acceso a https://n8n.ejesxyz.com/, pero el backend aún no está desplegado. MIG-03-D3 real y MIG-08 completos requieren backend HTTPS, esquema/membresías/credencial correctos en la base destino y pruebas desde workflows originales WF1/WF2 con reintentos, aislamiento y voucher legible. Ninguna prueba local cierra esta aceptación. No se alteraron workflows de Isabella, frontend, env ni servidores activos.

## Verificación de esta entrega (11/10/2026)

- JDK 21 Linux y `sg docker -c './mvnw -B -o verify'`: 354 tests, 0 fallos, 0 errores, 0 omitidos, BUILD SUCCESS. Incluye 13 nuevos tests de backend completo con PostgreSQL 17 desechable/runtime sin superusuario ni bypass y Storage simulado; nuevos tests de firma privada.
- Cobertura nueva: autorización antes de Storage, enlaces sin caché, metadatos reales/MIME declarada falsa, replay/conflicto por autor, otro tenant sin subir, caída Storage y compensación tras error SQL, corrección con revisión optimista y auditoría before/after, confirmación concurrente única, descarte incompleto, dos ADMIN distintos, rollback completo de aplicación/liberación e idempotencia, despacho con replay y consultas/reportes reales del motor.
- Frontend existente: npm test 106/106 y npm run build OK, sin cambios de código ni conexión de módulos de negocio.
- OpenAPI: 38 operaciones, 220 ejemplos válidos y 25 casos negativos. Matriz de rutas/roles y DTOs comprobados contra contrato. Cinco operaciones permanecen cerradas por decisión, y vendedor se deniega en el servicio hasta definir cartera.
- Storage Supabase real: bucket privado confirmado, upload/read/signed-read/hash/delete HTTP 200 con un PNG sintético eliminado después. Prueba REST del servicio, no aceptación e2e de workflows reales.

### Comprobaciones adicionales terminadas

- Auth real repetido contra el código actual: 15/15 con membresía, Supabase Auth real + Spring propio 8092 + Vite propio 5175 + PostgreSQL local existente. Se verifica Bearer, /me 200/identidad, recarga y logout. Sin nueva cuenta/membresía ni cambios en env; procesos propios detenidos.
- verificar-n8n-local.sh: 58/58 de recepción/contacto/persistencia/idempotencia/ausencia de mensajes, más 4 comprobaciones de caída Storage y rotación/revocación: 62/62 en total. Spring 8090 y Storage SIMULADO 8091, PostgreSQL desechable; procesos y base temporales eliminados. No es workflow real de Isabella.

### Aceptación financiera HTTP adicional

PanelFinancialAcceptanceTests añade cuatro pruebas con PostgreSQL desechable y motores reales, usando la semilla ficticia de Andrés y autenticación de test: resumen/margen/centro/caja/CSV; cobrado S/400, saldo S/400, costo S/690 y margen S/110; aplicación parcial de S/50 con replay único y saldo S/350; duplicado rechazado sin movimiento; sobreaplicación revierte y admite reintento válido; dos pagos de S/250 concurrentes sobre saldo S/400 dejan exactamente uno aplicado y otro rechazado. No es banco real ni ejecución de workflows externos.

Verificación final completa tras añadir esos casos: 354 tests, 0 fallos, 0 errores, 0 omitidos, BUILD SUCCESS. Se mantiene pendiente la aceptación remota y la aprobación comercial por vendedor. No hubo commit, push, merge ni cambios de rama en esta entrega.

## Revisión de cierre y decisión D-014

Plan ejecutable: Backend/docs/plan-cierre-backend.md. Miguel confirma que aún no hay backend desplegado y autoriza ADMIN para crédito durante el MVP. Nueva V14 (sin aplicar a bases activas), Idempotency-Key obligatoria en POST /orders/{id}/credit-decision, autor ADMIN de PostgreSQL, replay persistente y operación atómica con obligación/auditoría. Se preservan vendedor existente y la segregación financiera D-012.

El frontend debe actualizar también el permiso ADMIN y enviar Idempotency-Key en esa ruta; su contrato no debe seguir usando VENDEDOR para aprobar crédito.

## Resultado final de revisión de cierre — 11/10/2026

- `sg docker -c './mvnw -B -o verify'`, JDK21 Linux: **357 pruebas, 0 fallos, 0 errores, 0 omitidos, BUILD SUCCESS**. Tres regresiones nuevas de crédito ADMIN; matriz de autorización y prueba SQL verifican D-014/V14 y conservan autoría de V7. No se alteró código de producción para conservar expectativas históricas del vendedor.
- `verificar-api-supabase-real.py --run-real-storage`: **30/30** con JWT y Storage Supabase reales, Spring propio y PostgreSQL17 desechable con V1–V14/runtime sin bypass. Recepción/replay de pedido y voucher, metadatos, descarga firmada con bytes idénticos y bucket privado, carga manual/replay, corrección y confirmación, ADMIN real autoriza crédito, reinicio/consulta/replay persistentes, 409 con varias membresías, otra empresa devuelve404 y los cuatro roles se resuelven desde PostgreSQL. Cambios de rol/membresía exclusivamente en la base de prueba, no en cuentas remotas ni base activa.
- Prueba real ampliada terminó con limpieza comprobada: dos PNG sintéticos eliminados, base desechable retirada, Spring propio8094 detenido. No quedó contenedor de aceptación. El script tolera procesos propios ya detenidos al limpiar; se recuperaron y eliminaron los dos objetos de una ejecución intermedia fallida.
- OpenAPI vigente: **38 operaciones, 220 ejemplos, 25 casos negativos**, validación OK. Frontend mantiene evidencia previa106 pruebas/build y navegador Auth real15/15; no se modificó código/env del compañero ni se probó aquí su integración de módulos.
- Auth real básico, vouchers privados por API, persistencia/idempotencia, revisión/auditoría y motores HTTP tienen evidencia de backend local. Aceptación financiera previa: cobrado400/saldo400/margen110, parciales/replay/duplicado/sobreaplicación y carrera de dos pagos sobre el mismo saldo.
- **No cierre global de MIG-03-D3/MIG-05/MIG-08:** Miguel confirma que no hay backend desplegado. Faltan historial remoto y reconciliación V10, release/migraciones de destino, WF1/WF2 originales con retención sin chats y recorrido frontend conectado. La API validada puede usarse para implementar integración local; no presentar mocks/workflows sintéticos como integración real.
- Sin commit, push, merge, cambio de rama, migraciones en DB activa ni reinicios de procesos del usuario. Cambios disponibles en backend-partefinal; publicar es un paso posterior autorizado por Miguel.

## Preparación de publicación y Docker — 11/10/2026

Miguel autoriza commit/push de la entrega. Rama backend-partefinal, base29995f1; origen revisado antes de publicar y sin commits nuevos en esa rama. Main418dc65 ya incorporó V10 contacto/V11 crédito; se usa V11 byte a byte igual a main (diferencias anteriores solo comentarios y texto del guard de esquema). No se integran automáticamente cambios de frontend ni main.

Imagen keptai-backend:predeploy construida desde Backend/Dockerfile. Humo ejecutado con Backend/scripts/verificar-docker-local.py: prod+PostgreSQL desechable V1–V14/runtime sin bypass, healthUP, uid10001, raíz de solo lectura, sin capabilities; n8n401/401/400, panel401 y cero filas de negocio. Contenedores/red/env de prueba eliminados. Backend/compose.yaml validado con config --quiet; Backend/deploy/.env.example contiene solo marcadores, .env.production está ignorado por Git.

Se conservan verify357/0/0, API/Supabase real30/30 y OpenAPI38/220/25; no hubo cambios de lógica después de esas pruebas. Guía vigente Backend/docs/despliegue-n8n.md. Próximo: comprobar historial de Supabase, aplicar release compatible, configurar hosting/HTTPS y aceptar workflows/frontend reales. Docker construido no significa desplegado ni cierre de aceptación externa.
