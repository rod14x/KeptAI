# Continuación después de integrar los backends
ID: MIG-INTEGRADO-001. Fecha: 11/10/2026. Responsable: Miguel.
Base: integración215bcad en padre-nuestro, incorporada a main con el frontend vigente. Estado final y commit en estado.md.

## Qué queda integrado
Spring, contrato/DTOs, JWT y membresía, contexto de usuario/servicio, autorización por ruta, recepción WF1 sin persistencia; motores Java de pagos, cobranza, costos, resultados/caja; V1–V9 y semilla; inicio frontend api y modo demo separado. Motores probados contra PostgreSQL desechable. Ninguna de estas pruebas acredita Auth real, Storage real, n8n real o endpoints financieros implementados.
Los cambios nuevos de main en diseño, temas, login y menú por rol se conservan. En api también se bloquea /resumen.

## Secuencia de entregas
1. AUTH-FE-01/04 + MIG-03-E: inspeccionar configuración existente sin mostrar secretos; disponer de cuenta Auth real y una membresía local; comprobar navegador→Auth→Bearer→Spring/me→PostgreSQL. Probar recarga, renovación/logout y errores. No repetir la configuración de env ni exigir MCP. Cuenta/membresía ausentes son bloqueo explícito, no sustituir por fixtures.
2. MIG-03-D3: acordar con Isabella el body final, URL alcanzable, credenciales INGESTA por instancia y transporte de voucher. Definir confirmación vendedorJid y callback antes de abrirlos. Probar solicitudes reales; no sobrescribir sus workflows externos.
3. MIG-04: uploader/lector de voucher privado, tipos/tamaño/hash/organización/autor, fallos recuperables y aislamiento. Confirmar bucket/RLS remoto con Andrés; secret key solo en backend y autorización previa de objeto. Sin mensajes/audio/transcript persistidos.
4. MIG-05: persistir proyección estructurada de WF1 y voucher de WF2; idempotencia atómica, replay/concurrencia y conflicto por contenido distinto. La recepción200 actual sigue declarando que no persiste hasta implementar esta etapa.
5. MIG-06: editar/confirmar/descartar con autor autenticado, auditoría y pedido persistente/idempotente. Resolver antes autoría por vendedorJid, cartera/marca del vendedor y el servicio de pedido disponible; confirmación no verifica fondos.
6. MIG-07: adapters/controllers de los motores ya existentes de Andrés. Convertir centavos/BigDecimal en un único punto; usar guardia tenant compartida; mapping seguro de errores/request_id; permisos por ruta/objeto. Consultas/reportes primero cuando su ámbito esté definido. Abrir verificación/aplicación solo tras decisión de segregación. No duplicar fórmulas, reescribir motores ni anunciar controllers inexistentes como funcionales.
7. MIG-08: recorrido integrado con frontend/n8n/motor, VAL-01..06, concurrencia/reversión/aislamiento y aceptación financiera por marca/línea/centro/costos/despacho/caja sin doble conteo. Despliegue/operación después de evidencia real y configuración autorizada.

## Criterio para decir backend terminado
Endpoints de negocio implementados y autorizados, persistencia e idempotencia, vouchers privados, Auth real probado, integración con n8n/frontend y motor real, y evidencia de aceptación/recuperación. Merge y suite verde solo cierran la integración del código existente.
No aplicar automáticamente V8/V9 o seed a una base activa, ni reiniciar procesos del usuario al revisar este documento. La puesta en marcha de la versión integrada se hace de forma explícita; los servidores actuales pueden conservar la versión anterior.

## Flujo con Claude
Una entrega delimitada por vez, leer skill/AGENTS y estado vigente, conservar fuentes y propiedad del motor de Andrés. Claude entrega diff/evidencia sin commit/push; Codex revisa y publica cuando lo autoriza Miguel. Fixtures y resultados reales separados. Si faltan datos Auth/membresía, preparar procedimiento parametrizado y pedir solo los datos indispensables; nunca imprimir claves o tokens.


## Avance11/10/2026: primer recorrido real completado
Aceptación básica de etapa1 acreditada: sin-membresia7/7 y con-membresia15/15 (ADMIN de Corpotex), Auth remoto y Spring/PostgreSQL locales reales. Provisión aprobada realizada. Renovación real del token,409/otros roles/infraestructura real pendientes como cobertura ampliada; no confundir con VAL-03 completo. Continuar etapa2 MIG-03-D3, conservando servidores habituales y separación mock/api. Evidencia estado.md.

## Actualización 11/10/2026 — MIG-04/05 mínimo para n8n
Ingesta y voucher implementados y probados localmente (ver estado.md, última sección y Backend/docs/integracion-n8n-isabella.md). Siguen pendientes: prueba con Supabase Storage real, n8n real, credencial real y despliegue; MIG-04 (lectura privada del panel), MIG-05 restante, MIG-06 y MIG-07 permanecen abiertos.

## Cierre de revisión n8n local — 11/10/2026
Recepción persistente de ambas rutas publicada tras 321 tests Java, 106 frontend, build, contrato 38/220/25 y 50 HTTP desechables. Clave isabel/INGESTA provisionada solo en Corpotex local; Storage real probado con archivo temporal sintético eliminado. Consultar estado.md y provision-servicios-local.md. Próximo: reiniciar versión local, desplegar y provisionar el servicio en la base del despliegue, prueba real de Isabella. No cerrar el acceso del panel a vouchers, la asociación cliente/orden ni el motor por estas pruebas.

## Actualización 11/10/2026 — contacto registrado y asociación voucher → pedido (V10, D-011)
Implementado y probado localmente (estado.md, última sección). Antes del despliegue: migrar a V10 (rol migrador; la imagen no migra), validar el esquema remoto/runtime, registrar el contacto real, provisionar la credencial en la base del despliegue, probar Storage y n8n reales y DNS/HTTPS. Vendedor y validación humana de /cerrar siguen pendientes.
