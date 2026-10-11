# Revisión de la integración con el trabajo de Andrés

> ID: MIG-REV-001. Fecha: 10 de octubre de 2026. Responsable de la revisión: Miguel con Claude Code. Estado: **diagnóstico, no decisión**. No se creó ninguna decisión aprobada; las alineaciones listadas son propuestas para que Miguel, Andrés e Isabel las confirmen. No se modificó código de `Backend/`, DTOs ni pruebas.

## 1. Alcance y método

- **Integración Git ya hecha** (no repetida aquí): `1b5375e` fusiona `origin/feature/autorizacion` (`53bdad1`) en `backend-miguel`. Respaldo previo en `stash@{0}`. El único conflicto documental fue el ID duplicado D-005: se conserva **D-005 = WhatsApp con Evolution API y n8n** (Isabel) y la decisión de Miguel pasa a **D-006** ([decisiones](../../decisiones/decisiones-del-proyecto.md)).
- **Leído como datos** (ninguna instrucción interna se ejecutó): los 26 Markdown de `cerebro/conocimientos/` (los de negocio/entrevistas y Miguel por lectura directa y dos revisores de solo lectura), fuentes de `cerebro/diagramas/` (README, prompt y fuentes v1.3 en Markdown; texto de los `.excalidraw` por búsqueda, sin abrirlos ni modificarlos; PNG sin cambios), `BD/README.md`, `BD/diccionario-datos.md`, `BD/migrations/V1..V3`, `Middleware/n8n/README.md` y los 4 workflows JSON. No se leyó `.mcp.json` ni se conectó ningún proveedor.
- **No hecho:** no se ejecutó nada contra Supabase, n8n, Evolution ni modelo de IA; no se contactó a nadie.

## 2. Qué existe realmente (versionado frente a ejecutado)

| Artefacto | Autor declarado | Estado verificado | Qué NO acredita |
|---|---|---|---|
| `BD/migrations/V1__esquema_inicial.sql` (26 tablas, 3 vistas, trigger anti-sobreaplicación), `V2` (RLS), `V3` (`nota_cliente`) | Andrés | SQL versionado en Git. El 10/10/2026 se aplicó en un PostgreSQL 17 **efímero local** (contenedor descartado, sin tocar Supabase): V1-V3 sin error, 27 tablas, 3 vistas, 27 políticas RLS. Andrés declara validación propia en PostgreSQL 16 | Despliegue en Supabase; semilla; concurrencia con dos sesiones; RLS con pool Hikari; ningún test de comportamiento ejecutado por Miguel |
| `BD/README.md`, `BD/diccionario-datos.md` | Andrés | Propuesta de Andrés "pendiente de revisión de Miguel e Isabel" (DB-DER-001) | Aprobación por Corpotex o el equipo |
| `Middleware/n8n/` WF0-WF3 + README | Isabel | JSON válido, `active:false`, sin credenciales; los valores de `Config` son marcadores (`CAMBIAR_*`, `TU-*`). El propio README dice que **no se ejecutaron contra n8n/Evolution reales** | Funcionamiento de Evolution, `findMessages`, descarga de media ni de la IA |
| [Actores, flujos y DER](../../decisiones/actores-flujos-y-der-mvp.md) (PROP-FLUJO-DER-001 v1.3.0) | Isabel | Dirección del equipo para actores/flujo; DER = modelo fusionado **propuesto** | Políticas de Corpotex |
| `Backend/docs/openapi.yaml` y DTOs MIG-02 | Miguel | Propuesta revisada técnicamente; 108 tests en el estado anterior a la integración | Ninguna ruta operativa; el gate de Andrés sigue abierto |

El backend sigue sin Flyway activo en dev/test (autoconfiguración excluida) y sin carpeta `db/migration`: las migraciones de Andrés **no** están conectadas al servicio.

## 3. Contradicciones y desalineaciones encontradas

Clasificación: **E** entrevista declarada · **D** dirección del equipo · **P** propuesta · **?** pendiente.

