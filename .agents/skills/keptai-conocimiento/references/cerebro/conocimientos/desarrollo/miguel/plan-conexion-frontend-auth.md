# Plan de conexión frontend ↔ Spring ↔ Supabase Auth
ID: MIG-FE-AUTH-001. Fecha: 10/10/2026. Solicitud de Miguel: conectar la entrega MIG-03-B al frontend actual.
Rama: backend-migueltarea2y3. Base publicada: 6279f8b.
Estado: plan de implementación; conexión real aún no acreditada. No cambia D-003 a D-010.

## 1. Qué existe y qué falta
Backend MIG-03-B implementa JWT con JWKS RS256/ES256, issuer/audiencia/exp/nbf/sub, resolución PostgreSQL por sub y GET /api/v1/me. Pruebas reejecutadas en esta revisión: 182 sin fallos; OpenAPI38 operaciones/214 ejemplos/25 negativos correctos. Son fixtures JWT/BD, no Supabase Auth real.
Frontend ya contiene Supabase signInWithPassword/getSession, token provider, getMyContext y UserContext Zod. La respuesta user_id/organization_id/role coincide con CommonDtos.UserContext.
El frontend activo sigue mock; no se ha acreditado configuración real, usuario Auth y membresía local ni reinicio de Spring con JWT.
AuthContext descarta organization_id y convierte errores distintos en “sin rol”. Restauración de sesión no está completamente protegida frente a unmount/cambios concurrentes; no escucha onAuthStateChange.
En modo api, App redirige al Dashboard/Taller que cargan APIs aún ausentes. PerfilPage también usa consultas de negocio; no reutilizarla como prueba de identidad sin separar dependencias.
No existen todavía contexto JDBC general, autorización fina/API key, Storage ni motor operativo. No confundir login integrado con estas entregas.

## 2. Alcance y criterio de cierre
Conectar navegador5173 → Supabase Auth real → Bearer JWT → Spring8080 /api/v1/me → PostgreSQL5433.
Después de entrar mostrar solo información disponible: user_id, organization_id, role y correo de sesión identificado como dato de Auth. No inventar nombre legal/empresa, marca, saldo o permisos ya implementados.
En modo api, pantalla inicial autenticada de conexión/identidad sin consultas a módulos no implementados. Mostrar módulos pendientes sin habilitar acciones ni caer automáticamente al mock.
Mock continúa como modo explícito separado para demo, con distintivo; nunca mezclar rol real con filas ficticias dentro de una vista que parezca conectada.
Cierre: login, /me200, refresh de página, renovación/cierre de sesión y estados negativos probados en navegador contra la API. Si falta configuración Auth, documentar implementación y pruebas con fixtures como parciales; no afirmar conexión real.

## 3. Fuentes
- [Matriz de acceso](../../../../Backend/docs/matriz-acceso.md).
- [Contrato API](../../../../Backend/docs/contrato-api.md) y [OpenAPI](../../../../Backend/docs/openapi.yaml).
- [Definición BD](../../../../BD/definicion-base-datos.md), [guía local](../../../../BD/local/README.md) y [validaciones](../../../../BD/validaciones-pre-supabase.md).
- [Integración frontend](../../../../Frontend/docs/integracion-api.md) y [README frontend](../../../../Frontend/README.md).
- [Bitácora](estado.md), decisiones D-007/008/009/010 y AGENTS.md.
Código relevante: Frontend/src/context/AuthContext.tsx, api/contract/http.ts/endpoints.ts/schemas.ts, api/client.ts, lib/supabase.ts, config.ts, App.tsx, pages/LoginPage.tsx y hooks/useApi.ts.
Backend: config/SecurityConfig, security/JwtDecoders/JdbcMembershipResolver/KeptaiAuthentication, web/MeController y config/KeptaiSecurityProperties.

