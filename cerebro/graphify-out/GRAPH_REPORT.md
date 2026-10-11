# Graph Report - cerebro  (2026-10-10)

> Alcance: 33 Markdown de `cerebro/` (conocimientos, diagramas en Markdown, guías). Excluidos: PNG y `.excalidraw` (sin cambios), `skills-lock.json`, `BD/`, `Middleware/`, `.agents/`, `.claude/`. Extracción semántica por 3 subagentes de Claude (2 sobre el corpus inicial y 1 que re-extrajo la revisión y el documento MIG-SUPA-001 tras actualizarlos); sin AST. Las aristas INFERRED/AMBIGUOUS son pistas de lectura, nunca aprobación; verificar siempre en la fuente. Construido con graphifyy 0.9.85 en un entorno aislado fuera del repo.

## Corpus Check
- 33 files · ~125,361 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .excalidraw 9)

## Summary
- 540 nodes · 1041 edges · 24 communities (18 shown, 6 thin omitted)
- Extraction: 79% EXTRACTED · 14% INFERRED · 7% AMBIGUOUS · INFERRED: 144 edges (avg confidence: 0.79)
- Token cost: desglose entrada/salida no disponible. Consumo real reportado por la herramienta de subagentes: 350 850 tokens totales en 3 agentes de extracción (157 026 + 134 452 + 59 372). Los 0 que Graphify imprimiría por defecto no son un consumo real.

## Community Hubs (Navigation)
- Crédito y cobranza: flujo del equipo
- Guía y compartición del cerebro
- DER y entidades de datos
- Trabajo de Miguel: D-006 y bitácora
- Descripción de Corpotex y entrevistas
- D-005, WhatsApp y decisiones
- Actores y flujo order-to-cash
- Tareas MIG-00 a MIG-08
- Supabase, RLS y brechas MIG-02
- Idea de negocio replanteada
- Catálogo y fugas financieras
- Fronteras Andrés/Miguel y diagramas v1.3
- Tarea general de Miguel
- Objetivos y datos solicitados
- Contexto del equipo hackathon
- Prompt Claude Design recibido
- Aceptación y límites de la tarea
- Auth, JWKS y Storage
- Variables .env y Flyway runtime
- Identidad Isabel/Isabella (C6)
- Verificaciones y uso del grafo
- Documentos con alcance anterior (C16)
- Cifras 80% y 30% (C17)
- Seguridad de datos (C18)

