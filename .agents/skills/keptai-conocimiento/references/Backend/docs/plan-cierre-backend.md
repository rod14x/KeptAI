> Publicación11/10: Docker build/humo prod y Compose validados. V10/V11 ahora coinciden exactamente con origin/main418dc65; la divergencia de código está resuelta. El historial de la base remota continúa por comprobar. Guía: despliegue-n8n.md.

# Plan de cierre del backend — 11/10/2026

Petición: cerrar Auth real y MIG-03-D3/MIG-04..08 antes de dar un visto bueno. Fuente: tareas.md, MIG-GENERAL, D-007/D-009/D-012/D-013/D-014. No se confunde implementación local con aceptación del despliegue.

## Implementación y verificación antes de desplegar

1. Auth: conservar cuenta y membresía aprobadas. Recorrido navegador/Supabase/Spring/PostgreSQL ya acreditado 15/15; no recrear identidad ni publicar credenciales.
2. D3: mantener X-Api-Key por organización/instancia/alcance, rotación/revocación y rechazo de credenciales mezcladas. Ejecutar recepción HTTP propia; WF1/WF2 originales requieren backend público.
3. MIG-04: comprobar además el cliente Storage real a través de la API (no solo llamadas REST independientes): recepción del voucher, metadatos, firma autorizada, descarga privada, carga manual, replay y limpieza.
4. MIG-05: ingesta/contacto/pedido/voucher e idempotencia persistentes; confirmar ausencia de transcript, hoja entrante y Base64 en DB/logs. Pruebas originales de n8n y retención de sus ejecuciones se ejecutan después del despliegue.
5. MIG-06: corrección optimista, confirmación y auditoría; reiniciar un Spring propio y volver a consultar el pedido/hoja/voucher sin perder estado ni idempotencia.
6. MIG-07: completar el circuito comercial con la nueva autorización de Miguel: ADMIN decide crédito durante el MVP (D-014). API + RLS V14; no asignar ADMIN como vendedor; aprobación/rechazo, obligación y auditoría atómicos; Idempotency-Key obligatoria. Mantener dos ADMIN distintos para verificar/aplicar fondos. Preservar motores y fórmulas de Andrés.
7. MIG-08 local: suite completa, matriz/contrato, concurrencia/rollback y aceptación financiera. Dejar entrega para frontend con campos/roles/headers reales, sin alterar su implementación.

## Procedimiento reproducible de la aceptación adicional

Desde la raíz Linux, con Docker y JDK21, ejecutar:

```sh
sg docker -c 'Backend/docs/tools/.venv/bin/python Backend/scripts/verificar-api-supabase-real.py --run-real-storage'
```

Lee Backend/.env, Frontend/.env.local y Frontend/e2e/auth-real.local sin mostrarlos. Usa una base PostgreSQL17 desechable con todas las migraciones locales y un login sin superusuario/BYPASSRLS. Genera una organización/membresía ADMIN ficticias exclusivamente en esa base, ligadas a la cuenta Auth existente; no cambia la membresía aprobada de la base activa. Usa Spring propio8094 (rechaza puerto ocupado), Auth/Storage remotos reales y dos PNG sintéticos eliminados al finalizar. Reinicia solo su propio Spring. No usa navegador ni workflows originales: complementa el e2e de navegador real existente. Una prueba fallida no acredita cierre.

## Secuencia necesaria para cerrar aceptación externa

1. Leer keptai.flyway_schema_history de Supabase. Resolver con Andrés qué V10 se aplicó: contacto local frente a crédito en develop. No ejecutar repair ni reescribir migraciones históricas. Preparar el orden de release según el historial real; la API requiere V12/V13/V14.
2. Desplegar la versión validada, con login runtime sin bypass, secretos del servidor y bucket privado. Migraciones con rol migrador separado; health y /me reales en HTTPS.
3. Registrar en destino los contactos/membresías aprobados y provisionar una clave INGESTA propia de destino. La clave local no acredita provisión remota. Entregarla por el canal privado del equipo.
4. Configurar los nodos finales de Isabella para POST /api/v1/ordenes/ingesta y POST /api/v1/pagos/voucher con X-Api-Key y JSON de contrato (imagen_base64 completa, JID y mensajeId presentes). Verificar poda/retención sin chats persistentes.
5. Ejecutar WF1/WF2 originales: pedido → revisión ADMIN → confirmación → decisión de crédito → voucher → verificación ADMIN A → aplicación ADMIN B → despacho → consulta/reportes. Repetir solicitudes, probar credencial revocada y acceso de otra organización; comparar saldo/margen/caja con la semilla financiera autorizada.
6. El compañero termina los módulos frontend y ejecuta el recorrido con estas respuestas reales. Recoger evidencia de aceptación y solo entonces cerrar MIG-03-D3/MIG-05/MIG-08 globales.

## Alcance intencionalmente cerrado

VENDEDOR sigue sin acceso general hasta definir cartera. La aprobación ADMIN de D-014 permite el recorrido MVP sin inventar un vendedor. Texto/audio persistentes y extraction jobs están fuera del MVP; confirmación WhatsApp y callback SCHEDULER siguen cerrados. Verificación de fondos rotulada simulated_demo: no integración bancaria. Estos límites deben quedar visibles en el frontend.

Estado de ejecución y resultados: entrega-backend-final-local.md y estado.md. Backend no desplegado, confirmado por Miguel en esta revisión. No se promete backend productivo terminado ni aceptación n8n original antes de ejecutar los pasos externos.

## Ejecución del plan previa al despliegue

Implementación D-014 y V14 completada. Suite357/0/0 y contrato38/220/25 válidos. Aceptación adicional API/Supabase30/30 terminada, incluyendo persistencia tras reinicio, carga manual/replay, roles y varias membresías. Objetos y procesos de prueba limpiados. Consulta entrega-backend-final-local.md para límites de entorno. Los seis pasos externos anteriores siguen pendientes, no se marcan ejecutados.
