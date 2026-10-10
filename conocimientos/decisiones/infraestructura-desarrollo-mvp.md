# Infraestructura y tecnologías para desarrollar el MVP KeptAI

> ID: PROP-INFRA-001. Versión: 1.0. Fecha: 10 de octubre de 2026, America/Lima.
> Origen: solicitud del usuario de completar el roadmap con infraestructura y tecnologías.
> Estado: recomendación técnica para comenzar. No acredita cuentas creadas, servicios contratados, código implementado ni aprobación empresarial de políticas.
> Alcance: prototipo funcional de captura, conciliación, cobranza y rentabilidad/caja. Miguel y Andrés backend; Germán e Isabella frontend. No incluye preparación de pitch.

## 1. Recomendación principal y criterio de elección

Para cuatro integrantes, una ventana corta y datos financieros relacionados, recomiendo **React + TypeScript + Vite, Cloudflare Workers Static Assets, Supabase y Gemini API**.

Esta combinación mantiene un lenguaje principal en frontend y funciones, ofrece una base relacional para saldos y costos y permite alojar web, API y evidencias sin administrar un servidor permanente. No constituye una afirmación de que sea la mejor arquitectura para todos los negocios: es la base recomendada para este equipo y este MVP. Debe pasar una prueba de acceso, carga de archivo y despliegue durante el primer bloque.

La aplicación vive en un repositorio de código separado del cerebro. Se propone una sola aplicación web y un backend de funciones con módulos compartidos. No crear ahora ese repositorio ni contratar servicios: esta entrega documenta cómo hacerlo.

## 2. Tecnologías por componente

### Frontend — Germán e Isabella