## God Nodes (most connected - your core abstractions)
1. `Ventas, produccion, inventario y cobranza` - 37 edges
2. `Atencion al cliente y fidelizacion` - 30 edges
3. `Redisenio de procesos: blindaje de credito y cobranza` - 29 edges
4. `MIG-GENERAL Backend de Miguel` - 27 edges
5. `Prompt Claude Design v4` - 27 edges
6. `Idea de negocio replanteada` - 26 edges
7. `Corpotex descripcion y mapa de conocimiento` - 25 edges
8. `Catalogo conocido y datos pendientes` - 20 edges
9. `Objetivos de la empresa y del proyecto` - 19 edges
10. `Tareas MIG-00 a MIG-08` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Honestidad: WhatsApp en modo prueba; ERP/CRM como Cargar archivo; reglas pendientes rotuladas Propuesta` --semantically_similar_to--> `Actualizacion D-005: WhatsApp con Evolution API y n8n; 15-30 dias; una obligacion; aviso de mora`  [INFERRED] [semantically similar]
  diagramas/prompt-claude-design.md → conocimientos/empresa/idea-negocio-replanteada.md
- `Demo de 3 minutos: 3 vouchers y un chat` --semantically_similar_to--> `Recorrido 3 vouchers + 1 chat: captura, conciliacion, saldo 400, alerta, P-001 -40, caja`  [INFERRED] [semantically similar]
  conocimientos/empresa/idea-negocio-replanteada.md → diagramas/prompt-claude-design.md
- `Plazos configurables: demo 15 y 30 dias; entrevista menciona 30/45` --conceptually_related_to--> `Plazo 15 a 30 dias, una sola obligacion sin cuotas; evento inicial es el despacho`  [AMBIGUOUS]
  conocimientos/fuentes/prompt-claude-design-recibido.md → diagramas/prompt-claude-design.md
- `Tres acciones separadas: validar evidencia, verificar fondos (simulada), aplicar pago` --semantically_similar_to--> `Tres acciones separadas: validar evidencia, verificacion simulada de fondos, aplicar pago`  [INFERRED] [semantically similar]
  conocimientos/fuentes/prompt-claude-design-recibido.md → diagramas/prompt-claude-design.md
- `Macroproceso 2: cuentas por cobrar, estados de cuenta, trazabilidad de pagos` --semantically_similar_to--> `Tres acciones separadas: validar evidencia, verificacion simulada de fondos, aplicar pago`  [INFERRED] [semantically similar]
  conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md → diagramas/prompt-claude-design.md

## Hyperedges (group relationships)
- **Cadena WhatsApp → n8n → IA → Spring (D-005)** — conocimientos_decisiones_actores_flujos_y_der_mvp_evolution_api, conocimientos_decisiones_actores_flujos_y_der_mvp_n8n, conocimientos_decisiones_actores_flujos_y_der_mvp_wf1, conocimientos_decisiones_actores_flujos_y_der_mvp_wf2, conocimientos_decisiones_actores_flujos_y_der_mvp_wf3, conocimientos_decisiones_actores_flujos_y_der_mvp_ia_llm, conocimientos_decisiones_actores_flujos_y_der_mvp_spring_boot_nico_backend, conocimientos_decisiones_decisiones_del_proyecto_d_005 [EXTRACTED 1.00]
- **Control de pago: recibido, verificado, aplicado en una transacción idempotente** — conocimientos_decisiones_actores_flujos_y_der_mvp_fases_de_pago, conocimientos_decisiones_modelo_base_datos_mvp_transacci_n_de_pago_db, conocimientos_decisiones_infraestructura_desarrollo_mvp_transacci_n_de_pago_spring, conocimientos_decisiones_actores_flujos_y_der_mvp_idempotency_key, conocimientos_decisiones_decisiones_del_proyecto_cuatro_estados_de_cobro, conocimientos_decisiones_roadmap_german_frontend_tres_acciones_de_pago, conocimientos_decisiones_roadmap_german_frontend_comprobante_recibido_no_es_pago_verificado, conocimientos_decisiones_actores_flujos_y_der_mvp_conciliaci_n [INFERRED 0.85]
- **Marco de trabajo de Miguel: D-006, plan, delegación, checkpoint y bitácora** — conocimientos_decisiones_decisiones_del_proyecto_d_006, conocimientos_desarrollo_miguel_plan_implementacion_mig_plan_001, conocimientos_desarrollo_miguel_plan_implementacion_contrato_de_delegaci_n, conocimientos_desarrollo_miguel_guia_trabajo_checkpoint, conocimientos_desarrollo_miguel_guia_trabajo_git_solo_miguel, conocimientos_desarrollo_miguel_estado, conocimientos_desarrollo_miguel_prompt_claude_prompt_mig_00 [EXTRACTED 1.00]
- **Plazo de credito: 15-30 dias vs 30/45 dias** — conocimientos_procesos_ventas_a02_q32, conocimientos_procesos_flujo_cliente_empresa_aprobacion_credito, conocimientos_procesos_rediseno_procesos_credito_y_cobranza_plazo_30_45, diagramas_prompt_claude_design_plazo, conocimientos_fuentes_prompt_claude_design_recibido_plazos_30_45 [INFERRED 0.85]
- **Cifras 80% y 30%: afirmaciones de equipo sin validar** — conocimientos_empresa_idea_negocio_replanteada_pct_80, conocimientos_empresa_idea_negocio_replanteada_pct_30, conocimientos_procesos_flujo_cliente_empresa_pct_30, conocimientos_procesos_rediseno_procesos_credito_y_cobranza_pct_30, conocimientos_procesos_ventas_pct_30, diagramas_prompt_claude_design_pct_pendientes, diagramas_keptai_roadmap_fuentes_spring_v1_3_pct_no_usados [INFERRED 0.85]
- **Comprobante recibido, pago verificado, pago aplicado** — conocimientos_procesos_rediseno_procesos_credito_y_cobranza_ocr_conciliacion, conocimientos_procesos_ventas_verif_vs_aplic, diagramas_prompt_claude_design_tres_acciones, conocimientos_fuentes_prompt_claude_design_recibido_tres_acciones, conocimientos_desarrollo_miguel_tarea_general_demo_ficticia [INFERRED 0.85]
- **Contradicciones C1-C5 entre D-005 y documentos anteriores** — conocimientos_desarrollo_miguel_revision_integracion_andres_c1, conocimientos_desarrollo_miguel_revision_integracion_andres_c2, conocimientos_desarrollo_miguel_revision_integracion_andres_c3, conocimientos_desarrollo_miguel_revision_integracion_andres_c4, conocimientos_desarrollo_miguel_revision_integracion_andres_c5 [EXTRACTED 0.75]
- **Desalineaciones del contrato MIG-02 con BD y n8n (C7-C12)** — conocimientos_desarrollo_miguel_revision_integracion_andres_c7, conocimientos_desarrollo_miguel_revision_integracion_andres_c8, conocimientos_desarrollo_miguel_revision_integracion_andres_c9, conocimientos_desarrollo_miguel_revision_integracion_andres_c10, conocimientos_desarrollo_miguel_revision_integracion_andres_c11, conocimientos_desarrollo_miguel_revision_integracion_andres_c12 [EXTRACTED 0.75]
- **Cadena de aislamiento por organización: JWT, set_config, rol runtime y pruebas RLS** — conocimientos_desarrollo_miguel_preparacion_supabase_rls_flujo_jwt, conocimientos_desarrollo_miguel_preparacion_supabase_rls_set_config_tx, conocimientos_desarrollo_miguel_preparacion_supabase_rls_identidades_db, conocimientos_desarrollo_miguel_preparacion_supabase_rls_pruebas_rls [INFERRED 0.85]

## Communities (24 total, 6 thin omitted)

### Community 0 - "Crédito y cobranza: flujo del equipo"
Cohesion: 0.05
Nodes (68): Precedencia: conciliacion, cobranza, rentabilidad y caja en primera fase, Alerta de cobranza: 3 dias antes, el dia, 3 dias despues (propuesta configurable, no politica actual), Flujo Cliente-Empresa, Aprobacion de linea de credito por vendedor, definido por Isabel 10/10/2026, plazo 15 a 30 dias, Afirmacion de ausencia de vinculo/cronograma contrastada con modulo de cuentas por cobrar (A02-Q04), USR-FLUJO-001: texto de usuario, pendiente de validacion operativa, 30% de cartera sin cobrar (interpretacion del texto, no tasa de morosidad), 80% de ventas a credito (cifra de este mensaje, sin denominador) (+60 more)

### Community 1 - "Guía y compartición del cerebro"
Cohesion: 0.06
Nodes (50): Actualización con pull --ff-only, Sin audios, imagen original, PDF ni credenciales, Script sincronizar.py con --check y --preserve-historical-diagrams, Skill keptai-conocimiento en .agents/skills, 80% a crédito y 30% sin verificar, A02-Q06 entrevista (plazos relatados), A02-Q15 entrevista (tres presenciales y una online), A02-Q28 entrevista (clientes frecuentes) (+42 more)

### Community 2 - "DER y entidades de datos"
Cohesion: 0.06
Nodes (46): COSTO_ORDEN origen REAL/TEORICO, DER fusionado (Isabel + PROP-DB-001), organizacion_id en todas las tablas (P-006), TOKEN_ESTADO_CUENTA (estado de cuenta sin URL predecible), A01-Q04 entrevista (CRM/WhatsApp), A02-Q05 entrevista (Factura Ya, CRM), Factura Ya (sistema de facturación posible), Kommo (CRM; "COMO" interpretado provisionalmente) (+38 more)

### Community 3 - "Trabajo de Miguel: D-006 y bitácora"
Cohesion: 0.08
Nodes (44): D-006 Preparación de Miguel, delegación y bitácora, Esquema V1-V3 en BD/ (DB-DER-001), no desplegado en Supabase, Miguel: backend de captura y servicios de aplicación, ./mvnw verify: 108 tests (7 MIG-01/infra + 101 contrato), Acuerdos pendientes con Andrés (paquete, Flyway, dinero, fechas, UUID, errores…), B1 JDK21 resuelto; B2 Docker resuelto en sesiones nuevas; B3 Supabase/Gemini, UUID+display_code, dinero en centavos, Idempotency-Key, no aprobadas, Gate MIG-02 (Andrés + humano) (+36 more)

### Community 4 - "Descripción de Corpotex y entrevistas"
Cohesion: 0.07
Nodes (44): Corpotex descripcion y mapa de conocimiento, A01-Q01 Administran pedidos: corporativo y de a pie, WhatsApp/FB/IG/tienda, A02-Q13 Modulos: caja chica, inventario, usuarios, administracion, A02-Q14 Usuarios administrativos y de ventas; vendedoras consultan stock, A02-Q15 Tres y una vendedores, A02-Q24 Sin numero exacto de clientes; facturacion mejora cada anio, A02-Q25 Formalizada 2017, crecimiento desde 2020; digitalizar produccion, A02-Q33 Ambito nacional; ventas al exterior no a credito (+36 more)

### Community 5 - "D-005, WhatsApp y decisiones"
Cohesion: 0.07
Nodes (41): Isabel (autora USR-FLUJO-002; DER y D-005), PROP-FLUJO-DER-001 Actores, flujos y DER (v1.3.0), D-005 WhatsApp con Evolution API y n8n dentro del MVP, P-009 Infraestructura inicial (sustituida por D-004), P-010 FastAPI (sustituida por D-004), Entradas: chat/vouchers manuales, CSV, semilla ficticia; WhatsApp de prueba, Estructura de repo propuesta con backend/ en minúscula, FastAPI sustituido por Spring (D-004) (+33 more)

### Community 6 - "Actores y flujo order-to-cash"
Cohesion: 0.08
Nodes (38): Actores: cliente, vendedor, administración, jefe de taller, gerencia, APLICACION_PAGO puente PAGO–ORDEN–CUOTA, APROBACION_CREDITO (aviso_mora_mostrado), Banco: fuente de verdad del pago; KeptAI no se conecta, Comandos /cerrar y /ok ORD-123 del vendedor, Cobranza: recordatorios -3, 0, +3 días, Cola de revisión (duplicado, sin orden, no cuadra), Conciliación: cruzar voucher, pago verificado y orden (+30 more)

### Community 7 - "Tareas MIG-00 a MIG-08"
Cohesion: 0.10
Nodes (30): Tareas MIG-00 a MIG-08, Actualizacion 10/10/2026: MIG-02 en propuesta, alinear con BD/ y Middleware/n8n (D-005); reformular MIG-05, Todas las tareas MIG comienzan pendientes, MIG-00 Verificar entorno y acordar fronteras, MIG-01 Arranque Spring y configuracion, MIG-02 Contrato API y DTOs, MIG-03 Autenticacion JWT y permisos, MIG-04 Entrada manual y evidencias privadas (+22 more)

### Community 8 - "Supabase, RLS y brechas MIG-02"
Cohesion: 0.08
Nodes (26): Un solo historial V1-V3; reconciliar con Flyway sin baseline/repair a ciegas, Entrada n8n: organización desde identidad del servidor, no X-Api-Key ni cuerpo, set_config app.organizacion_id local por transacción, incluso en GET, Brechas del contrato MIG-02 frente a BD y n8n (10 puntos), C1 Plazo de crédito: 15-30 (D-005) vs 30/45 (A02-Q32, README n8n), C11 Estados y nombres: contrato en inglés vs BD en español, C12 Confianza de IA omitida en contrato, presente en BD y n8n, C13 Ubicación de migraciones Flyway: una sola ruta en Backend/ (+18 more)

### Community 9 - "Idea de negocio replanteada"
Cohesion: 0.14
Nodes (22): Idea de negocio replanteada, Actualizacion D-005: WhatsApp con Evolution API y n8n; 15-30 dias; una obligacion; aviso de mora, Producto: capa de caja, no otro CRM, Funcion Captura: chats y vouchers a pedidos y pagos con confirmacion humana, Objetivo: negocios que venden por WhatsApp a credito; Corpotex piloto, Funcion Cobra: cronograma 15/30 dias, alertas, estado de cuenta, autorizacion si hay saldo, Funcion Concilia: pagos vs pedidos; parciales, duplicados, huerfanos, diferencias, Demo de 3 minutos: 3 vouchers y un chat (+14 more)

### Community 10 - "Catálogo y fugas financieras"
Cohesion: 0.15
Nodes (19): Fuga 2: plata que no sabes si ganas (precio facturado sin costo real), Cierre financiero ilusorio: margenes por precio facturado, caja quebrada, A02-Q01 Cifra 300 asociada a ticket promedio (unidad y moneda sin confirmar), Catalogo conocido y datos pendientes, A01-Q07 Bot orientado a campanas; tela colombiana no confirmada, A02-Q02 Sistema de facturacion vinculado a inventario; modulo de produccion; salud, polos y casacas, A02-Q08 Costo estimado manual y empirico, A02-Q18 Cotizacion manual; inventario de insumos casi al 100% (+11 more)

### Community 11 - "Fronteras Andrés/Miguel y diagramas v1.3"
Cohesion: 0.14
Nodes (15): Frontera Andres: ER, Flyway, entidades, motor de pagos, saldos, seed, Stack: Java 21, Spring MVC/Security Resource Server, JPA/Flyway/PostgreSQL, Gemini desde servidor, Diagramas Spring v1.3 fuentes y supuestos, Andres dueno de la base; Miguel revisa; ER y contrato API en B0/B1, Cuatro diagramas v1.3: roadmap, dependencias, arquitectura, base de datos, Exportacion: JSON editable, importado en MCP Excalidraw local, PNG verificados geometricamente, Diagramas anteriores (Edge Functions) quedan como antecedente sin sobrescribir, Leyenda de colores y trazos de los diagramas (+7 more)

### Community 12 - "Tarea general de Miguel"
Cohesion: 0.18
Nodes (11): MIG-GENERAL Backend de Miguel, Importes JSON en centavos enteros; BigDecimal en dominio (propuesto), Inventario de entorno 10/10/2026: Claude Code 2.1.296, OpenCode 1.18.35, sin Java en WSL de comprobacion, Frontera Isabella/German: frontend y reglas visibles, Frontera Miguel/Claude: API, JWT, captura, Gemini, adapters, Secuencia MIG-00..MIG-08 y gates, Operacion Git: sin commit/push/cambio de rama por agentes; rama sugerida codex/miguel-backend, Objetivo: API Spring Boot de captura, IA, revision y pedidos (+3 more)

### Community 13 - "Objetivos y datos solicitados"
Cohesion: 0.23
Nodes (13): Objetivos de la empresa y del proyecto, A01-Q08 Reto interrumpido: gestion de los clientes, A02-Q22 Solicitud de datos de un mes (ventas, costos, margenes), A02-Q23 Costos y margenes por prenda; Excel/WhatsApp; IGV incierto, Necesidades de entrevista y propuestas iniciales como antecedentes, Arquitectura propuesta: aplicacion web modular con BD transaccional y procesos en segundo plano, Datos solicitados a Corpotex (septiembre): no acredita recepcion, Direccion inicial: postventa, trazabilidad, stock, fidelizacion (antecedente) (+5 more)

### Community 14 - "Contexto del equipo hackathon"
Cohesion: 0.20
Nodes (12): Contexto del equipo hackathon 2026, Adjunto integro como antecedente, no instrucciones, Equipo de 4: Isabella, German, Andres, Miguel, Hackathon Piura Innova 2026: 10-11 octubre, 24 h, CAMCO, Pendientes: eje/reto, horario pitch, backend/BaaS, roles, Reglas: core desarrollado en 24 h; declarar modulos previos, Roadmap base por bloques horarios y checkpoints sugeridos, Roles sugeridos del adjunto (reemplazados por USR-EQUIPO-002) (+4 more)

### Community 15 - "Prompt Claude Design recibido"
Cohesion: 0.18
Nodes (12): Prompt Claude Design recibido (v2 antecedente), Aceptacion: recorrido 3 vouchers + 1 chat, estados de pago, consolidado sin duplicar, Partes a ajustar por USR-EQUIPO-003/D-004: Supabase backend, ERP/CRM, 30%, vista publica, KeptAI como capa entre CRM (Kommo por confirmar) y ERP Factura Ya por confirmar, Cargo interno de taller 320 eliminado en consolidado, Restricciones de honestidad: no afirmar integraciones activas; alertas solo dentro de la app, USR-DESIGN-001: prompt Claude Design v2, antecedente integro, Marcas Corpotex y Unicrack; produccion propia y terceros (+4 more)

### Community 16 - "Aceptación y límites de la tarea"
Cohesion: 0.25
Nodes (8): Aceptacion general de la tarea, Demo ficticia cobrado 400 / pendiente 400 / margen 110, P001 -40, interno 320 eliminado, Fallback manual de IA es brecha, no exito C-03, 80%/30% no se convierten en perdida real ni algoritmo, Datos de demostracion P-001, P-002, V-001..V-003; cobrado 400, saldo 400, margen 110, Si falla Gemini, edicion manual es limitacion que no cumple C-03/C-04, 80% y 30% no verificados y no usados; factor_mora escenario editable desde 0%, Datos de demostracion P-001, P-002, V-001..V-003; cobrado 400, saldo 400, margen 110

### Community 17 - "Auth, JWKS y Storage"
Cohesion: 0.50
Nodes (4): Auth/JWKS y Storage: bucket privado, URL firmada breve, verificar issuer/audiencia, Flujo de identidad: Supabase Auth JWT, Spring valida y resuelve usuario y organización, MIG-03 (JWT, JDBC, aislamiento RLS) depende de credenciales y verificación, Pruebas mínimas de RLS con rol runtime real (sin contexto, A/B, commit/rollback, JWT inactivo, n8n)

## Ambiguous Edges - Review These
- `actores-flujos-y-der-mvp.md` → `C4 Cuotas: obligación sin cuotas vs CUOTA en DER de Isabel`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `actores-flujos-y-der-mvp.md` → `MIG-05 Cliente Gemini y borrador extraido`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/tareas.md · relation: conceptually_related_to
- `actores-flujos-y-der-mvp.md` → `Sin ERP/CRM: entradas manuales (chat, vouchers, voz, CSV, semilla ficticia)`  [AMBIGUOUS]
  diagramas/keptai-roadmap-fuentes-spring-v1-3.md · relation: conceptually_related_to
- `decisiones-del-proyecto.md` → `Conexion declarada a Kommo y ERP (identidad y acceso pendientes)`  [AMBIGUOUS]
  conocimientos/empresa/idea-negocio-replanteada.md · relation: conceptually_related_to
- `reto-6-corpotex-conciliacion-y-rentabilidad.md` → `P-007 MVP inicial (alcance sustituido por D-003)`  [AMBIGUOUS]
  conocimientos/decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md · relation: conceptually_related_to
- `estado.md` → `Todas las tareas MIG comienzan pendientes`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/tareas.md · relation: conceptually_related_to
- `D-003 Capa de caja como definición principal vigente` → `Recompra: última compra + intervalo − 7 días`  [AMBIGUOUS]
  conocimientos/decisiones/actores-flujos-y-der-mvp.md · relation: conceptually_related_to
- `D-004 Spring Boot, entradas propias y responsabilidades` → `D-005 WhatsApp con Evolution API y n8n dentro del MVP`  [AMBIGUOUS]
  conocimientos/decisiones/decisiones-del-proyecto.md · relation: conceptually_related_to
- `D-005 WhatsApp con Evolution API y n8n dentro del MVP` → `Gemini API gemini-3.5-flash-lite (GEMINI_MODEL)`  [AMBIGUOUS]
  conocimientos/decisiones/infraestructura-desarrollo-mvp.md · relation: conceptually_related_to
- `D-006 Preparación de Miguel, delegación y bitácora` → `Estructura de repo propuesta con backend/ en minúscula`  [AMBIGUOUS]
  conocimientos/decisiones/infraestructura-desarrollo-mvp.md · relation: conceptually_related_to
- `D-006 Preparación de Miguel, delegación y bitácora` → `Crear la app en otro repositorio (antecedente)`  [AMBIGUOUS]
  GUIA-DE-TRABAJO.md · relation: conceptually_related_to
- `A02-Q32 entrevista: plazos 30 y 45 días` → `Plazo de crédito 15 a 30 días (Isabel)`  [AMBIGUOUS]
  conocimientos/decisiones/actores-flujos-y-der-mvp.md · relation: conceptually_related_to
- `A02-Q32 entrevista: plazos 30 y 45 días` → `Plazo 15 a 30 días desde despacho; entrevista 30/45 no es la regla`  [AMBIGUOUS]
  conocimientos/decisiones/roadmap-hackathon-equipo.md · relation: conceptually_related_to
- `n8n (orquestación WhatsApp e IA; sin reglas de negocio)` → `Gemini API gemini-3.5-flash-lite (GEMINI_MODEL)`  [AMBIGUOUS]
  conocimientos/decisiones/infraestructura-desarrollo-mvp.md · relation: conceptually_related_to
- `n8n (orquestación WhatsApp e IA; sin reglas de negocio)` → `Etapa D: MIG-05/06 extracción y revisión`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/plan-implementacion.md · relation: conceptually_related_to
- `Gatekeeper: crédito aprobado o anticipo verificado antes de producción` → `Mora: aviso al vendedor, sin bloqueo automático`  [AMBIGUOUS]
  conocimientos/decisiones/actores-flujos-y-der-mvp.md · relation: conceptually_related_to
- `Vencimiento = fecha acta de despacho + plazo` → `Evento que inicia el plazo editable en panel de configuración`  [AMBIGUOUS]
  conocimientos/decisiones/roadmap-german-frontend.md · relation: conceptually_related_to
- `DER fusionado (Isabel + PROP-DB-001)` → `Nombres de tablas en inglés en PROP-DB-001`  [AMBIGUOUS]
  conocimientos/decisiones/modelo-base-datos-mvp.md · relation: conceptually_related_to
- `Isabel (autora USR-FLUJO-002; DER y D-005)` → `Isabella: componentes de interfaz y reglas funcionales`  [AMBIGUOUS]
  conocimientos/decisiones/roadmap-german-frontend.md · relation: conceptually_related_to
- `PROP-DB-001 Modelo de base de datos MVP (Andrés)` → `UUID+display_code, dinero en centavos, Idempotency-Key, no aprobadas`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/estado.md · relation: conceptually_related_to
- `Esquema V1-V3 en BD/ (DB-DER-001), no desplegado en Supabase` → `receivable / obligacion_cobro`  [AMBIGUOUS]
  conocimientos/decisiones/modelo-base-datos-mvp.md · relation: conceptually_related_to
- `Esquema V1-V3 en BD/ (DB-DER-001), no desplegado en Supabase` → `MIG-02-PROPUESTA contrato OpenAPI 3.1 y DTOs (no completada)`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/estado.md · relation: conceptually_related_to
- `Cargo interno 320: taller -20, comercial -20, consolidado -40` → `Roadmap: centro productivo -S/20 y "margen comercial es −S/20", consolidado -S/40`  [AMBIGUOUS]
  conocimientos/decisiones/roadmap-hackathon-equipo.md · relation: conceptually_related_to
- `Datos demo: cobrado 400, saldo 400, margen conjunto 110; taller -20, pedido -40` → `Roadmap: centro productivo -S/20 y "margen comercial es −S/20", consolidado -S/40`  [AMBIGUOUS]
  conocimientos/decisiones/roadmap-german-frontend.md · relation: conceptually_related_to
- `Stack: Java 21, Spring MVC/Security Resource Server, JPA/Flyway/PostgreSQL, Gemini desde servidor` → `MIG-05 Cliente Gemini y borrador extraido`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/tarea-general.md · relation: conceptually_related_to
- `Stack: Java 21, Spring MVC/Security Resource Server, JPA/Flyway/PostgreSQL, Gemini desde servidor` → `Stack del equipo: Java, Spring Boot, React, n8n, Supabase, Claude Code, OpenCode`  [AMBIGUOUS]
  conocimientos/fuentes/contexto-equipo-hackathon-2026.md · relation: conceptually_related_to
- `Kommo (nombre del CRM, pendiente de confirmar)` → `Conexion declarada a Kommo y ERP (identidad y acceso pendientes)`  [AMBIGUOUS]
  conocimientos/empresa/descripcion.md · relation: conceptually_related_to
- `A02-Q14 Usuarios administrativos y de ventas; vendedoras consultan stock` → `A02-Q09 Propuesta conectar ventas, facturacion y seguimiento`  [AMBIGUOUS]
  conocimientos/procesos/ventas.md · relation: conceptually_related_to
- `A02-Q25 Formalizada 2017, crecimiento desde 2020; digitalizar produccion` → `Diagnostico: hemorragia de liquidez en cobranza, no cuello de ventas/produccion`  [AMBIGUOUS]
  conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md · relation: conceptually_related_to
- `Actualizacion D-005: WhatsApp con Evolution API y n8n; 15-30 dias; una obligacion; aviso de mora` → `Funcion Cobra: cronograma 15/30 dias, alertas, estado de cuenta, autorizacion si hay saldo`  [AMBIGUOUS]
  conocimientos/empresa/idea-negocio-replanteada.md · relation: conceptually_related_to
- `Conexion declarada a Kommo y ERP (identidad y acceso pendientes)` → `MVP sin datos ni integraciones ERP/CRM; entradas WhatsApp prueba y carga manual`  [AMBIGUOUS]
  diagramas/prompt-claude-design.md · relation: conceptually_related_to
- `Segunda fase: recompra a 40 clientes, stock, cotizaciones` → `Fidelizacion y recompra condicionada a 40 clientes recurrentes`  [AMBIGUOUS]
  conocimientos/empresa/idea-negocio-replanteada.md · relation: conceptually_related_to
- `Segunda fase: recompra a 40 clientes, stock, cotizaciones` → `Macroproceso 4: inventario fisico, reserva y mermas`  [AMBIGUOUS]
  conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md · relation: conceptually_related_to
- `80% de ventas a credito (afirmado, sin validar)` → `A02-Q10 Trabajo a credito y plazos: dos pasadas discrepan (35/80)`  [AMBIGUOUS]
  conocimientos/empresa/idea-negocio-replanteada.md · relation: conceptually_related_to
- `80% de ventas a credito (afirmado, sin validar)` → `80% y 30% no verificados; no usar como KPI ni perdida real`  [AMBIGUOUS]
  diagramas/prompt-claude-design.md · relation: conceptually_related_to
- `30% sin significado claro: no presentar como perdida o incobrable` → `A02-Q11 Aproximadamente 30% de cuentas abiertas; sin alertas automaticas`  [AMBIGUOUS]
  conocimientos/empresa/idea-negocio-replanteada.md · relation: conceptually_related_to
- `30% sin significado claro: no presentar como perdida o incobrable` → `30% de cartera sin cobrar (interpretacion del texto, no tasa de morosidad)`  [AMBIGUOUS]
  conocimientos/procesos/flujo-cliente-empresa.md · relation: conceptually_related_to
- `Plazos 15 y 30 dias vs otros plazos de entrevistas, pendientes de politica validada` → `A02-Q32 Credito sin cuotas, plazo unico: 30 y 45 dias, confirmacion final 30`  [AMBIGUOUS]
  conocimientos/empresa/idea-negocio-replanteada.md · relation: conceptually_related_to
- `Direccion vigente: capa de caja (cobro, margen, caja 4 semanas)` → `Direccion inicial: postventa, trazabilidad, stock, fidelizacion (antecedente)`  [AMBIGUOUS]
  conocimientos/empresa/objetivos.md · relation: conceptually_related_to
- `Roles sugeridos del adjunto (reemplazados por USR-EQUIPO-002)` → `USR-EQUIPO-002: Andres y Miguel backend; German e Isabella frontend; sin pitch por ahora`  [AMBIGUOUS]
  conocimientos/fuentes/contexto-equipo-hackathon-2026.md · relation: conceptually_related_to
- `KeptAI como capa entre CRM (Kommo por confirmar) y ERP Factura Ya por confirmar` → `MVP sin datos ni integraciones ERP/CRM; entradas WhatsApp prueba y carga manual`  [AMBIGUOUS]
  conocimientos/fuentes/prompt-claude-design-recibido.md · relation: conceptually_related_to
- `Mostrar 80%/30% como dato aportado, con boton Aplicar 30% y factor_mora 0% por defecto` → `factor_mora editable, valor inicial 0%, sin boton Aplicar 30%`  [AMBIGUOUS]
  conocimientos/fuentes/prompt-claude-design-recibido.md · relation: conceptually_related_to
- `Plazos configurables: demo 15 y 30 dias; entrevista menciona 30/45` → `Plazo 15 a 30 dias, una sola obligacion sin cuotas; evento inicial es el despacho`  [AMBIGUOUS]
  conocimientos/fuentes/prompt-claude-design-recibido.md · relation: conceptually_related_to
- `Restricciones de honestidad: no afirmar integraciones activas; alertas solo dentro de la app` → `Honestidad: WhatsApp en modo prueba; ERP/CRM como Cargar archivo; reglas pendientes rotuladas Propuesta`  [AMBIGUOUS]
  conocimientos/fuentes/prompt-claude-design-recibido.md · relation: conceptually_related_to
- `Automatizacion propuesta: bot consulta estados; recordatorios de cobro revalidados` → `A01-Q05 CRM no conectado al inventario; conectado a bot hasta metodo de pago`  [AMBIGUOUS]
  conocimientos/procesos/atencion-cliente.md · relation: conceptually_related_to
- `A02-Q29 Notificar por WhatsApp y/o correo (sin canal unico)` → `Honestidad: WhatsApp en modo prueba; ERP/CRM como Cargar archivo; reglas pendientes rotuladas Propuesta`  [AMBIGUOUS]
  conocimientos/procesos/atencion-cliente.md · relation: conceptually_related_to
- `80% de ventas a credito (cifra de este mensaje, sin denominador)` → `A02-Q10 Trabajo a credito y plazos: dos pasadas discrepan (35/80)`  [AMBIGUOUS]
  conocimientos/procesos/flujo-cliente-empresa.md · relation: conceptually_related_to
- `30% de cartera sin cobrar (interpretacion del texto, no tasa de morosidad)` → `A02-Q11 Aproximadamente 30% de cuentas abiertas; sin alertas automaticas`  [AMBIGUOUS]
  conocimientos/procesos/flujo-cliente-empresa.md · relation: conceptually_related_to
- `Aprobacion de linea de credito por vendedor, definido por Isabel 10/10/2026, plazo 15 a 30 dias` → `Bloqueo de credito automatico por saldos vencidos o disputa (propuesta; antecedente por D-005)`  [AMBIGUOUS]
  conocimientos/procesos/flujo-cliente-empresa.md · relation: conceptually_related_to
- `Aprobacion de linea de credito por vendedor, definido por Isabel 10/10/2026, plazo 15 a 30 dias` → `A02-Q32 Credito sin cuotas, plazo unico: 30 y 45 dias, confirmacion final 30`  [AMBIGUOUS]
  conocimientos/procesos/flujo-cliente-empresa.md · relation: conceptually_related_to
- `Afirmacion de ausencia de vinculo/cronograma contrastada con modulo de cuentas por cobrar (A02-Q04)` → `A02-Q04 Modulo de cuentas por cobrar en facturacion, desactualizado`  [AMBIGUOUS]
  conocimientos/procesos/flujo-cliente-empresa.md · relation: conceptually_related_to
- `Actualizacion D-005: n8n+Evolution API, Spring unico backend con reglas, KeptAI concilia no integra banco` → `Bloqueo de credito automatico por saldos vencidos o disputa (propuesta; antecedente por D-005)`  [AMBIGUOUS]
  conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md · relation: conceptually_related_to
- `Actualizacion D-005: n8n+Evolution API, Spring unico backend con reglas, KeptAI concilia no integra banco` → `Plazo unico de 30 o 45 dias (antecedente; vigente 15-30 dias una obligacion)`  [AMBIGUOUS]
  conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md · relation: conceptually_related_to
- `80% de ventas a credito informal por WhatsApp (cifra aportada)` → `A02-Q10 Trabajo a credito y plazos: dos pasadas discrepan (35/80)`  [AMBIGUOUS]
  conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md · relation: conceptually_related_to
- `30% morosidad/incobrables (cifra aportada; factor de castigo 30% historico es hipotesis)` → `A02-Q11 Aproximadamente 30% de cuentas abiertas; sin alertas automaticas`  [AMBIGUOUS]
  conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md · relation: conceptually_related_to
- `Bloqueo de credito automatico por saldos vencidos o disputa (propuesta; antecedente por D-005)` → `Mora solo muestra aviso; el vendedor aprueba el credito; sin bloqueo`  [AMBIGUOUS]
  diagramas/prompt-claude-design.md · relation: conceptually_related_to
- `Bloqueo de credito automatico por saldos vencidos o disputa (propuesta; antecedente por D-005)` → `Decisiones del flujo (pedido completo, stock, bloqueo, pago verificado, reclamo) sin validar`  [AMBIGUOUS]
  diagramas/README.md · relation: conceptually_related_to
- `Plazo unico de 30 o 45 dias (antecedente; vigente 15-30 dias una obligacion)` → `A02-Q32 Credito sin cuotas, plazo unico: 30 y 45 dias, confirmacion final 30`  [AMBIGUOUS]
  conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md · relation: conceptually_related_to
- `A02-Q04 Modulo de cuentas por cobrar en facturacion, desactualizado` → `A02-Q09 Propuesta conectar ventas, facturacion y seguimiento`  [AMBIGUOUS]
  conocimientos/procesos/ventas.md · relation: conceptually_related_to
- `A02-Q32 Credito sin cuotas, plazo unico: 30 y 45 dias, confirmacion final 30` → `Plazo 15 a 30 dias, una sola obligacion sin cuotas; evento inicial es el despacho`  [AMBIGUOUS]
  diagramas/prompt-claude-design.md · relation: conceptually_related_to
- `Flujo completo (keptai-flujo-completo): carriles Ventas/CRM, Produccion, Almacen, Fidelizacion, Cobranza` → `Sin ERP/CRM: entradas manuales (chat, vouchers, voz, CSV, semilla ficticia)`  [AMBIGUOUS]
  diagramas/README.md · relation: conceptually_related_to
- `D-005 WhatsApp con Evolution API y n8n (Isabel)` → `C1 Plazo de crédito: 15-30 (D-005) vs 30/45 (A02-Q32, README n8n)`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `D-005 WhatsApp con Evolution API y n8n (Isabel)` → `C2 Evento que inicia el plazo: despacho vs configurable`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `D-005 WhatsApp con Evolution API y n8n (Isabel)` → `C3 Mora: aviso al vendedor vs bloqueo automático / regla dura`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `D-005 WhatsApp con Evolution API y n8n (Isabel)` → `C5 Quién aprueba crédito: vendedor (D-005) sin respaldo en entrevistas`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `Migraciones BD V1-V3 de Andrés (26 tablas, RLS, nota_cliente)` → `C7 Roles: 4 roles BD vs 8 roles propuestos en contrato MIG-02`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `Workflows n8n WF0-WF3 de Isabel (no ejecutados, active:false)` → `C3 Mora: aviso al vendedor vs bloqueo automático / regla dura`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `Contrato MIG-02 (openapi.yaml y DTOs): propuesta, gate abierto` → `C11 Estados y nombres: contrato en inglés vs BD en español`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `Contrato MIG-02 (openapi.yaml y DTOs): propuesta, gate abierto` → `C12 Confianza de IA omitida en contrato, presente en BD y n8n`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `Contrato MIG-02 (openapi.yaml y DTOs): propuesta, gate abierto` → `C2 Evento que inicia el plazo: despacho vs configurable`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `Contrato MIG-02 (openapi.yaml y DTOs): propuesta, gate abierto` → `C7 Roles: 4 roles BD vs 8 roles propuestos en contrato MIG-02`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/revision-integracion-andres.md · relation: conceptually_related_to
- `Pendiente Miguel: reflejar n8n en contrato y reformular MIG-05 (bloquea MIG-03/05)` → `Supabase conectado por MCP; .env de la aplicación no creado`  [AMBIGUOUS]
  conocimientos/desarrollo/miguel/preparacion-supabase-rls.md · relation: conceptually_related_to

## Knowledge Gaps
- **83 isolated node(s):** `D-002 Conocimiento en seis archivos`, `P-001 Pedido como eje`, `P-002 Integración con infraestructura existente`, `T-003 Autoridad de cada dato y conciliación (pendiente)`, `T-004 Muestras de artículos, conteos y pagos (pendiente)` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 87 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MIG-GENERAL Backend de Miguel` connect `Tarea general de Miguel` to `Guía y compartición del cerebro`, `DER y entidades de datos`, `Trabajo de Miguel: D-006 y bitácora`, `D-005, WhatsApp y decisiones`, `Tareas MIG-00 a MIG-08`, `Fronteras Andrés/Miguel y diagramas v1.3`, `Aceptación y límites de la tarea`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Prompt Claude Design v4` (e.g. with `Prompt Claude Design recibido (v2 antecedente)` and `decisiones-del-proyecto.md`) actually correct?**
  _`Prompt Claude Design v4` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `D-002 Conocimiento en seis archivos`, `P-001 Pedido como eje`, `P-002 Integración con infraestructura existente` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Crédito y cobranza: flujo del equipo` be split into smaller, more focused modules?**
  _Cohesion score 0.05285592497868713 - nodes in this community are weakly interconnected._
- **Why does `Ventas, produccion, inventario y cobranza` connect `Crédito y cobranza: flujo del equipo` to `Guía y compartición del cerebro`, `Catálogo y fugas financieras`, `Descripción de Corpotex y entrevistas`, `Tareas MIG-00 a MIG-08`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `actores-flujos-y-der-mvp.md` and `C4 Cuotas: obligación sin cuotas vs CUOTA en DER de Isabel`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `actores-flujos-y-der-mvp.md` and `MIG-05 Cliente Gemini y borrador extraido`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._