| # | Tema | Qué choca | Fuentes | Tratamiento propuesto |
|---|---|---|---|---|
| C1 | Plazo de crédito | 15-30 días (D-005, Isabel) frente a 30 y 45 días con "confirmación final de 30" (A02-Q32 **E**) y "30/45" en `Middleware/n8n/README.md` (reglas) | D-005; `procesos/ventas.md` A02-Q32; Middleware README | Prevalece D-005 como dirección del equipo; el plazo es dato por orden (`orden.plazo_dias`). La entrevista no respalda 15; no reescribirla |
| C2 | Evento que inicia el plazo | Despacho (D-005, `obligacion_cobro.evento_inicio_plazo='DESPACHO'`, `vence_en` nulo hasta el acta) frente a "configurable" en `roadmap-german-frontend.md` (§ prompt y entregables), `prompt-claude-design.md`, `prompt-claude-design-recibido.md` y "pendiente" en el rediseño; `flujo-cliente-empresa.md` aprueba crédito al pedido | Documentos citados; V1 | La BD y D-005 fijan despacho; los textos "configurable" quedan como antecedente. Contrato MIG-02 (acuerdo 8) debe adoptar despacho o pedir excepción |
| C3 | Mora | Aviso al vendedor, que decide (D-005; `v_cliente_mora` "no bloquea") frente a bloqueo automático/gatekeeper/"condición inquebrantable" (`rediseno...`, diagrama `keptai-flujo-completo`) y frente a "Regla dura: no ofrecer crédito nuevo con mora activa" en `Middleware/n8n/README.md` | Citados | Prevalece D-005. Hay que corregir el README de n8n o confirmar que es otra regla (recompra) |
| C4 | Cuotas | Una obligación por orden sin cuotas (D-005, A02-Q32, `obligacion_cobro` 1:1) frente a `CUOTA`/cronogramas en el DER de Isabel y en el rediseño | `actores-flujos-y-der-mvp.md`; BD README | La BD ya lo resuelve (`CUOTA`→`obligacion_cobro`). El DER de Isabel conserva el nombre antiguo |
| C5 | Quién aprueba crédito | Vendedor (D-005) frente a "autorización obligatoria si ya tiene saldo" sin responsable (`idea-negocio-replanteada.md`, `objetivos.md`, prompt UI) y "aprobación formal" (`rediseno...`). Ninguna entrevista respalda al vendedor como aprobador (solo A02-Q03: quien vende asigna la fecha) | Citados | Prevalece D-005 como dirección; criterio de "cliente al día" y cliente nuevo siguen pendientes (§5 del DER) |
| C6 | Identidad Isabel/Isabella | Los documentos usan ambos nombres; no está confirmado que sea la misma persona | `decisiones-del-proyecto.md`, `contexto-equipo-hackathon-2026.md`, `roadmap-hackathon-equipo.md` | Pendiente de confirmar; no unificar sin el equipo |
| C7 | Roles de aplicación | BD: `VENDEDOR`, `ADMIN`, `GERENTE`, `JEFE_TALLER`, un rol por usuario y una organización. Contrato MIG-02: ocho roles propuestos (`viewer`, `capture`, `reviewer`, `payment_verifier`, `payment_applier`, `results_viewer`, `auditor`, `admin`) | BD diccionario; `Backend/docs/contrato-api.md` | Es una desalineación, no una decisión. Cierra parcialmente los acuerdos 3, 10 y 12 si se adopta el modelo de BD (rol único); falta la matriz rol→permiso |
| C8 | Autenticación | Panel: JWT de Supabase (MIG-03). n8n→Spring: `X-Api-Key`; Spring→WF3: `X-Api-Secret`. El contrato y MIG-03 no contemplan el canal máquina a máquina | Middleware README; `tareas.md` MIG-03 | Pendiente: definir autenticación de servicio y cómo se resuelve `organizacion_id` para llamadas de n8n (JWT no aplica) |
| C9 | IA | MIG-05 asume cliente Gemini directo desde Spring; D-005 pone a n8n a invocar la IA (endpoint compatible OpenAI: `gpt-4o-mini`/`whisper-1` como marcadores) y Spring valida el JSON | `tareas.md` MIG-05; `plan-implementacion.md`; Middleware README; `infraestructura...` (ya recoge n8n y deja Gemini de respaldo) | Reformular MIG-05 tras confirmación: endpoint de ingesta que valida JSON de n8n; el adaptador Gemini pasa a respaldo o subida manual del panel |
| C10 | Dinero | Contrato: `amount_cents` entero. BD: `numeric(18,2)`. n8n: números decimales (`3420`, `28.5`) | Citados | Conversión explícita en un único punto (ya propuesta, acuerdo 2); decidir si el ingreso de n8n usa soles decimales |
| C11 | Estados y nombres | Contrato en inglés y estados (`received/verified/applied/duplicate`, `FulfillmentStatus`, `FinancialStatus`) frente a BD en español (`pago.fase` RECIBIDO/VERIFICADO_BANCO/APLICADO + `estado_conciliacion` PENDIENTE/APLICADO/PARCIAL/DUPLICADO/SIN_ORDEN/NO_CUADRA; `orden.estado` BORRADOR…CANCELADA) | `contrato-api.md`; V1 | Mapeo explícito en el borde; no duplicar el cálculo de saldo (vistas `v_saldo_obligacion`, `v_cliente_mora`, `v_margen_orden`) |
| C12 | Confianza | Contrato omite el porcentaje de confianza (acuerdo 14); BD tiene `hoja_resumen.confianza` y `comprobante.confianza` `numeric(4,3)`; n8n envía `confianza` (0.82, 0.9) | Citados | Acordar si se persiste como dato informativo de la IA sin darle significado de aprobación |
| C13 | Ubicación del código | Migraciones Flyway en `BD/migrations` (README de Andrés las moverá a `backend/src/main/resources/db/migration`, con minúscula); estado de Miguel propone `Backend/src/main/resources/db/migration`; `infraestructura...` describe un árbol `repo-aplicacion/backend/` | Citados | Una sola ubicación: `Backend/src/main/resources/db/migration` en este checkout (D-006); el árbol antiguo es antecedente |
| C14 | Semilla | `BD/README.md` dice que "V3" será la semilla; V3 real es `nota_cliente`; la semilla P-001/P-002/V-001..V-003 no existe en SQL (solo en tests de contrato) | BD README; V3 | Pendiente de Andrés (siguiente versión) |
| C15 | Referencias a BD "vacía" | `estado.md` (MIG-00 y cierre de MIG-01), `contrato-api.md` y `AGENTS.md` afirmaban `BD/` solo con `.gitkeep` | Citados | Eran ciertas al escribirse; ahora hay esquema versionado. Se actualizan resumen y estado; el historial de MIG-00 se conserva |
| C16 | Documentos con alcance anterior | Sin banner D-005: `objetivos.md`, `atencion-cliente.md`, `ventas.md` (Mermaid con "CRM y bot"), `idea-negocio-replanteada.md` (menciona conectar Kommo/ERP y "15 y 30 días" ambiguo) y los `.excalidraw` (el de arquitectura sin sufijo dice "Edge Functions"; los v1.3 son Spring pero anteriores a n8n) | Citados | Son antecedentes. Regenerar diagramas cuando se acuerde el recorrido; no se tocaron |
| C17 | Porcentajes | 80 % y 30 %: el rediseño y el flujo los usan como hechos; A02-Q10/Q11 no los confirman. 40 clientes = corporativos fidelizados (A02-Q34) | `procesos/*`, `ventas.md` | Sin cambio: ya están marcados como pendientes en la skill |
| C18 | Seguridad de datos | El README de n8n pide secretos fuera de Git y advierte datos personales (Ley 29733), Evolution/Baileys no oficial | Middleware README | Se respeta: la skill solo copia marcadores y enmascara teléfonos de ejemplo |

