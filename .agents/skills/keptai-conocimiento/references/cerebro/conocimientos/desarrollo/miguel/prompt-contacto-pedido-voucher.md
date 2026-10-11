# Prompt Claude — asociación de contacto, pedido y voucher antes de desplegar

Implementa esta entrega en el checkout `/home/miguel/dev/hackaton/conocimiento`, rama `backend-partefinal`. Lee AGENTS.md, la skill keptai-conocimiento, el índice/decisiones del cerebro, Actores/flujos/DER vigente, estado.md, contrato/OpenAPI y las migraciones V1–V9. Conserva los cambios de preparación Docker de Codex. No hagas commit, push, fetch, merge ni cambio de rama. No despliegues todavía.

## Dirección confirmada por Miguel (11/10/2026)

La entrada n8n debe contrastar el JID con los contactos previamente registrados. Demo: Cloud Technologies es CLIENTE de Corpotex; Andrés es CONTACTO de ese cliente, teléfono +51 951 570 191, JID canónico `51951570191@s.whatsapp.net`. No es vendedor ni organización tenant ni usuario de Auth. No inventar RUC, marca, crédito ni correo.

Miguel indica dejar PENDIENTE el vendedor porque todavía no tiene uno. No fabricar un usuario VENDEDOR, Auth UUID o número, ni usar el JID del cliente como autorización. `vendedorJid` sigue sin acreditar identidad humana; confirmación `/api/v1/ordenes/confirmar` y cambios financieros conservan sus bloqueos. En esta entrega el resultado de la ingesta sigue BORRADOR con hoja de resumen, no una venta confirmada.

Voucher: debe quedar relacionado con el último pedido del contacto conocido. Esto es asociación contextual, NO verificación bancaria, NO aplicación ni disminución de saldos.

## Implementación acotada

1. Revisa el esquema real: V6 retiró contacto y nota_cliente; canal_whatsapp ya tiene cliente_id/vendedor_id, pero no sustituye un registro de contacto con nombre. Introduce una NUEVA migración versionada (siguiente libre, previsiblemente V10), sin reescribir V1–V9 ni resucitar nota_cliente. Restaura/define contacto con organización, cliente, nombre, JID canónico y estado activo; clave única org+JID y FK compuesta org+cliente. Solo metadatos, nada de mensajes. Actualiza DER/diccionario/mapa de tablas con el cambio dirigido por Miguel; no justificarlo por conteo fijo.

2. Políticas RLS y grants explícitos: INGESTA puede leer contactos activos de SU organización para resolverlos, no crearlos ni modificarlos. Administración humana mediante el rol autorizado vigente; bootstrap/provisión con migrador de forma explícita. Sin permisos anon/authenticated/service_role para Data API de negocio, sin SELECT global ni BYPASSRLS. FKs impiden contacto/cliente/orden/pago cruzados entre organizaciones. Si hay que leer un vendedor, NO ampliar permisos ahora: su validación queda pendiente.

3. JID: normalización del teléfono de provisión a formato canónico (dígitos internacionales + @s.whatsapp.net); las peticiones n8n deben ajustarse al formato del contrato, sin coincidencias parciales, nombres, pushName, últimos dígitos ni datos de extracción para identificar al cliente. No interpretar JID de grupo o @lid como teléfono sin mapeo explícito. Para WF1 resuelve chatId; para WF2 clienteJid, verificando coherencia con chatId cuando ambos sean JID de contacto. Resolver siempre dentro de TenantTransaction con organización/instancia de ServiceAuthentication. Un contacto inexistente o inactivo devuelve error controlado 422, sin crear pedido, pago ni archivo ni reserva idempotente persistida. Documenta códigos y privacidad del error.

4. Ingesta: asigna cliente_id resuelto a canal_whatsapp y orden BORRADOR; no sobrescribas un canal ya vinculado a otro cliente. Genera hoja de resumen con razón social real Cloud Technologies y contacto Andrés provenientes de BD, junto con la extracción estructurada; ni nombres del chat ni respuesta LLM sustituyen esos datos. Mantén items/coherencia/límites, idempotencia, RLS y concurrencia de la entrega anterior. vendedor_id permanece sin resolver y con aviso explícito; marca sigue según alcance anterior. No almacenar transcript/hoja entrante/crudo. No confirmar, aprobar crédito ni habilitar producción.

