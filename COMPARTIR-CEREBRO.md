# Compartir el cerebro KeptAI con el equipo

## Qué se entrega y dónde

Skill: **keptai-conocimiento**, en [.agents/skills/keptai-conocimiento/SKILL.md](.agents/skills/keptai-conocimiento/SKILL.md), dentro del mismo repo [rod14x/KeptAI](https://github.com/rod14x/KeptAI).

Incluye los 18 Markdown de negocio y planificación completos, sus anexos con los 43 registros de entrevista, los diagramas editables disponibles y sus PNG, y el README de diagramas. La entrada explica cómo consultar las fuentes, respetar la idea vigente y tratar las contradicciones. El [mapa de fuentes](.agents/skills/keptai-conocimiento/references/mapa-fuentes.md) documenta cobertura y exclusiones; el manifiesto registra hashes.

La documentación oficial de OpenAI indica que Codex descubre skills compartidas en `.agents/skills` del repo y permite invocarlas con `$nombre`. Por eso el equipo puede usar esta entrega directamente desde su checkout. [Guía oficial de skills](https://learn.chatgpt.com/docs/build-skills).

## Para quienes ya tienen vinculado el repo

1. Abrir una terminal en **su copia local de KeptAI** y ejecutar:

```bash
git status
git pull --ff-only
```

Si Git informa cambios en conflicto o divergencia, conservar el trabajo local y resolver la actualización; no forzar un reset.

2. Abrir esa carpeta como proyecto en Codex. La skill se descubre desde `.agents/skills/keptai-conocimiento/`. Si no aparece, reiniciar Codex, como indica la documentación oficial.
3. Enviar una tarea como:

```text
Usa $keptai-conocimiento. Define el alcance de la demo de 3 minutos,
con fuentes, datos necesarios y decisiones pendientes.
```

Tener conectado el remoto no actualiza automáticamente los archivos locales. Cada integrante debe hacer pull para recibir esta versión y las siguientes. La ruta WSL del autor no se comparte: cada persona usa su propio checkout.

## Usarla en otro proyecto, incluido el repo de la aplicación

La carpeta de la skill es autocontenida: `references/cerebro/` lleva las fuentes completas y conserva enlaces relativos. Desde la raíz de KeptAI puede copiarse a la ubicación personal de Codex.

En Ubuntu, WSL o macOS:

```bash
mkdir -p "$HOME/.agents/skills/keptai-conocimiento"
cp -R .agents/skills/keptai-conocimiento/. "$HOME/.agents/skills/keptai-conocimiento/"
```

En Windows, PowerShell:

```powershell
$keptaiSkillTarget = Join-Path $HOME '.agents/skills/keptai-conocimiento'
New-Item -ItemType Directory -Force -Path $keptaiSkillTarget | Out-Null
Get-ChildItem -Force -LiteralPath '.agents/skills/keptai-conocimiento' |
    Copy-Item -Destination $keptaiSkillTarget -Recurse -Force
```

La ruta personal corresponde al entorno donde corre el agente: Windows y WSL tienen directorios de usuario diferentes. Esta copia es una versión instalada; no recibe los cambios de Git por sí sola. Después de actualizar KeptAI, repetir la copia y verificar. Usar la copia del repo evita ese paso cuando la tarea se hace dentro del cerebro. Si una copia anterior contiene archivos retirados, revisar la diferencia antes de quitarlos; el verificador detecta archivos sobrantes.

También se puede copiar la carpeta a `.agents/skills/keptai-conocimiento/` del repo de la aplicación para distribuirla con ese proyecto. Este trabajo no modifica ni publica otro repositorio.

## Si un compañero usa otro agente

La entrada es un archivo estándar `SKILL.md` con referencias relativas. No todos los agentes descubren automáticamente `.agents/skills`. Se puede usar de inmediato con una instrucción explícita:

```text
Lee .agents/skills/keptai-conocimiento/SKILL.md y sus fuentes pertinentes.
Usa ese conocimiento para esta tarea y cita los documentos consultados.
```

Si está trabajando fuera de KeptAI, indicar la ruta local real del archivo o copiar la carpeta completa al proyecto. No copiar solamente `SKILL.md`: faltaría la información. La instalación nativa de cada agente se configura individualmente; esta entrega no supone compatibilidad automática de sus selectores, MCP o cuentas.

## Mantener una sola fuente de información

Los originales editables siguen en `conocimientos/` y `diagramas/`. Las referencias de la skill son copias generadas para hacerla portátil; no editarlas a mano.

Con Python 3.9 o posterior, desde la raíz del cerebro:

```bash
python3 .agents/skills/keptai-conocimiento/scripts/sincronizar.py --repo . --preserve-historical-diagrams
python3 .agents/skills/keptai-conocimiento/scripts/sincronizar.py --check
```

En Windows se puede usar `python` en lugar de `python3`. El script no instala paquetes, no llama a la red y no escribe en Git. Registra archivos, hashes y cambios de las fuentes presentes al generar. Una copia instalada se puede verificar sin el repo: en ese caso comprueba integridad local, no frescura frente a GitHub.

Publicar los documentos actualizados y la carpeta de skill en el mismo commit. Revisar y añadir únicamente los archivos de esa tarea, y después hacer commit y push. El equipo recibe esa versión con pull y, si eligió instalación personal, repite la copia. Las fuentes nuevas dentro de `conocimientos/` se incorporan completas al regenerar; actualizar la guía de fuentes si cambia el alcance.

## Límites de esta entrega

Todo el conocimiento de negocio existente en esta ruta fue revisado y empaquetado. No están aquí los audios originales, la imagen original, el PDF ni documentos del análisis de ese PDF; sus rutas mencionadas son procedencia, no archivos accesibles para el equipo. No se incluyen credenciales ni se conectan sistemas de la empresa.

La idea USR-IDEA-001 y D-003 definen la primera fase: captura, conciliación, cobranza y rentabilidad/caja a 4 semanas. Los diagramas anteriores permanecen como antecedentes; la skill señala sus diferencias. El 80% a crédito y el significado del 30% siguen pendientes de verificación.
