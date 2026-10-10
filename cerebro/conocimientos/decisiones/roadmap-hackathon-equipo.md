# Roadmap de desarrollo KeptAI — equipo y dependencias

> ID: PROP-ROADMAP-001. Versión: 1.3. Fecha: 10 de octubre de 2026.
> Estado: plan de ejecución propuesto; no acredita tareas hechas; Spring Boot y exclusión de ERP/CRM son dirección vigente del usuario D-004.
> Roles: USR-EQUIPO-002/003; Miguel y Andrés conocen Spring. Andrés define la base de datos; Germán adopta USR-DESIGN-001 con ajustes documentados.
> Ventana de referencia: sábado 10, 15:30, a domingo 11, 09:30; zona America/Lima. Son 18 horas restantes del esquema de 24 horas aportado, no 24 horas adicionales. Confirmar entrega y horarios con la organización.
> Alcance de esta documentación: desarrollo, integración, QA y preparación técnica de la demostración. **No se asignan tareas de pitch, slides ni exposición.**

## 1. Resultado que debe existir al terminar

Un prototipo funcional de la capa de caja de KeptAI, con tres pantallas y un mismo conjunto de datos, que permita:

1. Cargar un chat y vouchers, extraer datos y corregirlos con validación humana.
2. Asociar cada pago a su pedido, identificar duplicados y diferencias, y aplicar únicamente pagos verificados.
3. Mostrar saldo, vencimiento, estado de cuenta y una alerta de cobranza con responsable.
4. Mostrar costo y margen por pedido, línea y marca, un centro productivo de resultados y caja de cuatro semanas.
5. Exportar un reporte CSV y demostrar consulta móvil, por entidad y consolidada con acceso autorizado.

La demostración de referencia utiliza **3 vouchers y un chat**. Además debe haber costos, obligaciones, vencimientos y datos de caja cargados. No basta con simular valores en el frontend. Es un recorrido técnico para probar el producto; preparar el pitch queda fuera de este plan por instrucción del usuario.

**Fundamento:** [idea vigente](../empresa/idea-negocio-replanteada.md), USR-IDEA-001; [decisiones](decisiones-del-proyecto.md), D-003; [Reto 6](reto-6-corpotex-conciliacion-y-rentabilidad.md), C-01 a C-07.

### Entrada de datos y límites vigentes

No tenemos datos ERP/CRM. El MVP funciona sin esos sistemas: chat pegado/cargado, vouchers/audio subidos manualmente, registros/CSV y semilla ficticia de pedidos, costos, vencimientos y caja. Sin conectores, credenciales ni exportaciones ERP/CRM en B0–B8. La base propia es autoridad para la demo y conserva procedencia; no acredita sustituir el registro oficial empresarial. C-03 conserva extracción real IA cuando está disponible y revisión humana; entrada manual no se presenta como integración.

## 2. Equipo: quién construye qué

### Isabella — frontend y definición funcional del negocio

**Responsabilidad principal:** convertir las reglas y los casos del negocio en un flujo claro de tres pantallas. No se le asigna backend, despliegue ni una coordinación permanente que le impida construir.

- Definir el recorrido y las transiciones visibles: borrador, revisado, comprobante pendiente, pago verificado, pago aplicado, pago duplicado, saldo pendiente y alerta resuelta.
- Diseñar e implementar la bandeja de revisión, los formularios y la presentación del estado de cuenta y los resultados financieros.
- Especificar mensajes, campos obligatorios y reglas funcionales con ejemplos que Miguel y Andrés implementen en el servidor.
- Revisar con el equipo qué autorizaciones de crédito se muestran. Una regla pendiente se etiqueta como propuesta; no se inventa una política empresarial.
- Validar la experiencia móvil, los estados de error y la comprensión del saldo y del margen.

**Entregables:** wireframes, reglas funcionales, componentes de presentación y recorrido usable. **Depende de:** contratos de Miguel y campos/cálculos de Andrés. **Aceptación:** una persona puede corregir un borrador, interpretar una discrepancia y entender qué saldo sigue abierto sin explicaciones del desarrollador.

### Germán — frontend técnico e integración del prompt de diseño

**Responsabilidad principal:** hacer que el frontend funcione técnicamente con el backend y con el despliegue de la web. No toma la propiedad de los cálculos financieros.