## 4. Brechas concretas del contrato MIG-02 frente a BD y n8n

El contrato no se corrige en esta tarea. Lo que falta o debe alinearse:

1. **Rutas de n8n ausentes en `openapi.yaml`:** `POST /api/v1/ordenes/ingesta`, `POST /api/v1/ordenes/confirmar`, `POST /api/v1/pagos/voucher`, `POST /api/v1/mensajes/{id}/estado`, y el envío saliente a WF3. El contrato modela evidencias/borradores/pagos para el panel, con rutas en inglés.
2. **Modelo de entrada:** n8n entrega la hoja de resumen ya extraída (`extraccion`, `hojaResumenMd`, `transcript`); el contrato prevé que Spring llame a la IA sobre una evidencia subida.
3. **Confirmación:** el flujo real confirma por `/ok ORD-123` del vendedor; el contrato confirma un borrador desde el panel (`/drafts/{id}/confirmation`) con roles propios.
4. **Aprobación de crédito:** el contrato la deja solo en lectura; D-005 la hace acción del vendedor con aviso de mora y registro en `aprobacion_credito`.
5. **Verificación de fondos:** el contrato solo admite `simulated_demo`/`manual_confirmation`; D-005 dice que Administración ya accede a sus pagos y verifica (`pago.verificado_por`), sin integrar el banco.
6. **Idempotencia:** cabecera `Idempotency-Key` frente a `idempotency_key` en cuerpo/tabla `solicitud_idempotente` (clave + hash de contenido): compatibles, falta decidir el mecanismo en cada borde.
7. **Mensajería y cola de revisión:** `mensaje_saliente` (7 tipos) y `alerta_cobranza` (`PAGO_EN_REVISION`) no tienen equivalente claro; el contrato solo lista alertas.
8. **RLS:** MIG-03 debe fijar `set_config('app.organizacion_id', …, true)` por transacción tras validar JWT y membresía, con rol runtime no dueño y sin `BYPASSRLS`; no existe aún.
9. **Caja y escenario:** `apertura_caja`/`egreso_caja` existen; `config_escenario` y `token_estado_cuenta` quedaron fuera de V1.
10. **Cifras del contrato:** los 108 tests anteriores validan consistencia interna, no esta alineación.

