# Prompt para Claude — diagramas del roadmap KeptAI

Copiar el bloque siguiente en Claude Code abierto en la raíz local del repo KeptAI. En la máquina del autor, la ruta Ubuntu es `/home/miguel/dev/hackaton/conocimiento`; cada compañero debe usar su propio checkout. Este prompt solicita diagramas, no implementación ni pitch.

```text
Trabaja en este repo de conocimiento KeptAI. Usa la skill keptai-conocimiento.
Si no aparece en tu selector, lee directamente
.agents/skills/keptai-conocimiento/SKILL.md y las referencias pertinentes.

Lee primero:
- AGENTS.md, si existe en esta copia.
- conocimientos/INDICE.md.
- conocimientos/empresa/idea-negocio-replanteada.md.
- conocimientos/decisiones/decisiones-del-proyecto.md, especialmente D-003.
- conocimientos/fuentes/contexto-equipo-hackathon-2026.md, especialmente
  USR-EQUIPO-002, que sustituye los roles sugeridos del adjunto.
- conocimientos/decisiones/roadmap-hackathon-equipo.md completo.
- conocimientos/decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md,
  especialmente C-01 a C-07.

Objetivo: generar tres diagramas NUEVOS, editables y legibles en Excalidraw,
basados en el roadmap. Solo crea documentación y diagramas; no programes
la aplicación, no crees otro repo y no prepares pitch, slides ni exposición.

Distribución vigente obligatoria:
- Miguel: backend, codificación de captura con IA, borradores y endpoints.
- Andrés: backend, persistencia, motor de pagos, cálculos y resolución de problemas.
- Isabella: frontend, experiencia y definición funcional de reglas de negocio.
- Germán: frontend técnico, contratos, integración y despliegue de la web.
Isabella no construye backend ni se convierte en PM de tiempo completo.
Las reglas que define se validan en servidor por Miguel y Andrés.
Germán no toma propiedad del motor financiero. No uses los roles antiguos.

Diagrama 1: ROADMAP POR PERSONA Y BLOQUE.
Archivo diagramas/keptai-roadmap-equipo.excalidraw.
Usa cuatro carriles, uno por persona, y columnas B0 a B8 conforme al documento.
Incluye horarios de sábado 10 a domingo 11, zona America/Lima, referencia
15:30–09:30, y tareas resumidas que conserven propietario y entregable.
Muestra H1 18:00, H2 20:00, H3 22:00, H4 01:00, H5 03:00 freeze,
H6 07:00 y H7 objetivo 09:00. Distingue el cambio de día.
Representa descanso de Isabella/Germán 01:00–03:00 y de Miguel/Andrés
03:00–05:00, con nota de relevo y ajuste por estado real del equipo.
No presentes estos horarios como confirmación oficial de entrega.

Diagrama 2: DEPENDENCIAS Y CRITERIOS DE SALIDA.
Archivo diagramas/keptai-roadmap-dependencias.excalidraw.
Representa reglas funcionales -> contrato y esquema -> captura revisada ->
obligación/pago -> aplicación transaccional -> saldo/alertas -> margen/caja ->
frontend conectado -> QA -> versión técnica de entrega.
Identifica personas responsables y dónde frontend avanza en paralelo usando
ejemplos del contrato etiquetados como tales. Resalta costos y vencimientos
como dependencias tempranas. Añade hitos con criterios verificables y una
rama de contingencia: carga manual/CSV si no existe conector; edición manual
si IA falla, etiquetada como limitación que no cumple captura con IA.
Stock, cotizaciones y recompra solo como segunda fase, fuera del camino crítico.

Diagrama 3: ARQUITECTURA Y RECORRIDO DE LA DEMOSTRACIÓN.
Archivo diagramas/keptai-roadmap-arquitectura.excalidraw.
Muestra las tres pantallas: captura/revisión; pedido/pagos/cobranza;
resultado/caja. Distingue responsabilidades frontend y backend.
Conecta chat, imagen y audio -> evidencia -> extracción -> borrador ->
revisión humana -> conciliación -> verificación de fondos -> aplicación.
El voucher recibido no reduce saldo. Duplicado, huérfano y diferencia son
ramas de excepción. Pago aplicado actualiza saldo, alertas, caja y reporte.
Los costos alimentan margen; cobros y egresos alimentan caja a cuatro semanas.
Muestra centro productivo y eliminación de cargos internos al consolidar.
Representa React/TypeScript + Supabase/PostgreSQL + Edge Functions como
STACK PROPUESTO, sujeto a decisión, y claves IA solamente del lado servidor.
Kommo, ERP y WhatsApp vivo son conectores pendientes: líneas discontinuas,
sin afirmar que están integrados. Diferencia organización, entidad y marca.

Fuentes y restricciones:
- La idea USR-IDEA-001 y D-003 tienen precedencia sobre diagramas antiguos.
- El 80% y el significado del 30% no están verificados; no uses 30% de castigo.
- Los datos P-001, P-002 y vouchers del roadmap son ficticios.
- No elimines margen ni centro productivo para recuperar el MVP antiguo.
- No marques tareas como hechas por aparecer en el plan.

Ejecución:
1. Revisa git status y conserva todo el trabajo existente.
2. Comprueba si tienes un MCP Excalidraw disponible y úsalo cuando permita
   crear, organizar y exportar diagramas. No asumas que tienes conectores
   o credenciales por estar en el repo.
3. Conserva los mapas anteriores y cualquier lienzo existente. Usa archivos
   nuevos; si un nombre ya existe, lee su contenido antes de actualizarlo.
4. Si no hay MCP, crea archivos JSON .excalidraw válidos con elementos editables,
   posiciones, conexiones y agrupaciones coherentes. No sustituyas el entregable
   por Mermaid o por una imagen plana. No afirmes que lo abriste en Excalidraw
   si no puedes comprobarlo.
5. Exporta un PNG con el mismo nombre de cada diagrama si hay capacidad real
   de exportación. Si no, entrega los editables y explica esa limitación.
6. Verifica referencias de elementos, conexiones, textos sin solapamientos,
   contraste y legibilidad; revisa visualmente los PNG cuando estén disponibles.
7. Crea diagramas/keptai-roadmap-fuentes.md con fuentes, leyenda, supuestos,
   estado de propuesta y limitaciones de exportación o verificación.
8. Regenera la copia portable de la skill con
   python3 .agents/skills/keptai-conocimiento/scripts/sincronizar.py --repo .
   y verifica con el mismo script usando --check. Si hay copias sin fuente,
   consérvalas y reporta la diferencia antes de retirarlas.
9. Entrega enlaces a los tres editables, PNG disponibles y documento de fuentes.
   No hagas commit ni push: la publicación queda fuera de esta solicitud.

Diseño visual: fondos claros, carriles y grupos bien separados, colores escasos
y consistentes por tipo de elemento, leyenda explícita, textos breves y flechas
que no crucen cajas. Diferencia tarea, dependencia, hito, descanso, propuesta
y pendiente con formas/etiquetas además del color. Cada diagrama debe poder
entenderse solo, con título, fecha, zona horaria y fuente principal.
```
