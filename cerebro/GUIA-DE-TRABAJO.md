# Trabajo con el cerebro y el entorno

## Inicio en Ubuntu, dentro de WezTerm/Herdr
```bash
cd ~/dev/hackaton/conocimiento
git pull --ff-only
code .
claude
```
Herdr organiza sesiones y terminales. Claude consulta la carpeta que abres y puede dibujar mediante el MCP Excalidraw ya configurado. En otra terminal puedes abrir `hermes-dev` desde esta misma carpeta para coordinar una tarea explícita. No iniciar otro Herdr dentro de Herdr.

## Primera sesión de diseño
Pega en Claude:
> Lee conocimientos/INDICE.md y los documentos de objetivos, ventas y decisiones. Abre diagramas/keptai-mapa-inicial.excalidraw usando Excalidraw. Conserva el contenido existente del lienzo. Explica el flujo y distingue entrevistas, propuestas y decisiones pendientes. Propón un primer recorrido de demostración con criterios de aceptación y referencias. No programes todavía. No des por confirmados los proveedores, APIs, plazos de crédito ni stock.

## Después de revisar el mapa
Acordar el recorrido del MVP, responsables, fuentes de datos y estados. Registrar cada decisión con fecha, responsable y fuente antes de convertirla en requisito. Crear el código de la aplicación en otro repositorio; mantener KeptAI como conocimiento compartido. Comunicar al agente la ruta absoluta de este cerebro para cada tarea de desarrollo. Leer el índice y los documentos relevantes: no hace falta copiar todo el cerebro a cada conversación.

## Herramientas por tarea
- Claude Code: leer conocimiento, proponer requisitos, dibujar y realizar la primera implementación.
- Excalidraw: acordar proceso y arquitectura; guardar archivos editables en diagramas/.
- Hermes: coordinar tareas solicitadas mediante hermes-dev; comprobar los resultados de las delegaciones. No sincroniza automáticamente conversaciones ni conecta todas las cuentas.
- Codex: revisión independiente o implementación de una tarea delimitada; evitar dos agentes editando la misma copia a la vez.
- OpenCode: probar un modelo alternativo cuando haya una tarea que lo justifique.
- Playwright: comprobar el recorrido acordado una vez que exista la aplicación, incluida vista móvil.
- LazyGit y gh: revisar diferencias, guardar cambios y gestionar GitHub.
- Notion: tareas y acuerdos del equipo mediante Claude; documentos oficiales del cerebro en Git, evitando duplicaciones sin responsable.
- Higgsfield: recursos visuales si el producto los necesita; no es requisito del MVP.
- VS Code: leer, editar y ejecutar el proyecto en WSL.

## Publicar estos archivos
```bash
git status
git add conocimientos/INDICE.md GUIA-DE-TRABAJO.md diagramas/
git diff --cached --stat
git commit -m "Agregar índice, guía y mapa inicial del cerebro"
git push
```
Los archivos generados son una propuesta local. No se han publicado automáticamente.
