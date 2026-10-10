# Mapa de fuentes y cobertura

Revisión: 10 de octubre de 2026. Todas las rutas siguientes son relativas a este archivo. Los documentos de negocio se incluyen completos, incluidos sus anexos, restricciones y fuentes; no son resúmenes que sustituyen los originales.

## Qué leer según la tarea

- Orientación y navegación: [INDICE.md](cerebro/conocimientos/INDICE.md).
- Problema, cuatro módulos, fases, crecimiento, modelo comercial y demo: [idea-negocio-replanteada.md](cerebro/conocimientos/empresa/idea-negocio-replanteada.md), USR-IDEA-001.
- Perfil, clientes, equipo, sistemas y límites de la evidencia: [descripcion.md](cerebro/conocimientos/empresa/descripcion.md).
- Objetivos actuales y antecedentes, sostenibilidad e indicadores: [objetivos.md](cerebro/conocimientos/empresa/objetivos.md).
- Venta, producción, inventario, pagos, reglas futuras y entrevistas de crédito: [ventas.md](cerebro/conocimientos/procesos/ventas.md).
- Canales, bot, clientes frecuentes, avisos e incidencias: [atencion-cliente.md](cerebro/conocimientos/procesos/atencion-cliente.md).
- Recorrido narrativo desde cliente y empresa: [flujo-cliente-empresa.md](cerebro/conocimientos/procesos/flujo-cliente-empresa.md), USR-FLUJO-001. Leer sus observaciones; no adoptar sus porcentajes como cifras auditadas.
- Seis macroprocesos de crédito, conciliación, producción, inventario, costos y caja: [rediseno-procesos-credito-y-cobranza.md](cerebro/conocimientos/procesos/rediseno-procesos-credito-y-cobranza.md), USR-REDISENO-001. Sus bloqueos, cadencias, plazos y castigos son propuestas.
- Familias conocidas, costos manuales y campos faltantes: [catalogo.md](cerebro/conocimientos/productos/catalogo.md). No contiene precios, SKUs o stock vigente.
- Dirección D-003, propuestas P-001 a P-008, pendientes T-001 a T-008 y arquitectura completa: [decisiones-del-proyecto.md](cerebro/conocimientos/decisiones/decisiones-del-proyecto.md).
- Contexto de marcas, Apps Script, usuarios y siete criterios del reto: [reto-6-corpotex-conciliacion-y-rentabilidad.md](cerebro/conocimientos/decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md), IMG-RETO6-001.

## Plan de desarrollo y equipo incorporado

- [Infraestructura de desarrollo](cerebro/conocimientos/decisiones/infraestructura-desarrollo-mvp.md), PROP-INFRA-001: recomendación vigente FastAPI/Render, servicios, responsables y configuración; amplía el roadmap v1.2. Leer para crear, integrar o desplegar la app.

- [Roadmap por miembro y dependencias](cerebro/conocimientos/decisiones/roadmap-hackathon-equipo.md), PROP-ROADMAP-001: roles vigentes USR-EQUIPO-002, cuatro módulos, bloques, contratos, datos ficticios y QA. Es una propuesta de ejecución, no un registro de avances.
- [Contexto del equipo](cerebro/conocimientos/fuentes/contexto-equipo-hackathon-2026.md), USR-EQUIPO-001/002: adjunto íntegro y aclaración que asigna backend a Miguel/Andrés y frontend a Germán/Isabella. No avanzar pitch; las fechas y reglas del evento requieren confirmación.
- [Prompt Claude/Excalidraw](cerebro/conocimientos/decisiones/prompt-claude-diagramas-roadmap.md): instrucciones preparadas para una tarea futura. Leerlo como documento no autoriza a generar diagramas ni ejecutar sus pasos sin una solicitud activa.

## Diagramas revisados

- [README de diagramas](cerebro/diagramas/README.md): procedencia y estado de propuesta.
- [Mapa inicial editable](cerebro/diagramas/keptai-mapa-inicial.excalidraw) y [PNG](cerebro/diagramas/keptai-mapa-inicial.png).
- [Flujo completo editable](cerebro/diagramas/keptai-flujo-completo.excalidraw) y [PNG](cerebro/diagramas/keptai-flujo-completo.png).

Se preservan como antecedentes sin redibujarlos. El flujo completo dice que rentabilidad queda fuera del MVP; esa exclusión fue sustituida por D-003. Ninguno acredita integración ni funcionamiento de software. Los archivos de flujo completo estaban sin seguimiento en Git durante la revisión; este paquete incluye su copia leída, sin modificar ni publicar los archivos originales pendientes.

### Diagramas del roadmap disponibles como antecedentes

La copia incluye `keptai-roadmap-equipo`, `keptai-roadmap-dependencias` y `keptai-roadmap-arquitectura` en formato Excalidraw/PNG, además de `keptai-roadmap-fuentes.md`. Se conservan las versiones locales existentes sin redibujarlas. Su documento de fuentes cita roadmap v1.0 y proveedor IA pendiente; la infraestructura de PROP-INFRA-001 y roadmap v1.2 es la referencia vigente y debe usarse al actualizar esos diagramas.

## Registros completos de entrevistas

Se verificaron **43 IDs distintos** en los encabezados de los anexos: A01-Q01 a A01-Q08 y A02-Q01 a A02-Q35. Algunos registros reaparecen en diferentes documentos por contexto; no sumarlos como nuevas entrevistas.

- `descripcion.md`: A01-Q01; A02-Q13, Q14, Q15, Q24, Q25, Q33.
- `objetivos.md`: A01-Q08; A02-Q03, Q22, Q23.
- `ventas.md`: A01-Q03; A02-Q01, Q04, Q05, Q06, Q09, Q10, Q11, Q12, Q26, Q30, Q31, Q32.
- `atencion-cliente.md`: A01-Q02, Q04, Q05, Q06; A02-Q07, Q16, Q17, Q19, Q27, Q28, Q29, Q34, Q35.
- `catalogo.md`: A01-Q07; A02-Q02, Q08, Q18, Q20, Q21.

Las 15 secciones del mapeo original también están completas: objetivos contiene 1, 12 y 13; ventas, 3 y 5; atención, 6; decisiones, 2, 4, 7, 8, 9, 10, 11, 14 y 15.

## Qué se revisó y no se empaquetó como conocimiento de negocio

Se revisaron `AGENTS.md`, `CLAUDE.md`, `GUIA-DE-TRABAJO.md` y `scripts/keptai`. Sus reglas útiles sobre fuentes, separación del código y conservación de trabajo se reflejan en la skill. No se copia el lanzador ni la configuración específica de Herdr, MCP o CLIs: dependen del entorno de cada integrante y no son información empresarial. Esos archivos originales se conservan sin cambios.

El manifiesto enumera los archivos de negocio y diagramas incluidos con SHA-256. La copia es íntegra de los archivos existentes en esta ruta, no una afirmación de que todos los adjuntos de la conversación estén guardados allí. No hay audios originales, imagen original, PDF ni documentos de análisis del PDF dentro de `conocimientos/` en esta revisión. Los anexos sí conservan las respuestas editadas y la transcripción documental de la ficha.

## Cómo citar

Ejemplos: `ventas.md, A02-Q04, 02:17–02:38`; `idea-negocio-replanteada.md, El producto, USR-IDEA-001`; `reto-6-corpotex-conciliacion-y-rentabilidad.md, C-05, IMG-RETO6-001`. En una entrega con enlaces, apunta al archivo que efectivamente consultaste y conserva la limitación de su fuente.