## 4. AUTH-FE-01 — Configuración y cuenta de prueba
Inspeccionar presencia de configuración sin imprimir valores privados ni leer .mcp.json. Verificar el proyecto Auth correcto, issuer/JWKS/audiencia y algoritmo actual; consultar documentación oficial vigente antes de fijar valores.
Frontend .env.local ignorado:
    VITE_API_MODE=api
    VITE_API_BASE_URL=http://localhost:8080
    VITE_SUPABASE_URL=<URL pública del proyecto>
    VITE_SUPABASE_PUBLISHABLE_KEY=<clave publicable>
No service_role, secreto JWT o credencial DB en VITE_*.
Backend: KEPTAI_JWT_ISSUER_URI, KEPTAI_JWT_JWK_SET_URI, KEPTAI_JWT_AUDIENCES y CORS localhost5173/127.0.0.15173. Comprobar qué archivo/entorno importa realmente Spring; Backend/.env no se carga automáticamente por existir. Documentar export/archivo ignorado seguro, sin duplicar la conexión runtime existente.
No inventar algoritmo ni cambiar a HS256 para saltar una falta de configuración. HS256 del proyecto es una incompatibilidad pendiente, no un token que se deba aceptar automáticamente.
Cuenta Auth de prueba y usuario local: auth_user_id exactamente igual al sub real; una sola membresía activa para esta etapa. Crear con procedimiento acotado usando el esquema real, sin datos empresariales; escoger organización y rol explícitamente.
Claude prepara script/guía parametrizados sin claves; Miguel introduce credenciales por canal privado y realiza/configura la provisión de cuenta si no está accesible. No manipular Supabase remoto implícitamente ni inferir autorización desde su MCP.
Salida: guía reproducible de configuración y provisión, inputs pendientes exactos; no tocar V1–V7 ni borrar volumen.

## 5. AUTH-FE-02 — Sesión e identidad del frontend
Separar identidad resuelta del backend de datos de presentación. Conservar organization_id además de user_id y role en el estado Auth; comprobar todos los consumidores y validar roles mediante Zod.
Mantener el proveedor del token registrado antes de /me y consistente tras cambios de sesión.
Suscribirse a onAuthStateChange y limpiar la suscripción; evitar llamadas Auth reentrantes dentro del callback. Cancelar/ignorar cargas antiguas tras logout, unmount o cambio de usuario; un resultado tardío no puede restaurar una sesión cerrada.
Resolver /me al entrar y restaurar, refrescar identidad ante cambios pertinentes del token y limpiar cachés/estado al cambiar identidad. No confiar en claims/body/localStorage como rol.
No registrar tokens, contraseñas o cuerpos de autenticación en logs.
Manejar errores por HttpError.code/status:
- login inválido: credenciales incorrectas;
- /me401: sesión inválida/vencida, cierre controlado;
- /me403: sin membresía autorizada;
- /me409 ORGANIZATION_SELECTION_REQUIRED: varias organizaciones aún no soportadas; no elegir la primera ni solicitar un UUID arbitrario;
- /me503/red: servicio temporalmente indisponible, reintento, no etiquetar como “sin rol” ni borrar una sesión válida por fallo temporal;
- esquema inesperado: error controlado, no conceder identidad.
No mostrar formularios de selección multiempresa sin que el backend los soporte.
Salida: flujo Auth robusto y pruebas de sus estados; no cambios al contrato /me por ampliar nombre/marca.

## 6. AUTH-FE-03 — Inicio autenticado y módulos disponibles
En modo api crear una vista de identidad conectada sin depender de Dashboard, Perfil o Taller de negocio. Usar el diseño/componentes existentes. Login y restauración llevan a esta vista; gestionar destinos guardados no disponibles.
Ocultar cuentas demo y resetDemo en modo api. Mantener modo mock separado, sin fallback silencioso.
No cargar pedidos/pagos/alertas/resultados ni suscripciones que los precarguen desde el shell. Auditar AppLayout, menús, buscador y hooks de prefetch; la landing api no debe disparar una cascada de 404.
Representar módulos pendientes en la navegación y proteger también acceso directo por URL. El bloqueo de UI indica disponibilidad, no reemplaza permisos backend.
Mostrar errores de identidad/reintento/logout con lenguaje de producto, sin detalles de infraestructura innecesarios.
No implementar endpoints dummy o devolver saldos vacíos para fingir integración. Las restricciones por marca/cartera siguen pendientes.

