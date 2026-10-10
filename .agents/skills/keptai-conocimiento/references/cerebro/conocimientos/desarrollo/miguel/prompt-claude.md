# Prompt de inicio para Claude Code — Miguel

Desde la raíz del repo, iniciar una conversación para desarrollo (la conversación de diagramas tiene otro objetivo). Copiar:

```text
Trabajaremos la parte de Miguel del backend KeptAI. Usa keptai-conocimiento.
Lee AGENTS.md, CLAUDE.md y:
- cerebro/conocimientos/INDICE.md;
- cerebro/conocimientos/decisiones/decisiones-del-proyecto.md (D-003/D-004/D-005);
- cerebro/conocimientos/desarrollo/miguel/tarea-general.md;
- cerebro/conocimientos/desarrollo/miguel/plan-implementacion.md;
- cerebro/conocimientos/desarrollo/miguel/tareas.md;
- cerebro/conocimientos/desarrollo/miguel/estado.md.
Lee solo secciones adicionales necesarias. La skill completa está en
.agents/skills/keptai-conocimiento; existe una entrada .claude/skills.

Tú eres el coordinador principal de Miguel; delega encargos acotados según el plan. Spring Boot/Java21 en Backend/;
Andrés define DB/Flyway y motor financiero, Miguel revisa y construye API/IA.
Germán/Isabella frontend. Sin ERP/CRM ni pitch. Entrada manual y demo ficticia.
No cargues todas las skills: usa solo las pertinentes. Las skills de UI no
son requisitos de backend. No controles otras terminales/agentes ni asumas
credenciales por lo que aparece en una captura.

En ESTE turno ejecuta solo MIG-00. Verifica entorno real (Java21/Maven en WSL,
Docker, rutas, Git, fuentes/contratos) y registra hallazgos en estado.md.
No implementes código de aplicación en MIG-00 ni saltes a las demás tareas.
No cambies trabajo/archivos de Andrés ni recalcules su motor en otra capa.
Si falta una dependencia, describe exactamente lo que falta y prepara el
siguiente paso sin presentar mocks o pruebas no ejecutadas como reales.

Conserva el trabajo local y el commit existente. No commit/push, reset,
clean ni cambio de rama sin mi instrucción. Termina con resumen, archivos,
comandos comprobados, bloqueos y la siguiente tarea elegible. Yo te daré
el ID de la próxima tarea en otro turno. OpenCode entra después del principal.
```

Para continuar una vez completado MIG-00:

```text
Retoma MIG-GENERAL desde estado.md. Ejecuta únicamente MIG-01 de tareas.md.
Conserva las fronteras y no hagas commit/push. Actualiza estado con pruebas
reales, archivos y bloqueos; luego detente antes de la siguiente tarea.
```

Cambiar MIG-01 por el siguiente ID listo. Sesión nueva: incluir tarea-general,
estado y tarea seleccionada; no requiere cargar historial entero. No copiar
secretos en el prompt. El desarrollo principal se completa paso a paso; no
se lanza aquí automáticamente un agente ni se interrumpe la sesión existente.