- Crear la estructura del frontend, rutas, cliente de API, contratos tipados, sesión y manejo de carga, error y reintento.
- Implementar la carga de archivos y conectar las acciones de revisión, conciliación, aplicación de pagos, alertas y exportación.
- Integrar los componentes de Isabella sin duplicar su trabajo de interfaz.
- Preparar el despliegue de la web y comprobar móvil, URLs, configuración y ausencia de secretos en el navegador.
- Resolver problemas técnicos del frontend, estados desactualizados, permisos visibles y respuestas fallidas.

**Guía específica:** [Roadmap técnico de Germán + prompt Claude Design adaptado](roadmap-german-frontend.md), PROP-FRONT-001. Incluye los tres recorridos, estados, configuración, filtros y handoff. Isabella construye interfaz/reglas; Germán integra y valida técnicamente.

**Entregables:** frontend integrado, cliente de API compartido, web accesible y pruebas técnicas del navegador. **Depende de:** endpoints de Miguel y operaciones transaccionales de Andrés. **Aceptación:** las pantallas muestran datos persistidos, una recarga conserva el estado y un error no produce un éxito falso.

### Miguel — backend de captura y servicios de aplicación

**Responsabilidad principal:** codificar los endpoints que sostienen el recorrido, la captura con IA y su validación humana.

- Publicar el contrato de API y los ejemplos de respuesta acordados con Andrés.
- Implementar carga de evidencias, extracción de texto/imagen/audio según el proveedor disponible, borradores y confirmación humana.
- Conservar origen y campos ausentes; los importes no se inventan cuando una evidencia no es legible.
- Implementar los servicios de pedidos, consulta de conciliación, estados de cuenta, autorización pendiente y acceso a resultados financieros.
- Integrar el motor de Andrés: el endpoint orquesta la operación, pero no vuelve a calcular saldos con una segunda fórmula.
- Configurar y desplegar la API Spring Boot elegida; mantener claves de IA y claves privilegiadas del lado del servidor.

**Entregables:** API documentada, captura real, validación de borradores y servicios disponibles para frontend. **Depende de:** esquema y motor de Andrés; reglas funcionales de Isabella. **Aceptación:** texto o voucher se procesa, se corrige y se guarda con evidencia, y la misma llamada repetida no duplica la operación de negocio.

### Andrés — diseño de base de datos, backend financiero y resolución de problemas

**Responsabilidad principal:** definir y documentar la base de datos, programar el modelo transaccional, la conciliación y los cálculos, y resolver fallos de consistencia del recorrido.

- Ser dueño del modelo entidad-relación, diccionario, PK/FK, índices, restricciones, esquema privado/RLS y migraciones Flyway; Miguel revisa contratos/entidades. Entregar [modelo DB](modelo-base-datos-mvp.md), PROP-DB-001, y semilla ficticia reiniciable antes de integrar pagos.
- Implementar verificación y aplicación de pagos, detección de duplicados, saldos, vencimientos y alertas.
- Programar costos y margen por pedido, agrupaciones por línea/marca, centro productivo y consolidación sin doble conteo.
- Implementar caja a cuatro semanas, reporte generado al actualizar datos y exportación CSV.
- Resolver errores de datos, concurrencia, importaciones repetidas y fechas; coordinar la prueba final de punta a punta.

**Entregables:** base persistente, motor financiero, casos de prueba con resultados esperados y reporte. **Depende de:** definiciones funcionales de Isabella y formato de ingreso de Miguel. **Aceptación:** un pago parcial reduce el saldo una sola vez; el duplicado no lo altera; el costo y margen cuadran con los datos de prueba; los cobros realizados no permanecen como cobros futuros.

### Reglas de colaboración

- Isabella define significado y comportamiento; Miguel y Andrés aplican las reglas críticas en servidor y base de datos. La validación visual no sustituye el control del backend.
- Germán conecta y estabiliza el frontend; Miguel conecta captura y servicios; Andrés controla persistencia y cálculo. Cada frontera tiene una única fórmula y un contrato compartido.
- Cada persona prueba su módulo. Andrés coordina QA integrado; no queda como único responsable de encontrar errores ajenos.
- Cada checkpoint dura como máximo 10 minutos: avance verificable, bloqueo y siguiente dependencia. Los cambios de alcance se resuelven en conjunto, sin convertir a Isabella en PM de tiempo completo.
- Trabajar en ramas propias y dividir archivos. En un checkout compartido, evitar escritores simultáneos sobre el mismo archivo. Por D-005, el trabajo de Miguel usa Backend/ de este checkout y cerebro/ conserva documentos; BD/ es diseño de Andrés, Frontend/ el trabajo frontend. No crear otro repo.

