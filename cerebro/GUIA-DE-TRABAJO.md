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


## Agentes conectados al cerebro (configurado el 10 de octubre de 2026)

Desde una terminal Ubuntu dentro de WezTerm/Herdr:
```bash
~/.local/bin/keptai check
~/.local/bin/keptai claude
```
Si `keptai` está disponible en tu PATH, basta con `keptai claude`. El lanzador entra a la carpeta KeptAI y envía una tarea inicial de lectura de instrucciones, índice y decisiones. En una terminal separada puedes usar `keptai codex`, `keptai hermes` o `keptai opencode`. No lanzar todos para la misma tarea ni permitir ediciones simultáneas de los mismos archivos.

WezTerm continúa abriendo tu sesión Herdr dev. Los paneles antiguos conservan su directorio: el lanzador cambia al cerebro antes de iniciar el agente. No inicia otro Herdr ni modifica sesiones existentes. Claude y Hermes conservan sus MCP ya configurados; no se copian credenciales. No se ha agregado Excalidraw o Notion a Codex/OpenCode mediante este cambio.

AGENTS.md contiene las instrucciones portables; CLAUDE.md importa esas instrucciones. Hermes reconoce AGENTS.md según el CLI instalado. El mensaje inicial explícito también pide consultarlo a los cuatro agentes. Estas instrucciones orientan su conducta; verificar las referencias en las respuestas sigue siendo parte de la revisión.

### Primera tarea
Después de la respuesta inicial, pide: «Usando las fuentes del cerebro, revisa el mapa de Excalidraw y propón el primer recorrido demostrable del MVP. Identifica actores, estados, datos mínimos y criterios de aceptación. Marca las decisiones pendientes. Todavía no programes».

### Equipo
Cada integrante clona KeptAI en su máquina. Puede iniciar su agente desde la raíz del repo o ejecutar `bash scripts/keptai claude`. El lanzador global `~/.local/bin/keptai` es específico de esta máquina; las credenciales, skills y MCP deben configurarse individualmente. No están compartidos por Git.

### Compartir la configuración
```bash
git add AGENTS.md CLAUDE.md scripts/keptai GUIA-DE-TRABAJO.md
git commit -m "Conectar agentes al cerebro KeptAI"
git push
```
Esta configuración no actualiza Git ni inicia tareas de programación sin una instrucción.