- **React + TypeScript + Vite:** tres pantallas del roadmap, componentes compartidos y build estático. Elegir versiones estables compatibles, guardar el lockfile y usar la misma versión Node en desarrollo y CI. [Vite](https://vite.dev/guide/).
- **Node.js 24 LTS + npm:** herramientas de desarrollo y build. Node no es el runtime de las funciones de Supabase. [Node LTS](https://nodejs.org/en/about/previous-releases).
- **CSS y componentes accesibles reutilizables:** partir de lo que el equipo ya conoce y de una única librería visual si se necesita. No introducir un generador de interfaces ni varias librerías de componentes como dependencia del flujo.
- **@supabase/supabase-js:** sesión, acceso autorizado y carga de evidencias; el cliente privilegiado permanece fuera del navegador.
- **Zod:** contrato y validación de datos en TypeScript. Mantener las reglas monetarias y transaccionales en backend/base de datos, aunque el formulario también valide. [Zod](https://zod.dev/).

Isabella construye experiencia, componentes y reglas funcionales; Germán estructura rutas, cliente de API, sesión, carga y manejo técnico de errores. El servidor es la autoridad de saldo y margen.

### Hosting web — Germán

**Cloudflare Workers Static Assets** sirve el build de Vite. Se usa como alojamiento del frontend; el backend de negocio sigue en Supabase. Cloudflare recomienda Workers para proyectos nuevos en lugar de comenzar un proyecto nuevo de Pages. [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [orientación de plataforma](https://developers.cloudflare.com/pages/framework-guides/).

- Build: `npm ci` y `npm run build`; salida `dist/`.
- Configurar assets apuntando a `dist/` y fallback `single-page-application` para abrir directamente rutas del frontend.
- La URL inicial es el subdominio disponible del servicio; el dominio propio no es dependencia para empezar.
- Configurar variables de build públicas y URLs permitidas de retorno de Auth y CORS.
- Conectar GitHub al despliegue cuando el proyecto ya exista; una publicación manual con Wrangler sirve como primera prueba.

La configuración SPA y los builds están documentados por el proveedor. [SPA](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/), [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/).

### Backend — Miguel y Andrés

**Supabase Edge Functions con TypeScript, runtime Deno:** servicios de captura, revisión, consulta, conciliación, finanzas y reporte. Separar módulos dentro de un backend común; no crear un segundo servidor Laravel/Spring en paralelo. [Funciones](https://supabase.com/docs/guides/functions).

- **Miguel:** endpoints, autenticación de llamadas, orquestación de Gemini, borradores, pedidos y acceso a resultados.
- **Andrés:** esquema, migraciones, operaciones transaccionales, costos, caja, estados y permisos en datos.
- Una función de API con rutas internas puede bastar al principio; separar extracción cuando convenga por límites o permisos. Compartir contratos y errores.
- Respuestas con `request_id`, estado y error recuperable; entradas validadas y operaciones repetibles sin duplicar negocio.

No ejecutar OCR pesado, transcodificación ni procesamiento largo en Edge Functions. Usarlas para llamar a la API multimodal y guardar resultados. Si el procesamiento excede el tiempo de la solicitud, registrar un trabajo persistente y consultar su estado; no confiar en que un proceso en memoria seguirá activo indefinidamente. Los límites de memoria, CPU y duración deben revisarse en el plan activo. [Límites](https://supabase.com/docs/guides/functions/limits).

### Datos y transacciones — Andrés

**PostgreSQL administrado por Supabase**, con migraciones SQL versionadas. Para este dominio es preferible una base relacional por las relaciones entre documentos, pagos, aplicaciones, costos y entidades; la elección es una recomendación de diseño, no una limitación universal de otros productos.

- Entidades mínimas: organizaciones, membresías, entidades comerciales, marcas/líneas, clientes, pedidos, evidencias, borradores, documentos por cobrar, pagos, aplicaciones, costos, cargos internos, movimientos/expectativas de caja, alertas y auditoría.
- `organization_id` separa empresas usuarias del producto; `entity_id`, marca y línea describen unidades dentro de un acceso autorizado. No convertir marcas de Corpotex en personas jurídicas confirmadas.
- Para PEN, guardar importes como centavos enteros o `numeric` decimal con escala definida. No calcular saldos con punto flotante JavaScript. El contrato debe fijar representación y límites; ratios se redondean para mostrar, no para rehacer saldos.
- Guardar instantes con zona y convertir presentación a America/Lima; los vencimientos de fecha calendario mantienen su significado local.
- Aplicar un pago, validar saldo y registrar auditoría en **una transacción SQL/RPC**, con bloqueo del documento y claves de idempotencia. Varias llamadas sueltas del SDK no forman una transacción.
- Restringir inserción y modificación directa de aplicaciones de pago: el navegador no puede saltarse verificación y autorización llamando a una tabla o RPC sin controles. El permiso y la verificación se validan dentro de la operación.
- Detectar posibles duplicados por referencia, canal, destinatario y organización cuando existan; hash de archivo es una señal complementaria. Un campo ausente exige revisión y un duplicado no prueba fraude.

Andrés controla migraciones y secuencia de despliegue; Miguel consume las operaciones del motor. [Migraciones](https://supabase.com/docs/guides/deployment/database-migrations).

### Autenticación y archivos — Germán, Miguel y Andrés

**Supabase Auth:** comenzar con acceso email/contraseña para cuentas de prueba precreadas, comprobadas en demo; no depender de un correo de confirmación durante el recorrido. [Auth](https://supabase.com/docs/guides/auth). Cuentas de prueba creadas para el equipo y roles mínimos de revisión/administración. El prototipo no necesita construir un sistema de identidad propio. Configurar el método de acceso y comprobarlo en la URL real antes de depender de correo u OAuth durante la entrega.

**Supabase Storage privado:** un bucket de evidencias, con rutas por organización y evidencia; otro de reportes solo si se necesitan archivos persistentes. Conservar `storage_path`, tipo, tamaño, hash, autor y procedencia. Usar descarga autenticada o enlaces firmados breves para revisión; no hacer públicas fotos de vouchers. [Buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals).

**RLS + grants + controles del servidor:** política por membresía de organización y acceso a entidad. Revisar permisos de tablas, vistas, RPC y archivos; una clave privilegiada salta RLS y no garantiza aislamiento por sí sola. Preferir contexto del usuario para negocio y limitar tareas privilegiadas a rutas controladas. [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Captura con IA — Miguel

**Gemini API**, modelo inicial recomendado **`gemini-3.5-flash-lite`**, configurable mediante `GEMINI_MODEL`. La ficha oficial lo identifica como estable y con entrada de texto, imagen/audio/PDF y salida estructurada; es adecuado como punto de partida de extracción. Probar accesibilidad y calidad con las tres modalidades en la cuenta del equipo antes de fijarlo. [Modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

- Enviar evidencia desde backend y pedir un JSON con campos, valores ausentes y fragmentos de procedencia. El modelo sugiere; una persona corrige y confirma.
- Validar esquema y reglas con Zod o validación equivalente del servidor. JSON válido no garantiza verdad del importe o autenticidad del voucher.
- No usar IA para calcular saldos, aprobar crédito ni confirmar fondos bancarios: esas operaciones tienen reglas y responsables explícitos.
- La llamada no recibe herramientas para modificar cuentas; texto del chat se trata como evidencia, no como instrucción del agente.
- Poner timeout, límite de tamaño del MVP, límite de intentos y estado de fallo. Para comenzar se proponen imágenes hasta 5 MB y audio corto hasta 10 MB; son límites del producto propuestos, no límites oficiales de Gemini.
- Si un archivo necesita Files API, no publicar la URL privada del Storage ni asumir que Gemini puede leerla: subirlo por el backend y registrar su ciclo de vida. Comprobar formatos y restricciones vigentes.

La API contempla extracción de imagen/audio y respuestas con esquema. [Imagen](https://ai.google.dev/gemini-api/docs/image-understanding), [audio](https://ai.google.dev/gemini-api/docs/audio), [salida estructurada](https://ai.google.dev/gemini-api/docs/structured-output).

### Alertas y trabajos — Andrés y Miguel

Empezar con alertas persistidas en PostgreSQL y evaluación al actualizar el pedido o pago. Añadir **Supabase Cron** para revisar vencimientos y reportes cuando el recorrido básico ya funcione. [Cron](https://supabase.com/docs/guides/cron).

Para cada trabajo guardar estado, intentos, próxima ejecución y error. Una reejecución no duplica alertas ni pagos. Supabase Cron dispara trabajo acotado; no sustituye un worker largo. Eliminar avisos pendientes cuando se confirme pago, y suspender avisos externos si saldo o conciliación están desactualizados.

Durante el MVP, las alertas se muestran en la aplicación. WhatsApp/correo reales entran cuando exista canal autorizado y configuración comprobada. Kommo, ERP y Apps Script mantienen conectores pendientes; usar archivos para la prueba no acredita una integración.

### Pruebas y operación — cada dueño de módulo

- **Vitest:** validadores, transformaciones y funciones TypeScript puras compartidas. [Vitest](https://vitest.dev/guide/).
- **Deno test/SQL y pruebas de API:** Andrés y Miguel comprueban el motor real, transacciones, permisos y repetición de pagos; un test de UI no demuestra atomicidad.
- **Playwright:** Germán automatiza el recorrido desplegado, móvil, recarga y estados fallidos con Andrés coordinando los resultados. [Playwright](https://playwright.dev/docs/intro).
- **GitHub Actions:** typecheck, pruebas y build por PR; ejecutar con Node 24 y lockfile. Aprobar migraciones y despliegue por responsable, sin publicar cada rama contra datos del piloto. [CI Node](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).
- **Logs de Supabase y Cloudflare:** trazabilidad por `request_id`, resultado y latencia. No registrar claves, vouchers completos o transcripciones sensibles en logs. Sentry es posterior si esos logs no bastan.

## 3. Arquitectura y recorrido operativo

```mermaid
flowchart LR
    U[Usuario en computadora o móvil] --> WEB[React y Vite en Cloudflare Static Assets]
    WEB --> AUTH[Supabase Auth]
    WEB --> FILE[Supabase Storage privado]
    WEB --> API[Edge Functions: API autenticada]
    API --> IA[Gemini: extracción de borradores]
    API --> DB[(PostgreSQL: RLS y operaciones transaccionales)]
    DB --> RULES[Saldo, costos, margen y caja a 4 semanas]
    RULES --> API
    API --> WEB
    CRON[Supabase Cron: vencimientos y trabajos acotados] --> DB
    DB --> REPORT[Reporte y CSV]
    REPORT --> WEB
    EXT[Kommo y ERP: acceso pendiente] -.-> API
```

La carga directa a Storage solo está permitida con sesión y política de organización. La extracción corre en backend. El comprobante pasa por borrador, revisión, verificación y aplicación; solo la última operación modifica el saldo. Los cargos internos afectan resultados de gestión según la regla, pero no crean entrada bancaria externa.

## 4. Estructura del repo de aplicación propuesto

```text
repo-aplicacion/
├── src/
│   ├── features/captura/
│   ├── features/pedidos-cobranza/
│   ├── features/resultados-caja/
│   ├── components/
│   └── lib/api/
├── supabase/
│   ├── functions/api/
│   ├── functions/extract-evidence/
│   ├── functions/_shared/
│   ├── migrations/
│   └── seed.sql
├── tests/e2e/
├── docs/contrato-api.md
├── .github/workflows/checks.yml
├── .env.example
├── package-lock.json
└── wrangler.jsonc
```

Esta estructura no existe por documentarla. Germán controla estructura frontend y hosting; Isabella componentes/flujo; Miguel funciones/API; Andrés migraciones y motor. Los contratos entre ambos equipos se versionan antes de completar toda la lógica.

## 5. Entornos, secretos y puesta en marcha

### Entornos mínimos

- **Local:** Node 24, npm y Supabase CLI. La pila Supabase local usa un runtime Docker compatible cuando se levanta completa; si el equipo no lo tiene listo, usar un proyecto remoto de demo con datos ficticios y aislamiento por miembro/semilla. [CLI local](https://supabase.com/docs/guides/local-development/cli/getting-started).
- **Demo compartida:** un proyecto Supabase exclusivo para demostración y un frontend desplegado. Las previews solo acceden a datos ficticios; no se conectan al piloto real.
- **Piloto posterior:** proyecto separado, datos autorizados, backups y restauración probada. No reutilizar claves ni el proyecto de demo como producción por comodidad.

El uso de Docker aquí se limita al entorno local; no implica desplegar un clúster o administrar un VPS.

### Variables públicas del frontend

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_ENV`. Toda variable `VITE_` debe tratarse como pública. Nunca incluir una clave IA o privilegiada allí.

### Variables y credenciales de backend/CI

`GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGINS` y, solo para tareas que lo requieran, la clave privilegiada de Supabase. Guardarlas en secretos del proyecto; `.env.example` lleva nombres, no valores. Credenciales de despliegue Cloudflare/Supabase van en secretos de CI y en las cuentas de responsables, sin compartirse en Markdown ni chats. [Secrets](https://supabase.com/docs/guides/functions/secrets).

Validar sesión/JWT, pertenencia, rol y permiso en cada operación. CORS restringido al origen conocido ayuda al navegador, pero no reemplaza autenticación ni autorización. Configurar retorno de Auth para URL local y desplegada.

### Orden concreto para comenzar

1. **Andrés + Miguel:** comprobar acceso al proyecto Supabase y al proveedor IA; decidir región del proyecto según disponibilidad y latencia probada. No asumir región o plan de la cuenta.
2. **Germán:** inicializar React/TypeScript con Vite en el repo de aplicación acordado, fijar Node/lockfile y publicar una página mínima en Cloudflare.
3. **Andrés:** migración inicial, membresías, RLS/grants y datos ficticios P-001/P-002; preparar operación de pago transaccional.
4. **Miguel:** función autenticada de salud/consulta y extracción de una muestra; configurar secretos, timeout y corrección humana.
5. **Germán + Isabella:** iniciar sesión, cargar evidencia privada y consultar el mismo pedido mediante API.
6. **Los cuatro:** primera prueba remota antes de H1: autenticación → evidencia → borrador → pedido persistente. Si no pasa, resolver infraestructura antes de ampliar pantallas.
7. **Andrés + Miguel:** conectar aplicación de pago, resultados y caja; Germán integra; Isabella valida la lectura funcional.
8. **Germán + Andrés:** build/pruebas y recorrido móvil de la URL final; anexar resultados y procedimiento de reinicio.

Para iniciar la app, los comandos orientativos son `npm create vite@latest . -- --template react-ts`, `npm install` y `npm run dev` dentro de un repo vacío acordado; después fijar las versiones resueltas. Supabase CLI y Wrangler se instalan conforme al entorno y documentación vigente. No ejecutar estos comandos en este repo de conocimiento ni usar `db reset` contra un entorno compartido para limpiar una demo.

## 6. Costos, recuperación y criterios de infraestructura lista

No se prescribe una tarifa: depende de planes, cuotas, región, llamadas IA, almacenamiento y egreso. Verificar cuentas y límites al empezar; usar niveles disponibles para la demo y aprobar un presupuesto máximo antes de contratar o activar cobros. El costo del piloto requiere medición, no asumir gratuidad por usar servicios administrados.

Semilla ficticia versionada + migraciones permiten reconstruir la demo. Para datos reales, programar respaldo de base y de archivos privados por separado y probar restauración; un dump SQL no respalda las imágenes del Storage. Guardar backups fuera del repo y comprobar la cobertura del plan activo. [CLI de respaldo](https://supabase.com/docs/reference/cli/supabase-db-dump).

Infraestructura lista significa que existe evidencia de:

- URL con HTTPS que abre y recarga una ruta interna del frontend.
- Acceso de prueba funcionando y usuario no autorizado rechazado.
- Archivo privado que un usuario de otra organización no puede descargar.
- Función desplegada accesible desde frontend sin claves IA/privilegiadas en navegador.
- Pago duplicado/reintentado aplicado una sola vez en la base real.
- Costos/caja y CSV calculados desde registros persistidos.
- Logs suficientes para localizar un fallo sin exponer evidencias.
- Lockfile, migración y semilla que otro integrante puede reproducir.

No incluir Kubernetes, Redis, Kafka, Jenkins, Pinecone, servidor OCR propio o múltiples backends para comenzar. Si aparece una necesidad concreta posterior de procesamiento pesado, incorporar un worker separado con cola persistente; no migrar todo el producto por anticipación.

## 7. Relación con el roadmap

Los pasos 1–4 pertenecen a B0/B1; la integración real al cierre H1/B2; transacciones, resultados y captura completa a B2–B4; estabilidad y recuperación a B5–B8. El [roadmap](roadmap-hackathon-equipo.md) contiene responsables y entregables por bloque.

Esta recomendación amplía P-004/P-005 sin convertirlas en aprobación empresarial. Las fórmulas financieras, políticas de crédito y acceso a sistemas de Corpotex siguen pendientes de validación donde lo indican las fuentes. Documentación técnica consultada el 10 de octubre de 2026; verificar versiones/cuotas al implementar.