**Fundamento de roles:** [contexto del equipo](../fuentes/contexto-equipo-hackathon-2026.md), USR-EQUIPO-002. Las tareas concretas son una propuesta de este roadmap.

## 3. Alcance técnico y tres pantallas

### Pantalla 1 — Captura y revisión

Chat pegado o cargado; vouchers de imagen; una muestra de audio para cubrir captura multimodal. Lista de evidencias, borrador estructurado, campos corregibles y confirmación humana. Mostrar claramente qué queda pendiente de verificación de fondos.

**Isabella:** flujo y componentes. **Germán:** uploader, cliente de API y estados técnicos. **Miguel:** extracción y endpoints. **Andrés:** persistencia y controles de duplicación.

### Pantalla 2 — Pedido, pagos y cobranza

Detalle con cliente, entidad, marca, línea, precio, costo, pagos, saldo y vencimiento. Mostrar sugerencia de correspondencia, diferencias, duplicados y pago huérfano. Acciones separadas para validar evidencia, registrar verificación y aplicar pago; estado de cuenta y alertas internas. La autorización cuando hay saldo conserva estado, responsable y motivo.

**Isabella:** reglas y experiencia. **Germán:** integración técnica. **Miguel:** servicios de aplicación. **Andrés:** conciliación, saldo y alertas.

### Pantalla 3 — Resultado y caja

Margen del pedido y agrupaciones, producción propia/tercerizada, centro productivo, caja semanal de cuatro semanas y reporte CSV. Filtros por entidad y consolidado autorizado. Mostrar fecha de corte y supuestos; distinguir resultado económico de dinero cobrado.

**Isabella:** comprensión de indicadores. **Germán:** componentes conectados y exportación. **Miguel:** acceso de API a resultados. **Andrés:** cálculos, agregados y reporte.

### Infraestructura recomendada para empezar

La base propuesta queda definida: **React + TypeScript + Vite en Cloudflare Workers Static Assets; Spring Boot/Java en Render (Docker) como único backend; Supabase para PostgreSQL, Auth y Storage privado; Gemini API para captura; GitHub Actions y pruebas para integrar.** Spring Boot se elige por dirección del usuario y experiencia confirmada de Miguel/Andrés en Spring. No requiere datos de ERP/CRM; no hay dependencias de esos conectores. Es la recomendación para este equipo y ventana de desarrollo, pendiente de una prueba de acceso y despliegue; no acredita servicios ya contratados.

- **Germán:** frontend técnico, configuración SPA/HTTPS, sesión, cliente de API y hosting web.
- **Isabella:** interfaz, reglas funcionales y validación de cómo se muestran revisión, saldo, margen y caja.
- **Miguel:** backend Spring Boot/Java en Render (Docker), captura Gemini, validación de entradas, secretos y despliegue de API.
- **Andrés:** PostgreSQL, migraciones, RLS, Storage autorizado y operación transaccional para pagos; motor de resultados y alertas.

**Detalle para implementar:** [Infraestructura y tecnologías del MVP](infraestructura-desarrollo-mvp.md), PROP-INFRA-001. Incluye estructura de repo, variables, entornos, orden de puesta en marcha, CI, backups, límites, recuperación y criterios de infraestructura lista. Consultarlo antes de crear la app.

#### Componentes concretos

