> Actualización D-007/V4–V5: leer [revisión SQL](../../../../BD/revision-sql-rls.md). La dirección vigente no guarda mensajes; el contexto exige usuario o servicio activo además de organización, y Storage tiene SQL separado. Las notas V1–V3 abajo se conservan como antecedente donde difieran.

# Preparación de Supabase y RLS para la aplicación

> ID: MIG-SUPA-001. Fecha: 10 de octubre de 2026. Fuente: aclaración directa de Miguel en esta conversación. Estado: traspaso técnico para Andrés; no acredita despliegue ni acceso JDBC verificado.

## Estado confirmado por Miguel

El equipo ya conectó Supabase mediante MCP. No se ha creado el `.env` de la aplicación. La conexión MCP sirve para administrar o inspeccionar el proyecto desde el agente que la tiene; no configura automáticamente Spring Boot. No copiar tokens MCP, claves de administración ni credenciales a este documento o al repositorio.

## Orden de integración para Andrés y Miguel

1. Identificar en la sesión MCP de Andrés el proyecto y entorno correctos, el esquema existente y el historial de cambios ya aplicado. Leer antes de ejecutar. Registrar nombres y resultados sin secretos; una conexión exitosa no prueba migraciones aplicadas.
2. Mantener un solo historial para V1-V3 de `BD/migrations/`. Preparar su ubicación definitiva en `Backend/src/main/resources/db/migration/` con Andrés como dueño. Si ya se ejecutaron por MCP, reconciliar ese estado con Flyway antes del primer release; no ejecutar de nuevo ni usar baseline/repair sin comparar el esquema real. No renombrar o editar migraciones ya aplicadas.
3. Usar esquema privado `keptai`, sin exposición a Data API, con esquema/search_path fijados explícitamente y sin depender del `public` por defecto. Las migraciones usan nombres sin cualificar: verificar que tablas, funciones y vistas caigan realmente en `keptai`.
4. Preparar dos identidades distintas: migrador propietario para despliegue y runtime no propietario, sin superusuario ni BYPASSRLS. Roles, grants, restricciones de borrado y permisos de funciones/vistas se revisan en el proyecto real. No usar la identidad de administración del MCP como usuario runtime.
5. Documentar el arranque seguro de la identidad: Supabase Auth emite JWT, Spring verifica firma/emisor/audiencia/expiración, obtiene el `sub` y resuelve el usuario activo y su organización desde datos autorizados. Como `usuario` también tiene RLS, acordar un mecanismo de resolución inicial mínimo; no resolverlo confiando en `organizacion_id` enviado por cliente, ni desactivar RLS globalmente. La implementación pertenece a MIG-03.
6. En cada transacción de negocio, Spring establece `set_config('app.organizacion_id', orgIdAutorizado, true)` y `app.usuario_id` o `app.servicio_id` (exactamente uno) y consulta/escribe usando la misma conexión y transacción. Esto incluye consultas GET. Con autocommit, el contexto local puede desaparecer antes de la siguiente consulta. No conservar contexto de sesión entre peticiones del pool.
7. Configurar el `.env` local después, usando `.env.example` como inventario de nombres. Spring no carga un archivo `.env` automáticamente: documentar el mecanismo de carga o exportar variables antes de arrancar. La configuración runtime no usa la contraseña del migrador. Mantener Flyway desactivado en runtime y `ddl-auto=validate`.
8. Ejecutar primero pruebas aisladas y después las del entorno Supabase autorizado con datos ficticios. Registrar lo comprobado y lo que sigue pendiente antes de cerrar MIG-03.

## RLS que debemos comprobar

Las políticas V2/V3 filtran por `app_organizacion_actual()`, y las vistas V1 usan `security_invoker=true`. Son controles PostgreSQL para conexiones del backend; un JWT recibido por Spring no establece ese contexto JDBC. El frontend no debe escribir directamente pagos o aplicaciones mediante Data API.

Pruebas mínimas con el rol runtime real:

- Sin contexto: ninguna fila de negocio visible; inserciones/modificaciones rechazadas.
- Contexto de organización A: lectura de A; lectura y escritura de B rechazadas, incluidas referencias cruzadas.
- Transacciones consecutivas A, B y sin contexto sobre una conexión reutilizada: sin filtración de filas de A hacia B.
- Commit y rollback: el contexto local no permanece para la siguiente transacción.
- Vistas, funciones y trigger de aplicación: no eluden RLS ni permisos por usar un propietario privilegiado.
- Historial de aplicaciones/auditoría: permisos de borrado restringidos y mecanismo de corrección acordado.
- JWT válido de usuario inactivo o sin membresía: acceso rechazado antes de fijar contexto.
- Entrada n8n autenticada: la organización se resuelve desde una instancia/identidad autorizada del servidor; `X-Api-Key` no autoriza una organización arbitraria declarada en el cuerpo.

RLS no reemplaza permisos por rol de negocio: vendedor, administración y gerencia tienen operaciones diferentes aunque pertenezcan a la misma organización.

## Auth y Storage también necesitan configuración

JWT y JWKS dependen del proyecto y de su método de firma. Registrar issuer, JWKS y audiencia comprobados antes de configurarlos; no asumir discovery OIDC. Storage mantiene políticas propias y un bucket privado: las políticas de las tablas `keptai` no protegen por sí solas `storage.objects`. Verificar upload, lectura, URL firmada breve y denegación entre organizaciones; los vouchers permanecen privados.

## Variables que se completarán fuera de Git

- Runtime JDBC: `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`; URL con TLS y modo de conexión compatibles con el proyecto.
- Auth: nombres propuestos `SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWKS_URI`, `SUPABASE_JWT_AUDIENCE`, vinculados explícitamente a configuración Spring en MIG-03.
- Frontend: URL y clave pública publicable correspondientes; ninguna contraseña JDBC, clave de administración o secreto n8n llega a variables `VITE_`.
- Credencial migradora: solo en el paso controlado de release; no reutilizar la variable runtime para reemplazar temporalmente su rol en la app.

No hacen falta estas credenciales para cerrar las pruebas de infraestructura de MIG-01. Son necesarias para acreditar la conexión real de la aplicación y el aislamiento de MIG-03.

## Fuentes y traspaso

- [Entrega de Andrés](../../../../BD/README.md), [diccionario](../../../../BD/diccionario-datos.md) y migraciones V1-V3: artefactos versionados, no evidencia de despliegue remoto.
- [Infraestructura](../../decisiones/infraestructura-desarrollo-mvp.md) y [modelo](../../decisiones/modelo-base-datos-mvp.md).
- [Revisión de integración](revision-integracion-andres.md): diferencias con el contrato MIG-02 y el middleware.

Miguel confirma conexión MCP; Andrés confirma estado remoto/migraciones/roles; Miguel configura JWT/JDBC y verifica RLS desde Spring. El paso que falta ahora es alinear el contrato de MIG-02 con esta entrega antes de implementar endpoints.