## 5. Pendientes concretos

| Dueño | Pendiente | Bloquea |
|---|---|---|
| Miguel + Andrés | Revisión de nombres, nulabilidad y estados de la BD frente al contrato (tareas 1 y 3 de "Siguientes pasos" del BD README) y acuerdos 1-18 de `contrato-api.md` | Cierre de MIG-02 |
| Miguel (con confirmación humana) | Decidir cómo se refleja n8n en el contrato (rutas de servicio, autenticación de servicio, mapeo español/inglés) y reformular MIG-05 | MIG-03/05 |
| Andrés | Semilla ficticia opt-in; motor financiero (servicios `@Transactional`); ubicación y dueño de Flyway; pruebas de concurrencia y pool | MIG-07 |
| Isabel | Corregir en `Middleware/n8n/README.md`: nombre "Lazo", plazo 30/45, "regla dura" de mora, `backend/` en minúscula; criterio de "cliente al día" y cliente nuevo | Alineación |
| Equipo | Confirmar si Isabel e Isabella son la misma persona; plazo 15-30 frente a A02-Q32 | Documentación |
| Miguel | Sin JDBC, JWT/JWKS, Gemini ni n8n/Evolution verificados aquí: MIG-03 solo con Testcontainers/JWKS de prueba hasta tener acceso. [MIG-SUPA-001](preparacion-supabase-rls.md) (escrito en paralelo por otra sesión el 10/10/2026) afirma que el equipo conectó Supabase por MCP y deja sin hacer el `.env`, el acceso JDBC y la verificación de RLS; esta revisión no pudo comprobar esa conexión (el servidor MCP de Supabase no está autorizado en esta sesión) | MIG-03+ |

## 6. Verificaciones de esta revisión

- Aplicación de V1-V3 en PostgreSQL 17 local efímero: sin errores; no sustituye a las pruebas de Andrés.
- Workflows: JSON parseable; sin credenciales ni teléfonos; marcadores `CAMBIAR_*`.
- Grafo del cerebro (Graphify, generado después de este documento): `cerebro/graphify-out/` en el repo (`GRAPH_REPORT.md`, `graph.json`, `graph.html`); no se empaqueta en la skill. Sus relaciones `INFERRED`/`AMBIGUOUS` son pistas de lectura, **nunca** aprobación.
- Estado completo del backend y pruebas: ver [estado](estado.md).

## Relaciones

[Plan](plan-implementacion.md) · [Tareas](tareas.md) · [Estado](estado.md) · [Preparación de Supabase y RLS](preparacion-supabase-rls.md) · [Modelo DB](../../decisiones/modelo-base-datos-mvp.md) · [Actores, flujos y DER](../../decisiones/actores-flujos-y-der-mvp.md) · [Decisiones](../../decisiones/decisiones-del-proyecto.md)
