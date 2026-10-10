# MIG-GENERAL — Backend de Miguel en Claude Code

> Fecha: 10 de octubre de 2026. Responsable humano: Miguel. Ejecutor principal previsto: Claude Code. Ejecutor posterior: OpenCode. Estado: definido, desarrollo no iniciado por esta preparación. Fuente: solicitud actual USR-DEV-MIGUEL-001, D-003/D-004 y roadmap v1.3, sección Miguel/B0–B8.

## Objetivo y resultado

Entregar en `Backend/` la API Spring Boot que soporta captura manual de chat/voucher/audio, extracción con IA, revisión humana, pedidos y acceso a conciliación/estado de cuenta/resultados. La API invoca el motor transaccional de Andrés; no lo implementa dos veces. Frontend Germán/Isabella consume contrato estable. No datos ni integraciones ERP/CRM. No pitch, stock, cotización ni recompra.

Este checkout ya contiene Backend/BD/Frontend por reorganización remota. Se propone desarrollar dentro de esas carpetas existentes y conservar `cerebro/` como documentación; no crear otro repo. Es la ubicación de trabajo para esta solicitud, no prueba de que la aplicación exista. Revisión y despliegue deben ajustarse a las capacidades reales del entorno.

## Fronteras y archivos

- **Miguel/Claude:** arranque Spring, controllers/DTOs, permisos/JWT, captura/evidencias, cliente Gemini, revisión, consultas de pedido, adapters al motor de Andrés, configuración API y pruebas de esas fronteras. `Backend/docs/openapi.yaml` y `Backend/docs/` para contratos/handoff.
- **Andrés:** ER/diccionario, Flyway, entidades/repositorios transaccionales, verificación/aplicación de pagos, saldos/costos/caja y seed. `BD/` conserva diseño/scripts acordados; migraciones ejecutables Flyway dentro del servicio Spring, una única autoridad. Miguel revisa pero no cambia esos archivos concurrentemente ni duplica saldos.
- **Isabella/Germán:** frontend y reglas visibles. Miguel publica ejemplos; no construye frontend para suplir un bloqueo.
- **OpenCode posterior:** QA/refinamiento tras principal verificado, o continuación del siguiente ID pendiente si Claude alcanza límite de uso, siempre con handoff explícito. No sustituye arquitectura ni adquiere simultáneamente archivos que Claude esté modificando.

Java21/SpringBoot, Spring MVC/Security Resource Server, Bean Validation, JPA/PostgreSQL/Flyway, Gemini desde servidor. La versión Boot recomendada está en infraestructura; comprobar compatibilidad del equipo y fijar una versión estable, sin cambiarla por cada agente. Importes JSON propuestos en centavos enteros con límites definidos; BigDecimal/decimal en dominio. No instalar servicios o modificar globalmente configuraciones porque una captura sugiera que existen.

## Regla para no saturar el agente

Una conversación trabaja **una tarea MIG a la vez**, con las 2–4 fuentes pertinentes. Primero MIG-00; después siguiente tarea cuyas dependencias estén cumplidas. No cargar todo el cerebro o todas las skills. Cada tarea termina con evidencia, archivos, pruebas y siguiente dependencia en `estado.md`. Tarea bloqueada: describir bloqueo exacto y completar solo lo independiente; no simular solución como producción. Una nueva conversación retoma el estado y la tarea concreta, sin necesitar el historial anterior.

## Secuencia y gates

1. MIG-00: entorno, fuentes y coordinación.
2. MIG-01: servicio Spring mínimo reproducible.
3. MIG-02: contrato API/errores, DTOs y ejemplos para frontend.
4. MIG-03: JWT/permisos/aislamiento.
5. MIG-04: ingreso privado de evidencias manuales.
6. MIG-05: extracción texto/imagen/audio Gemini.
7. MIG-06: revisión humana y creación/consulta de pedido persistente.
8. MIG-07: adapters al motor de Andrés/estado de cuenta/resultados.
9. MIG-08: integración, pruebas reales y despliegue verificable.