## 7. AUTH-FE-04 — Pruebas y puesta en marcha local
Pruebas frontend específicas: Bearer con token actual, validación /me, conservación org/rol, cada error401/403/409/503, restore, refresh, logout y carrera de respuesta tardía. Distinguir tests con API stub de pruebas reales.
Comandos: npm test, npm run build; reejecutar ./mvnw verify si cambia código/config backend. No exigir suite completa backend por modificar solo documentación frontend.
Navegador real: login cuenta de prueba → /me200 con Bearer → vista identidad → recarga conserva sesión → logout retira acceso. Usuario sin membresía403, múltiples409, infraestructura caída503; no resetear DB para generarlos. Fixtures aislados para negativos si no hay cuentas configuradas.
Evidencia: versión Git, entorno, roles, rutas/status, resultado esperado/observado, fecha y límites; ocultar tokens/contraseñas en capturas y trazas. Confirmar que no se llaman APIs no implementadas.
Servicios del usuario5433/8080/5173 siguen activos; no matarlos ni reiniciarlos desde Claude. Para pruebas adicionales usar puertos libres y detener solo instancias propias. Miguel reinicia sus paneles al terminar para cargar .env/config nueva.
Cerrar en real solo con Auth real y membresía DB real. Si credenciales faltan, preparar código/pruebas y listar qué necesita Miguel, sin declarar conectado.

## 8. Responsables, registro y secuencia posterior
Miguel/Claude implementan esta conexión solicitada, respetando el frontend de Germán/Isabella. Un escritor por archivo; delegación acotada útil: revisión solo lectura de contrato/seguridad frente a constructor frontend, sin ediciones simultáneas.
Ejecutar AUTH-FE-01 a04 secuencialmente; continuar trabajo independiente de credenciales mientras se solicita configuración faltante. No rehacer backend ya entregado.
Registrar estado en estado.md y resumen AGENTS; actualizar README frontend, guía integración y matriz cuando corresponda. Regenerar/check skill al cambiar conocimiento.
Sin commit/push/fetch/cambio de rama por Claude. Miguel entrega output a Codex para revisar y publicar.
Después continuar MIG-03-C (contexto JDBC general), MIG-03-D (permisos/API key), MIG-04 en adelante. Esta conexión /me no los cierra.

## 9. Prompt para Claude
Trabaja en /home/miguel/dev/hackaton/conocimiento, rama backend-migueltarea2y3. Usa keptai-conocimiento, AGENTS/CLAUDE y este plan.
Implementa únicamente AUTH-FE-01 a04: conectar login/sesión y GET /api/v1/me del frontend existente a Spring. Sigue el plan por entregas verificables y reporta su estado individual.
El frontend ya tiene Auth y cliente HTTP: corrige e integra, no recrees la aplicación. /me es la única API de negocio/identidad disponible; crea inicio conectado sin disparar APIs pendientes ni mezclar mocks con identidad real.
Distingue401/403/409/503, conserva organización y rol resueltos por backend, escucha cambios de sesión y protege contra respuestas tardías. No implementes selector multiempresa ni endpoints ficticios.
Revisa configuración/provisión y pide solo los valores faltantes; nunca publiques secretos. Si no hay Auth real, termina el código y las pruebas independientes y declara integración parcial.
Puedes delegar revisión acotada sin dos escritores sobre los mismos archivos. No tocar V1–V7, base manual, Supabase remoto ni servicios del usuario. No Git mutante.
Entrega pruebas, pasos de configuración/reinicio/manual y límites. Actualiza bitácora, AGENTS, guías y snapshot skill; luego Miguel pasará el output a Codex para commit/push.
