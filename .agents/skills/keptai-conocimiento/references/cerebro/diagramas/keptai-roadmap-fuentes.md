# Diagramas del roadmap KeptAI — fuentes, leyenda y supuestos

Estado: propuesta para revisión, 10 de octubre de 2026 (zona America/Lima). No acreditan software implementado, tareas realizadas ni horarios oficiales de entrega. No incluyen pitch ni slides.

## Archivos

| Diagrama | Editable | Vista |
|---|---|---|
| 1. Roadmap por persona, horarios, hitos y descansos | keptai-roadmap-equipo.excalidraw | keptai-roadmap-equipo.png |
| 2. Dependencias y criterios de salida | keptai-roadmap-dependencias.excalidraw | keptai-roadmap-dependencias.png |
| 3. Arquitectura y recorrido a cuatro semanas | keptai-roadmap-arquitectura.excalidraw | keptai-roadmap-arquitectura.png |

Los diagramas anteriores (keptai-mapa-inicial, keptai-flujo-completo) no se modificaron. Los PNG son vistas de revisión; el archivo editable es el .excalidraw.

## Fuentes

- conocimientos/decisiones/roadmap-hackathon-equipo.md (PROP-ROADMAP-001 v1.0): §2 roles, §3 pantallas y stack, §4 bloques B0–B8 e hitos H1–H7, §5 camino crítico, §6 datos ficticios, §7 QA-01 a QA-13 y C-01 a C-07, §8 recortes y contingencias.
- conocimientos/fuentes/contexto-equipo-hackathon-2026.md, USR-EQUIPO-002: Miguel y Andrés backend; Germán e Isabella frontend; Isabella define reglas funcionales que el backend valida.
- conocimientos/decisiones/decisiones-del-proyecto.md, D-003, y conocimientos/empresa/idea-negocio-replanteada.md, USR-IDEA-001: núcleo de captura, conciliación, cobranza y visibilidad financiera; stock, cotizaciones y recompra en segunda fase.
- conocimientos/decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md, C-01 a C-07.
- Solicitud: conocimientos/decisiones/prompt-claude-diagramas-roadmap.md.

## Leyenda común

- Azul: tarea o componente de frontend. Morado: backend. Cian: datos o carga. Amarillo: hito. Verde: criterio de salida. Rojo discontinuo: excepción, contingencia o limitación. Gris discontinuo: descanso o pendiente. Gris punteado: segunda fase.
- Diagrama 1: las columnas B0–B8 no están a escala horaria; el cambio de día se marca con un banner (B4 cruza la medianoche).
- Diagramas 2 y 3: flecha gruesa = camino crítico; discontinua = excepción, alterno o conector pendiente; punteada azul = frontend con ejemplos del contrato; naranja = dependencia temprana o llamadas desde la fachada.

## Supuestos y limitaciones

- Horarios, bloques, tareas, QA y datos (P-001, P-002, V-001 a V-003, cargo interno S/320, PEN) son propuesta o ficticios. La ventana 15:30–09:30 presupone empezar el sábado ~15:30 y debe confirmarse con la organización.
- React/TypeScript + Supabase/PostgreSQL + Edge Functions es un stack propuesto, sujeto a una prueba de acceso y despliegue. El proveedor de IA sigue sin definir; la verificación de fondos es simulada.
- Kommo, ERP/facturación y WhatsApp vivo son conectores pendientes (discontinuos); la demostración usa evidencias y archivos cargados. No se afirma integración.
- El 80 % a crédito y el significado del 30 % no están verificados y no se usan en los diagramas.
- Descansos: Isabella y Germán 01:00–03:00; Miguel y Andrés 03:00–05:00, con nota de relevo de 10 min; se pueden invertir según el estado real.
- Cuando falla la IA, la edición manual es una limitación que no cumple captura con IA (C-03/C-04).

## Exportación y verificación

- Los .excalidraw se generaron como JSON editable (texto ligado a sus contenedores, flechas ligadas a elementos) con un script temporal, no versionado. Se importaron en el MCP Excalidraw local y los PNG se exportaron con su renderizador headless (fuentes del sistema; puede variar entre máquinas).
- Verificado: sin solapes entre cajas ni flechas que crucen cajas ajenas (comprobación geométrica) y revisión visual de los tres PNG. No se abrieron en la interfaz web de Excalidraw.
