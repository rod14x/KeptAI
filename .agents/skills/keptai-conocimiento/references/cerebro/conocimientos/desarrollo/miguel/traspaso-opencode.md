# Traspaso Claude Code → OpenCode

## Cuándo habilitar

Después del principal MIG-00..08 verificable y revisión de Miguel. Si Claude alcanza límite antes de terminar, Miguel puede habilitar continuación explícita: Claude entrega estado parcial y próximo ID pendiente, sin fingir principal completado. Bloqueos DB/motor/IA permanecen documentados y no se sustituyen por mocks. OpenCode no se ejecuta a la vez sobre los archivos que edita Claude.

## Paquete obligatorio de Claude

Estado.md actualizado; branch/commit base y diff pendientes; módulos/endpoints listos; contrato OpenAPI; decisiones y límites; comandos de arranque/pruebas realmente ejecutados; ejemplos ficticios; lista corta de defectos reproducibles. Nunca secretos. Datos/cuentas de demo fuera del prompt si son sensibles.

Cada trabajo posterior tiene ID OBR-xx, objetivo único, archivos permitidos, reproducción, resultado esperado, comando de verificación y prohibiciones relevantes. Priorizar defectos observados, tests faltantes de comportamiento y documentación de lo implementado, no nuevas pantallas/conectores/arquitectura.

## Prompt posterior para OpenCode

```text
Usa keptai-conocimiento leyendo .agents/skills/keptai-conocimiento/SKILL.md
si tu entorno no la descubre. Lee AGENTS.md, CLAUDE.md y
cerebro/conocimientos/desarrollo/miguel/tarea-general.md, estado.md y
traspaso-opencode.md. Lee el contrato/archivos pertinentes a la tarea OBR.

Comprueba el tipo de handoff que Miguel autoriza: principal terminado con
QA OBR-XX, o principal parcial con siguiente MIG-XX pendiente por límite
de Claude. Lee evidencia y no asumas que está terminado. Ejecuta solo ese
ID adjunto con archivos permitidos y criterio de aceptación.
Respeta Spring Boot y dominio existente, no modifiques el motor de Andrés,
no introduzcas otra arquitectura ni datos ERP/CRM. Conserva cambios ajenos.
Prueba el comportamiento pedido, informa diff y resultados reales y registra
el handoff. No commit/push ni control de terminales ajenas.
```

Este prompt es plantilla; antes de usarlo hay que sustituir OBR-XX o MIG-XX y adjuntar
una tarea concreta. No hay todavía defecto OBR validado ni trabajo asignado.