1. **Web:** React/TypeScript con Vite y Node 24 LTS para desarrollo/build. Cloudflare aloja los assets y fallback SPA; el backend no se duplica en Cloudflare. [Static Assets](https://developers.cloudflare.com/workers/static-assets/).
2. **API:** Spring Boot/Java 21, Spring MVC/Security y contrato OpenAPI versionado; Render Web Service; JWT verificado y claves IA solo en servidor. [Spring Boot](https://docs.spring.io/spring-boot/system-requirements.html), [Render Docker](https://render.com/docs/docker).
3. **Base:** PostgreSQL con Spring Data JPA/Hibernate, JDBC PostgreSQL, migraciones Flyway y RLS/grants por organización; contexto de organización verificado por Spring Security/servicios Spring, rol runtime limitado y esquema de negocio no expuesto a Data API. Pago, aplicación y auditoría se confirman en una transacción Spring `@Transactional`/PostgreSQL, no en llamadas independientes del navegador. [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
4. **Evidencias:** Storage privado con rutas por organización y enlaces autorizados; no publicar fotos de vouchers. [Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals).
5. **IA:** Gemini API, modelo inicial configurable `gemini-3.5-flash-lite`, JSON validado y confirmación humana. Probar texto/imagen/audio antes de fijar configuración. La IA no confirma fondos ni calcula el saldo. [Modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).
6. **Alertas:** reglas y trabajos persistidos en PostgreSQL; Render Cron Job ejecutando el mismo código Java en modo job al estabilizar vencimientos, sin worker largo en memoria. Los envíos reales dependen de canal autorizado. [Cron](https://render.com/docs/cronjobs).
7. **QA y CI:** Vitest para frontend, JUnit/Spring Boot Test/MockMvc y PostgreSQL para API y transacciones y Playwright para el recorrido móvil; GitHub Actions ejecuta typecheck, pruebas y build.

#### Entornos y despliegue

Desarrollo local y proyecto remoto de **demo con datos ficticios**. El piloto real va en un proyecto separado. Frontend y backend tienen variables diferentes: URL de API y URL/clave pública Supabase en el navegador; credenciales JDBC, secretos IA y credenciales controladas en Render/CI. Germán configura retorno de Auth y origen frontend; Miguel autoriza llamadas; Andrés verifica acceso a datos y archivos.

Antes de H1 deben estar desplegados una página, una API Spring Boot autenticada y un pedido persistente. El primer recorrido de infraestructura es **sesión → carga privada → extracción revisable → pedido consultable**. Si falla, se resuelve antes de sumar funcionalidades. Migraciones y lockfile se versionan; backups de base y evidencias se tratan por separado antes de datos reales.

Web móvil forma parte del objetivo. Instalación PWA, n8n, Kafka, Jenkins, Pinecone, Kotlin y servidores adicionales quedan fuera de la base inicial. Si un servicio recomendado no puede desplegarse en la prueba del primer bloque, documentar una única alternativa disponible; no construir dos plataformas a la vez.

### Fronteras de backend

- **Miguel:** servicios de captura y revisión; pedidos y evidencias; fachada de API.
- **Andrés:** esquema y migraciones; motor transaccional de pagos; costos, caja y reportes.
- **Compartido:** un contrato de datos y un contrato de errores. Miguel invoca las operaciones de Andrés; no reimplementa sus fórmulas.

El estado de cuenta compartido sin login principal requiere token temporal/revocable limitado a un cliente, sin evidencias privadas. Sin ese control, usar vista autenticada y marcar la brecha. Un selector de marca no sustituye organización/entidad. `factor_mora` parte de 0% como escenario editable, nunca del 30% empresarial no verificado.

Contrato mínimo orientativo: cargar evidencia, extraer borrador, confirmar borrador, consultar candidatos de conciliación, registrar verificación, aplicar pago, consultar pedido/estado de cuenta, consultar resultado/caja y exportar reporte. Cada respuesta conserva identificadores, moneda, estado, origen y fecha de corte. No se prescribe aquí una API final aprobada.

## 4. Roadmap por bloques y miembro

Si alguno de estos horarios ya pasó, empezar en el primer checkpoint no satisfecho. Mantener las dependencias y recalcular la ventana disponible; no afirmar que hubo avances por el paso del tiempo. El plan presupone comenzar alrededor de 15:30 del sábado, como el adjunto.

### B0 — Sábado 15:30–16:30: acuerdo funcional y contratos

- **Isabella:** dibujar las tres pantallas, definir estados, validaciones y un recorrido único; identificar políticas pendientes.
- **Germán:** aplicar el roadmap PROP-FRONT-001/prompt adaptado: esqueleto frontend, tres rutas, cliente API Spring, fixtures y despliegue web; acordar estados con Isabella.
- **Miguel:** proponer contrato y probar captura con el proveedor de IA disponible; comprobar despliegue backend y secretos.
- **Andrés:** definir ER/diccionario de base, claves/FK, aplicaciones de pagos y casos numéricos; acordar moneda/fechas, crear primera Flyway y revisar con Miguel.

**Salida conjunta:** contratos, esquema inicial, acceso Supabase/Gemini, API Spring Boot en Render y despliegue Cloudflare comprobados, configuración de infraestructura acordada, casos de demo identificados y responsabilidades acordadas. Miguel y Andrés entregan ejemplos de respuesta para que frontend avance sin esperar todos los endpoints.

### B1 — 16:30–18:00: primera conexión persistente

- **Isabella:** implementar formulario de revisión y estados del pedido con datos de prueba.
- **Germán:** conectar sesión, consulta de pedido y guardado; publicar una primera web accesible.
- **Miguel:** implementar ingreso de evidencia y confirmación de borradores; desplegar endpoints base.
- **Andrés:** crear tablas, restricciones y semilla; entregar primer saldo y costo/margen del pedido.

**H1, 18:00:** URL HTTPS con rutas SPA, sesión real, evidencia privada y API Spring Boot autenticada; crear o confirmar un pedido, guardarlo y consultarlo en la web desplegada. Las respuestas simuladas del contrato se distinguen de las reales y empiezan a reemplazarse. Costos y vencimientos ya tienen un formato estable.

### B2 — 18:00–20:00: recorrido básico de los cuatro módulos

- **Isabella:** completar revisión y detalle de pedido; representar parciales, duplicados y alerta.
- **Germán:** conectar extracción, pagos y resultados; resolver errores y actualización del estado.
- **Miguel:** conectar IA con revisión humana y servicios de pedido; integrar conciliación y consultas de Andrés.
- **Andrés:** implementar aplicación parcial, duplicación y vencimiento; entregar margen y primera caja calculada.

**H2, 20:00:** entrada → revisión → pago aplicado → saldo/alerta → margen/caja funciona en la misma base. Una captura todavía no verificada no reduce el saldo. Cena y revisión breve según disponibilidad; no asumir que las cuatro personas pueden ausentarse de una entrega activa.

### B3 — 20:30–22:00: conciliación real y recorrido integrado

- **Isabella:** mejorar correcciones y mensajes; revisar que las excepciones se entiendan.
- **Germán:** completar conexiones reales de las tres pantallas y prueba móvil.
- **Miguel:** procesar las muestras de chat/vouchers; sumar captura de audio si la integración básica ya funciona, conservando C-03 como requisito y cualquier brecha visible.
- **Andrés:** cerrar duplicados, huérfanos y diferencias; comprobar costos propios/tercerizados y caja sin doble contar cobros.

**H3, 22:00:** ejecutar los 3 vouchers y el chat, ver el saldo correcto, un pedido con margen negativo y una alerta; los resultados persisten al recargar. El flujo usa endpoints reales. Captura no implementada se marca como brecha, no como función ya disponible.

### B4 — 22:00–domingo 01:00: completar criterios y estabilizar

- **Isabella:** revisar estados de cuenta, filtros y presentación del centro productivo y reporte; revisar reglas de autorización pendiente.
- **Germán:** completar consolidado autorizado, exportación y manejo de errores; arreglar frontend móvil.
- **Miguel:** finalizar captura multimodal, validación de campos y servicios de resultados; registrar auditoría básica.
- **Andrés:** completar centro productivo, agregados por línea/marca, cuatro semanas y reporte; probar idempotencia y permisos de organización.

**H4, 01:00:** migraciones versionadas, permisos de datos/archivos probados y build verificado; lista C-01 a C-07 con evidencia o brecha explícita; recorrido completo reproducible. Regenerar el reporte al cambiar un pago demuestra automatización del cálculo, no una entrega programada por correo ya implementada.

### B5 — 01:00–03:00: resolver defectos críticos y congelar alcance

- **Miguel y Andrés activos:** arreglar backend, montos, duplicados, permisos y fechas. Hacer prueba integral sobre el frontend ya entregado.
- **Isabella y Germán descansan:** pareja de frontend. Antes de salir dejan estado, archivos, comandos de prueba y bloqueos.

**H5, 03:00:** congelar nuevas funcionalidades; guardar versión estable y lista de defectos. No se agregan stock, cotizaciones, recompra ni conectores externos.

### B6 — 03:00–05:00: estabilización técnica de interfaz

- **Isabella y Germán activos:** corregir presentación, validaciones, estados desactualizados y errores de UI sobre la versión congelada. No cambiar contratos backend sin necesidad crítica.
- **Miguel y Andrés descansan:** pareja de backend; entregan una nota de 10 minutos antes del relevo.

Esta rotación asegura cobertura por especialidad, pero no soporte completo de ambas especialidades toda la noche. Un bloqueo no urgente de la pareja que descansa se registra para las 05:00; no se reemplaza su módulo a ciegas. Los turnos se pueden invertir según fatiga y estado real, conservando el relevo.

### B7 — 05:00–07:00: prueba integrada y versión de entrega

- **Isabella:** aceptación funcional de captura, saldo y resultados.
- **Germán:** prueba de navegador/móvil y estabilización de web desplegada.
- **Miguel:** resolver fallos de captura/API y comprobar secretos y respuestas.
- **Andrés:** coordinar QA de conciliación, financiero, persistencia y aislamiento; reiniciar la semilla y repetir el recorrido.

**H6, 07:00:** URL funcional, acceso backend y logs comprobados, datos de demo reproducibles, exportación verificada y ausencia de defectos críticos abiertos. Si no se cumple, todo el equipo prioriza ese bloqueo.

### B8 — 07:00–09:30: margen de entrega técnica

- **Isabella:** revisión final del lenguaje de la interfaz y reglas pendientes.
- **Germán:** verificación final de URL, móvil, recuperación de errores y versión publicada.
- **Miguel:** documentar API, configuración y límites de captura/conectores.
- **Andrés:** adjuntar resultados de QA, reporte esperado y comandos de reinicio; revisar cálculos tras último cambio.

**H7, objetivo 09:00:** versión técnica lista, instrucciones de uso y respaldo local. Reservar hasta 09:30 para contingencias, sujeto al horario real de entrega. No se usan estas horas para preparar pitch, slides ni exposición.

## 5. Camino crítico y dependencias

**Reglas y casos → contrato + esquema → captura revisada → obligación/pago → aplicación transaccional → saldo/alertas → costo/margen/caja → frontend conectado → QA y entrega.**

- Isabella entrega definiciones funcionales a ambos programadores backend antes de construir validaciones incompatibles.
- Miguel y Andrés acuerdan contratos y esquema; frontend puede trabajar con ejemplos claramente etiquetados mientras se terminan los servicios.
- Andrés entrega el motor de aplicación; Miguel lo expone y Germán lo conecta. Esta integración tiene prioridad sobre más componentes visuales.
- Costos, precios, fechas y egresos ficticios/manuales se preparan desde B0, sin consultar ERP/CRM: sin esos datos no hay demostración financiera, aunque OCR y pantallas funcionen.
- Desplegar una versión pequeña en B1 evita descubrir un problema de alojamiento al final.

**Regla de integración:** después de cada cambio que cruza frontend/backend, comprobar el mismo pedido en la base, la API y la pantalla. No considerar integrado un botón que cambia solamente el estado local.

## 6. Datos de demostración y resultados verificables

Todo el siguiente conjunto es **ficticio y propuesto**, con moneda PEN; no representa registros reales de Corpotex. Andrés prepara la semilla; Isabella valida significado; Miguel prepara evidencias compatibles; Germán prueba su representación.

### Pedidos base

- **P-001:** venta S/300, producción propia. Materiales S/200, mano de obra S/80 e indirectos S/60: costo S/340; margen del pedido **−S/40**. Vincular a una entidad, marca y línea de ejemplo.
- **P-002:** venta S/500, costo tercerizado S/350: margen S/150. Vencimiento pasado y saldo inicial S/500. Otra entidad/marca de demostración, sin inventar un RUC real.
- Ambos pertenecen a una organización de demostración; añadir una segunda organización mínima para probar aislamiento. Marca, entidad y organización no son el mismo campo.

### Tres vouchers principales

1. **V-001:** pago S/300 para P-001; después de revisión y verificación simulada identificada, saldo S/0.
2. **V-002:** pago S/100 para P-002; después de aplicar, saldo S/400 y alerta por vencimiento pendiente.
3. **V-003:** copia de V-002 con la misma referencia de operación; se identifica como duplicado y no reduce nuevamente el saldo.

**Resultado:** recaudación aplicada S/400; saldo total S/400; margen conjunto de pedidos S/110. Un duplicado no equivale a fraude demostrado. Verificación bancaria simulada no se presenta como conexión a un banco.

Para el centro productivo de P-001, cargo interno ficticio S/320 y costo S/340 dan resultado productivo −S/20; el margen comercial es −S/20. El consolidado elimina el cargo interno y conserva el margen total del pedido −S/40. Los cargos internos no aparecen como entrada bancaria externa.

La caja requiere saldo de apertura, egresos semanales y fechas de cobro previstas cargadas aparte. Al aplicar S/400, aumentar caja realizada y reducir cobros futuros por el mismo monto, conservando el período correcto. Si un pago esperado y su realización caen en el mismo período, el saldo final proyectado puede permanecer igual: actualizar composición no implica crear dinero adicional. No descontar un 30% sin metodología validada.

### Casos adicionales de QA

Una evidencia sin pedido, otra con importe que no coincide y una imagen ilegible. No tienen que entrar en el recorrido principal de 3 vouchers; sirven para comprobar excepciones. Adjuntar una muestra breve de audio para C-03.

## 7. Criterios de aceptación y QA

- **QA-01, Miguel/Germán:** cargar evidencia, corregir un campo y confirmar; el origen y la corrección quedan guardados.
- **QA-02, Miguel/Isabella:** texto, imagen y audio producen borrador revisable; lo ilegible permanece pendiente. Si falta una modalidad, registrar C-03 incompleto.
- **QA-03, Andrés/Miguel:** voucher recibido sin verificación no modifica el saldo.
- **QA-04, Andrés/Germán:** aplicar V-002 dos veces o importar V-003 no duplica pago; P-002 conserva saldo S/400. Probar doble clic o reintento, no solo una advertencia visual.
- **QA-05, Andrés/Isabella:** huérfano y diferencia se muestran como excepción y no se aplican por coincidencia de monto solamente.
- **QA-06, Andrés/Germán:** pago completo cierra saldo y cancela la alerta correspondiente; pago parcial mantiene la obligación pendiente.
- **QA-07, Isabella/Miguel:** cliente con saldo exige autorización pendiente en el flujo; no se aprueba por una acción del frontend sin control del servidor.
- **QA-08, Andrés/Isabella:** P-001 muestra −S/40 y los agregados coinciden con los pedidos incluidos.
- **QA-09, Andrés/Germán:** centro productivo y consolidado no duplican S/320 de cargo interno ni lo suman a caja externa.
- **QA-10, Andrés/Miguel:** caja contiene cuatro períodos semanales; un pago aplicado no queda a la vez como cobro futuro y realizado.
- **QA-11, Germán/Miguel:** recargar conserva estado; fallo de API, timeout o error de IA no muestran confirmación falsa.
- **QA-12, Germán/Andrés:** CSV coincide con datos, moneda y fecha de corte; móvil permite completar el recorrido.
- **QA-13, Andrés/Germán:** un usuario de otra organización no accede a sus pedidos o evidencias; acceso consolidado funciona solo con autorización.

**Defecto crítico:** saldo incorrecto, pago duplicado, fuga entre organizaciones, secretos en navegador, pérdida de persistencia o recorrido principal roto. Andrés registra y coordina; el dueño del componente resuelve. Mejoras cosméticas no bloquean una versión funcional.

### Cobertura del Reto 6

- **C-01:** web móvil/computadora y filtros separados/consolidados — Germán e Isabella.
- **C-02:** CSV comprobado — Andrés genera, Germán integra descarga.
- **C-03:** captura multimodal con revisión — Miguel implementa, Isabella y Germán conectan.
- **C-04:** vouchers y conciliación — Andrés implementa motor, Miguel expone, frontend representa.
- **C-05:** costo/margen por pedido, línea y marca — Andrés implementa, Isabella valida significado.
- **C-06:** centro productivo y transferencia interna — Andrés implementa, frontend muestra.
- **C-07:** caja a cuatro semanas y reporte generado automáticamente al actualizar — Andrés implementa, Miguel expone, Germán integra.

La cobertura se verifica con evidencias; una casilla en un plan no demuestra una funcionalidad terminada.

## 8. Decisiones pendientes y recortes si falta tiempo

### Antes de fijar el plan

- Confirmar plazo de entrega y condiciones de uso de componentes genéricos y código previo con la organización. El adjunto describe restricciones del núcleo durante el evento; la documentación previa no sustituye esa verificación.
- Confirmar stack, cuentas, presupuesto/API de IA y mecanismo de despliegue con pruebas mínimas.
- Revisar un ejemplo de pedido/pago con el mentor, si está disponible, y precisar costos, políticas y datos.
- Registrar si 80% y 30% tienen cálculo válido; mientras tanto quedan fuera de afirmaciones cuantificadas de impacto.
- Definir inicio de crédito y plazos configurables: la idea usa 15/30 días y la entrevista menciona 30/45. No suponer una única regla real.
- Confirmar organización/entidad/marca de la semilla ficticia sin inventar RUC. Datos y conectores ERP/CRM quedan fuera del MVP por D-004; no condicionan el plan.

### Recortes en orden

1. Mantener alertas y estados de cuenta dentro de la aplicación; no añadir envío real por WhatsApp/correo sin acceso y configuración comprobados.
2. Conservar entrada manual de chat/vouchers/audio, registros/CSV y semilla ficticia; ningún conector ERP/CRM entra al MVP, tampoco como contingencia.
3. Reducir refinamientos visuales, personalización, gráficos extra e instalación PWA; conservar revisión, saldo, margen y cuatro semanas.
4. Reducir cantidad de escenarios del recorrido principal, conservando las excepciones como pruebas. No quitar el centro productivo del alcance sin identificar una brecha frente a C-06.
5. Si falla IA, permitir edición manual y mantener la muestra preprocesada como respaldo identificado. Eso permite probar finanzas, pero **no** acredita captura con IA ni cumplimiento completo de C-03/C-04.

No sustituir cálculos por números fijos de pantalla ni declarar disponible un módulo incompleto para cumplir el reloj. Stock, cotizaciones, recompra y pitch permanecen fuera de este trabajo.

## 9. Después de la hackathon: continuidad por entregables

Sin fechas comerciales comprometidas, proponer tres incrementos posteriores:

1. **Validar el piloto:** datos reales, política de crédito, responsables, definiciones de costos/caja y formatos. Isabella define recorridos; Germán evalúa acceso e interfaz; Miguel prueba conectores; Andrés concilia una muestra y valida cálculos.
2. **Operar el núcleo con fiabilidad:** integraciones acordadas, alertas programadas y canales autorizados, reintentos, auditoría, pruebas de aislamiento y reportes recurrentes. Mantener la distribución frontend/backend actual.
3. **Segunda fase:** stock, cotizaciones y recompra solo después de aceptar captura, conciliación, cobranza y visibilidad financiera. Reutilización en otra empresa con configuración propia; precios y comisión se validan como hipótesis, no se fijan aquí.

No se agenda pitch en estos incrementos. Sus tiempos dependen de validación y recursos disponibles.

## 10. Fuentes y alcance de la documentación

- [Infraestructura recomendada](infraestructura-desarrollo-mvp.md), PROP-INFRA-001: componentes, configuración y despliegue para iniciar desarrollo.

- [Contexto del equipo y aclaración vigente](../fuentes/contexto-equipo-hackathon-2026.md), USR-EQUIPO-001/002: habilidades, esquema horario y roles corregidos.
- [Idea de negocio](../empresa/idea-negocio-replanteada.md), USR-IDEA-001: cuatro módulos, fases y demostración.
- [Decisiones](decisiones-del-proyecto.md), D-003 y P-001 a P-006: prioridad vigente y propuestas técnicas.
- [Reto 6](reto-6-corpotex-conciliacion-y-rentabilidad.md), IMG-RETO6-001/C-01 a C-07: criterios y centro productivo.
- [Ventas](../procesos/ventas.md), A02-Q04, Q05, Q10, Q11, Q32: cuentas por cobrar, proveedor posible y cifras/plazos pendientes.
- [Rediseño](../procesos/rediseno-procesos-credito-y-cobranza.md): separación de comprobante, verificación, aplicación y cierres; reglas aún propuestas.

El sitio [Piura Innova](https://piurainnova.com/) fue consultado, pero la página accesible no permitió corroborar los horarios, pesos o reglas del adjunto. Por eso se mantienen como contexto aportado, no bases oficiales verificadas. El eje pendiente del adjunto no sustituye el contexto Corpotex/Reto 6 ya documentado; la clasificación del eje sigue por confirmar si se necesita.

Roles son instrucciones vigentes del usuario; bloques, tareas, stack y datos de ejemplo son propuestas de esta documentación. No se ha implementado software ni generado los diagramas durante esta entrega. El [prompt para Claude](prompt-claude-diagramas-roadmap.md) describe cómo producirlos respetando este plan.