5. Voucher: consulta el último pedido no CANCELADO del contacto, misma organización, instancia y canal; no elegir pedidos de otro contacto que pertenezca a la misma empresa. Selección por creado_en descendente al registrar por primera vez; define/documenta comportamiento en empate ambiguo y evita elección silenciosa arbitraria. Persistir la asociación de contexto cliente+orden en una FK compuesta nueva apropiada (por ejemplo referencia nullable de orden en pago), distinta de aplicacion_pago. Verifica que la orden pertenece al cliente y al canal del contacto, por integridad SQL y backend, no solo IDs. Devuelve ordenRef real. La asociación elegida queda congelada en la respuesta idempotente: un nuevo pedido posterior no reasigna un replay. No usar el ordenRef que mande el cliente ni la fecha de la IA para elegir.

6. Si un contacto conocido no tiene pedido elegible, conserva el voucher/pago RECIBIDO sin asociación a orden y con estado/aviso SIN_ORDEN conforme al contrato; no crear pedido ficticio ni aplicar fondos. DUPLICADO financiero prevalece sobre SIN_ORDEN cuando corresponda. Mantén hash/validación ImageIO/PDFBox, Storage privado, compensación y cerrojos/idempotencia. No tocar el motor para autoaplicar pagos.

7. Provisión demo: script parametrizado con vista previa por defecto y --apply explícito, SOLO base local. Organización existente Corpotex; cliente Cloud Technologies tipo EMPRESA, contacto Andrés con el JID autorizado. Reejecución no duplica ni modifica silenciosamente datos distintos. No aplicar seed demo al iniciar prod. Probar el script en PostgreSQL desechable; si aplicas local por la autorización expresa de Miguel, valida primero la migración y no sobrescribas datos existentes. No crear vendedor ni servicio extra. No insertar un pedido de venta inventado en la base activa: que lo cree la ingesta real/ficticia autorizada.

## Pruebas y aceptación

- PostgreSQL desechable con todas las migraciones y rol runtime NOSUPERUSER NOBYPASSRLS no propietario. Fixtures de contactos/clientes se crean por owner; no debilitar las aserciones existentes.
- JID Andrés → Cloud Technologies, orden/hoja/canal correctos; nombre de cliente forjado en IA no cambia identidad; desconocido/inactivo rechazado; teléfono del cliente nunca autoriza como vendedor.
- Dos empresas con el mismo JID no se cruzan; dos contactos de un mismo cliente no se intercambian pedidos; FK rechaza asociación cruzada o cliente/pedido incoherente.
- Dos pedidos del contacto, voucher refiere al último elegible; último CANCELADO excluido; sin pedido registra SIN_ORDEN; replay tras nuevo pedido conserva la referencia original.
- Concurrencia ingesta/voucher: selección consistente dentro de transacción y asociación auditable; carreras sin doble orden/pago/archivo. Pruebas existentes de duplicado financiero, idempotencia y compensación conservadas.
- No verificar ni aplicar: fase RECIBIDO, sin aplicaciones ni cambios de saldos/obligaciones. Contacto desconocido no sube archivo.
- Suite backend verify completa, contrato OpenAPI, HTTP desechable actualizado y frontend/build según impacto. Comprueba Docker build tras migración, recordando que la imagen NO migra la base al arrancar.
- Conserva procesos del usuario 5433/8080/5173 y otros desconocidos; no imprimir claves/env/JIDs en logs innecesarios. Sin cambios remotos de Supabase/n8n/DNS/hosting.

Actualiza estado.md, resumen de AGENTS.md, plan, docs n8n/OpenAPI, DB/DER/RLS y regenera skill preservando diagramas históricos con --check. Entrega resultados, cambios y pendientes. No declarar listo para n8n público: aún falta validar esquema remoto/runtime, provisionar credencial en base del despliegue y DNS/HTTPS. Vendedor y validación humana de /cerrar quedan explícitamente pendientes.
