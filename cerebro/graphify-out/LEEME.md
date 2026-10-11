> Instantánea previa a D-007/V4–V5 y al contrato alineado. No usar aristas sobre mensajes como diseño vigente; consultar fuentes vivas y skill regenerada. Grafo pendiente de regeneración; no se cambiaron diagramas históricos.

# Grafo del cerebro (Graphify)

Generado el 10/10/2026 con graphifyy 0.9.85 en un entorno aislado fuera del repo (`~/.cache/keptai-graphify`). Contiene `graph.json`, `GRAPH_REPORT.md` y `graph.html` (abrir en el navegador, sin servidor).

- **Corpus:** 33 Markdown de `cerebro/` (conocimientos, guías y Markdown de `diagramas/`). No incluye PNG ni `.excalidraw` (sin cambios), `BD/`, `Middleware/`, `.agents/`, `.claude/` ni `.mcp.json`.
- **Extracción:** 3 subagentes de Claude (16 + 16 documentos, y un tercero que re-extrajo la revisión y MIG-SUPA-001 tras actualizarlos); sin AST. 540 nodos, 1041 aristas, 24 comunidades.
- **Cómo leerlo:** las aristas `EXTRACTED` repiten lo que dice una fuente; `INFERRED` y `AMBIGUOUS` son pistas de lectura y señales de contradicción, **no** aprobación ni decisión. Confirmar siempre en el documento original.
- **Vigencia:** refleja los documentos al 10/10/2026 (incluye `revision-integracion-andres.md`). Regenerar si cambian; no se actualiza solo.
- **Costo:** ver `cost.json` (el consumo se reporta solo como total de tokens de los subagentes; el desglose entrada/salida no está disponible).

La aclaración MCP de Miguel está representada en MIG-SUPA-001. La bitácora, índice y resumen de AGENTS se actualizaron después de la extracción: consultar las fuentes vivas para el estado operativo más reciente. El grafo no es un historial de despliegues comprobados.
