# Guía práctica — Claude genera código y Miguel dirige por prompts

## Preparar sesión

Trabajar desde `/home/miguel/dev/hackaton/conocimiento` en WSL. Abrir una conversación Claude para desarrollo; la conversación de diagramas no define el objetivo nuevo. No lanzar otro Herdr ni controlar panes existentes desde automatización. Si quieres iniciar desde una shell libre en la raíz: `./scripts/keptai claude-miguel`. Es un comando interactivo, no se ejecutó en esta preparación. Alternativa: usar tu Claude abierto y pegar el prompt inicial.

Revisar LazyGit y completar actualización antes de escrituras del agente. Este checkout ya tiene todos los commits remotos consultados y un commit local previo; no borrarlo para empezar. Elegir rama personal cuando no haya otros escritores en el mismo checkout. Durante desarrollo, solo Miguel maneja Git; sus agentes entregan diff/pruebas.

## Prompt inicial (primera etapa)

```text
Usa keptai-conocimiento y lee AGENTS.md, CLAUDE.md,
cerebro/conocimientos/desarrollo/miguel/tarea-general.md,
plan-implementacion.md, tareas.md y estado.md del mismo directorio.
Trabajaremos mi parte, Miguel, con Claude como coordinador.
Ejecuta solo Etapa A/MIG-00; delega lectura de fuentes a un subagente
si ayuda. Verifica entorno WSL real, Git y dependencias de Andrés.
No implementes código todavía. Registra hallazgos en estado.md y el
resumen de avance en AGENTS.md. Devuelve el siguiente paso listo.
Sin commit/push, cambios globales ni control de otras terminales.
```

## Prompts para implementar por etapa

Después de MIG-00 completada, pedir B; luego C/D/E/F cuando gates estén listos. Si una etapa es grande, solicitar un solo ID, no un mes de trabajo en un prompt.

```text
Retoma el plan de Miguel desde estado.md. Ejecuta solo Etapa B:
MIG-01 y después MIG-02, con gates reales y dependencias del plan.
Delega implementación a subagentes acotados, sin dos escritores por
archivo; revisión read-only puede ir en paralelo. Tú integra y prueba.
No invadas DB/motor de Andrés ni crees mocks que parezcan servicio real.
Entrega código y pruebas de esta etapa, actualiza bitácora y resumen
AGENTS.md, y detente antes de Etapa C. Sin commit/push.
```

Cambiar por Etapa C (MIG03/04), D (05/06), E (07) o F (08). Para un bloque pequeño:

```text
Ejecuta únicamente MIG-05 desde tareas.md. Delega un constructor de
captura y una revisión solo lectura con archivos/acceso delimitados.
Usa el contrato y la DB existentes; prueba texto/imagen/audio, timeouts
JSON inválido y ausentes. Actualiza estado/AGENTS con resultados reales.
Si falta Gemini, reporta bloqueo sin sustituirlo por extracción ficticia.
No pases a MIG-06 ni hagas commit/push.
```

## Qué revisar antes de avanzar

Leer la entrega del coordinador: archivos editados, comandos/pruebas realmente ejecutados, qué funciona y qué sigue bloqueado. Probar el endpoint/recorrido que se prometió. Revisar diff en LazyGit y confirmar que solo corresponde a la etapa y no pisó archivos de Andrés/Germán/Isabella. Un test no ejecutado por falta de Java/DB/secret no cuenta como pasado.

Si hay fallo:

```text
No avances de etapa. Corrige el fallo [mensaje o reproducción sin secretos]
en la etapa actual. Respeta propietarios/contratos; repite solo pruebas
afectadas e integradas necesarias. Actualiza estado/AGENTS con resultado.
```

Cuando esté verificado: stage archivos revisados (Espacio), commit (`c`), pull (`p`, integrar conflictos con política acordada), push (`Shift+p`). Si pull dice divergencia, elegir explícitamente merge/rebase; no force-push/reset como solución. No hacer pull mientras los agentes escriben. Publicación la hace Miguel salvo autorización posterior distinta.

## Ahorrar contexto y retomar

Pedir una etapa/ID por turno. No cargar todos los anexos ni skills UI al backend. Revisión read-only resume hallazgos, no pega logs completos. Mantener misma conversación mientras sea útil y usar checkpoint para una nueva sesión: el nuevo agente lee plan/estado/AGENTS, no requiere el historial entero. Puede usar `/compact` para comprimir contexto según la CLI; no equivale a recuperar cuota de uso.

```text
Haz checkpoint de Miguel ahora. Termina o reporta encargos activos,
registra IDs hechos/pendientes, diff/archivos, pruebas reales y errores,
y deja siguiente tarea exacta en estado.md y resumen AGENTS.md.
No inicies nuevos encargos ni commit/push después del checkpoint.
```

## Traspasar a OpenCode

Si Claude acaba principal, OpenCode toma defectos/QA/refinamiento delimitados. Si el uso de Claude termina antes, OpenCode retoma el siguiente ID pendiente con handoff explícito. No ejecutar ambos editando simultáneamente el mismo módulo. Leer [traspaso-opencode.md](traspaso-opencode.md) y adjuntar ID, archivos permitidos y aceptación.

Las credenciales se configuran por variables del entorno, nunca en prompts/Markdown ni logs. Estas instrucciones guían desarrollo; todavía no hay app implementada, secretos configurados ni servicios desplegados por esta preparación.