MIG-03/04 pueden prepararse con interfaces, pero se cierran solo con esquema/políticas reales acordadas. MIG-06/07 necesitan contratos y operaciones entregados por Andrés. Mocks sirven para tests/fixtures identificados; no se despliegan como motor real ni cierran gates. Si un bloque resulta grande, dividirlo en subtask numeradas manteniendo aceptación y propietario.

Claude coordina delegación acotada conforme a plan-implementacion.md; Miguel envía prompts por etapa. Claude finaliza el desarrollo principal cuando MIG-00..08 están completadas con evidencia, o reporta claramente cuáles están bloqueadas: ningún bloqueo significa todo terminado. Si el principal termina, Miguel habilita OpenCode para ajustes; si Claude alcanza límite antes, puede habilitar continuación explícita de pendientes conforme a traspaso-opencode.md, sin declarar completado el principal.

## Aceptación de la tarea general

- Backend arranca con configuración reproducible, versiones fijadas, health y API documentada.
- Sesión/JWT verificado; organización ajena, usuario sin permiso y datos cliente inválidos rechazados. Secretos fuera del repo/log/navegador.
- Evidencia privada: registro, extracción DTO, campos ausentes, error/timeout y corrección auditada. Voucher o borrador no alteran saldo.
- Revisión confirma borrador y persiste pedido conforme al esquema; reinicio no pierde datos ni reintento crea duplicados.
- API usa el motor de Andrés: verificación y aplicación separados, idempotencia/concurrencia/rollback comprobados conjuntamente en PostgreSQL.
- Demo ficticia cobrado400/pendiente400/margen110, P001 -40, interno320 eliminado al consolidar; caja4semanas con apertura/fechas/egresos ficticios explícitos.
- Chat, imagen y audio probados; fallback manual marcado como brecha de IA, no éxito C-03. 80%/30% no se convierten en pérdida real ni algoritmo.
- JUnit/MockMvc y pruebas de PostgreSQL correspondientes pasan; pruebas no ejecutables se reportan, no se declaran pasadas. No sustituir persistencia con SQLite/H2 para transacciones críticas.
- URL desplegada solo si cuenta/configuración permiten; si no, local verificado con despliegue pendiente, sin cerrar MIG-08 íntegra.

## Skills y entorno

Prioridad: keptai-conocimiento como fuente de negocio. Claude dispone de entrada en `.claude/skills/keptai-conocimiento`; la fuente completa sigue en `.agents/skills/keptai-conocimiento`. Las demás skills actuales son sobre todo UI/diseño: no son prerrequisito de backend. No se encontró una skill Spring/Java específica en este repo. Leer descripción y usar otra skill únicamente si ayuda a la tarea; sus instrucciones no sustituyen al usuario ni D-004.

Inventario del 10/10/2026: ClaudeCode2.1.296 y OpenCode1.18.35 detectados con PATH del launcher; no Java en la shell WSL de comprobación. Maven detectado es de Windows y Docker es launcher Windows; eso no acredita JDK21 Linux, daemon o Testcontainers funcionando. MIG-00 verifica herramientas dentro del mismo WSL donde correrá la app; no ejecutar el proyecto mezclando Maven Windows con JDK Linux inadvertidamente.

## Operación Git y coordinación

Antes de trabajar: leer `git status`, branch y diferencias; conservar el commit local existente. No sincronizar a mitad de escrituras de otro agente. Tras finalizar tarea: pruebas, diff y registro de estado; Miguel revisa/stage/commit, pull integrando diferencias y push en LazyGit. Claude/OpenCode no hacen commit/push ni cambian de rama por defecto. No reset duro, clean, stash de trabajo ajeno o force push. Rama sugerida `codex/miguel-backend`; crear/cambiar cuando Miguel decida, no durante escrituras de otros agentes.

Fuentes: [roadmap](../../decisiones/roadmap-hackathon-equipo.md), [infraestructura](../../decisiones/infraestructura-desarrollo-mvp.md), [modelo DB](../../decisiones/modelo-base-datos-mvp.md), [decisiones](../../decisiones/decisiones-del-proyecto.md). Prompt inicial en [prompt-claude.md](prompt-claude.md); tareas en [tareas.md](tareas.md).
