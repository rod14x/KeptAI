# Configuracion local de Supabase Auth y vouchers
ID: MIG-CONFIG-001. Fecha: 10/10/2026. Estado: configuracion preparada; Auth real y upload pendientes.

## Estado comprobado
Backend MIG-03-B valida JWT y resuelve membresias en PostgreSQL local. No hay cliente Storage ni controller de subida implementados.
Proyecto aportado por Miguel: mcgkkoqgsbrjbdlayyww. JWKS publico respondio HTTP200 y publico clave EC/ES256, compatible con el decoder. Esto no acredita login ni membresia.
Captura aportada: bucket keptai-vouchers, siete politicas, 10MB, image/jpeg, image/png y application/pdf. No acredita bucket privado ni contenido/eficacia de politicas; inspeccionar via MCP antes de cambios.
El SQL esperado esta en BD/supabase/vouchers_storage.sql; no se aplico remoto.

## Archivos y claves
Backend/.env: archivo ignorado, creado sin secretos, formato Java properties. URL, issuer, JWKS, audiencia authenticated, CORS y bucket configurados. SUPABASE_SECRET_KEY queda vacia para introducirla manualmente desde Settings > API Keys, solo si el uploader servidor la necesita.
Frontend/.env.local: archivo ignorado, URL/API local preparadas y clave publicable vacia. Sigue en mock para conservar la demo hasta implementar AUTH-FE-01..04. Copiar solo clave publishable, nunca secret/service_role. Al probar Auth cambiar VITE_API_MODE a api y reiniciar Vite.
BD/local/.env: mantenerlo; contiene credenciales JDBC del rol runtime. No sustituirlas por claves de Supabase API.
No registrar secretos en docs, capturas, logs, prompts ni Git. No publicar archivos .env.

Las variables SUPABASE_URL/STORAGE_BUCKET/SECRET_KEY se reservan para MIG-04: hoy no hay codigo que las consuma. No declarar Storage conectado por llenar el archivo.
El panel Connect > Server muestra npm/@supabase/server para JavaScript. Nuestro Spring puede llamar la API HTTPS de Storage con cliente Java; ese paquete npm no se instala en Backend.

## Arranque en Zellij/WSL
Conservar DB activa. Detener solo el backend del propio panel con Ctrl+C antes de reiniciarlo:
    cd ~/dev/hackaton/conocimiento
    ./Backend/scripts/run-local.sh
El script usa ./mvnw, JDK Linux y perfil local. Importa Backend/.env como properties con spring.config.additional-location; application-local.yml conserva BD/local/.env. No ejecuta source sobre claves ni imprime valores.
Los valores del proceso tienen precedencia sobre archivos: una exportacion previa puede sobreescribir .env.
En el panel frontend, cuando corresponda reiniciarlo:
    cd ~/dev/hackaton/conocimiento/Frontend
    npm run dev
Si se lanza VITE_API_MODE=mock npm run dev, ese valor externo prevalece aunque el archivo diga api.
Comprobar desde otro panel:
    curl -i http://localhost:8080/actuator/health
El health200 acredita arranque; no acredita login, Storage o reglas de negocio.

## Conexion prevista y aislamiento
Frontend inicia sesion con Auth y clave publicable. Envia JWT propio a Spring. Spring valida firma y resuelve organizacion/rol mediante membresia local; necesita usuario.auth_user_id igual al sub real. Un login Auth sin membresia local obtiene403.
Subida propuesta MIG-04: archivo voucher -> Spring -> validacion actor/organizacion/relacion -> Storage privado -> referencia de comprobante en PostgreSQL. No guardar chat ni audio (D-007).
La clave secret/service_role puede saltar RLS. Si el servidor la utiliza, Spring debe autorizar cada operacion antes de llamar a Storage; no existe garantia de aislamiento por las siete politicas para ese cliente privilegiado.
Para operaciones con JWT de usuario las politicas dependen de las membresias del PostgreSQL remoto. La membresia local no aparece automaticamente en Supabase. No cambiar a upload directo desde el navegador sin resolver esa coherencia.
Ruta generada por servidor: organizacion UUID/comprobante UUID/nombre generado. No aceptar organizacion/path arbitrarios ni nombre original como autoridad. Archivo privado; lectura autenticada o URL firmada temporal tras autorizacion.
Tipos reales y limite10MiB comprobados, checksum/antiduplicado, timeout, sin sobrescritura y manejo de objeto huerfano ante fallo DB. PostgreSQL y Storage no comparten transaccion atomica: definir compensacion/limpieza con estado persistente.
Recibir/subir voucher no confirma fondos ni aplica saldo. No alterar saldos al subir.

## MCP de Claude y reanudacion
Supabase queda registrado en .mcp.json con project_ref del proyecto y read_only=true; se retiro el duplicado local de ~/.claude.json. La autenticacion OAuth de cada integrante es personal y no se comparte por Git ni se sustituye con SUPABASE_SECRET_KEY.
Desde WSL, en este repo, reiniciar Claude, abrir /mcp, seleccionar supabase y Authenticate; autorizar con la cuenta invitada a la organizacion. Si Claude pide habilitar el MCP de proyecto, aceptar el servidor de este repo. Confirmar Connected y ejecutar inspeccion solo lectura.
No declarar MCP conectado mientras diga Needs authentication. El siguiente paso de implementacion sigue AUTH-FE-01..04, no MIG-04.

## Siguiente entrega Claude
Primero AUTH-FE-01..04 del plan-conexion-frontend-auth.md: configuracion, membresia y login/me. Despues MIG-03-C/D y MIG-04 segun dependencias.
Para MIG-04 revisar contrato EvidenceDtos/OpenAPI, matriz-acceso y WF2 antes de escoger endpoint; no inventar un endpoint paralelo ni permisos.
Inspeccion MCP solo lectura de bucket, politicas y membresias remotas. Registrar alcance servidor vs JWT usuario y pruebas con dos empresas antes de habilitar upload real.
Criterio: upload autentico privado, referencia persistente, duplicado/reintento, rechazo sin permiso/cruzado/MIME/tamano, rollback compensado y lectura temporal autorizada. Sin credenciales pruebas aisladas no cierran integracion remota.

## Fuentes
- Skill keptai-conocimiento, D-007..010, actores/flujos/DER, plan MIG-FE-AUTH-001.
- BD/supabase/vouchers_storage.sql, Backend/src/main/resources/application-local.yml, Frontend/src/lib/supabase.ts.
- [Claves Supabase](https://supabase.com/docs/guides/api/api-keys).
- [Storage privado](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- [Subida de archivos](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
- [Configuracion Spring](https://docs.spring.io/spring-boot/reference/features/external-config.html).
