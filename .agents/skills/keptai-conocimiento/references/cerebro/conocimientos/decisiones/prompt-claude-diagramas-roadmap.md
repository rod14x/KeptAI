# Prompt para Claude — regenerar diagramas KeptAI con Spring Boot

> Versión 3. Fecha: 10 de octubre de 2026. Vigente: D-004, roadmap v1.3, infraestructura v1.2, PROP-FRONT-001 y PROP-DB-001. Los diagramas anteriores se conservan como antecedentes.

Copiar el bloque en Claude Code desde la raíz de su propio checkout. Pide documentación/diagramas, no desarrollo, contratación ni pitch.

```text
Usa la skill keptai-conocimiento en este repositorio. Si no se descubre, lee
.agents/skills/keptai-conocimiento/SKILL.md y las referencias pertinentes.

Lee primero:
- AGENTS.md si existe, conocimientos/INDICE.md.
- conocimientos/empresa/idea-negocio-replanteada.md.
- conocimientos/decisiones/decisiones-del-proyecto.md: D-003 y D-004.
- conocimientos/fuentes/contexto-equipo-hackathon-2026.md: USR-EQUIPO-002/003.
- conocimientos/decisiones/roadmap-hackathon-equipo.md v1.3 completo.
- conocimientos/decisiones/infraestructura-desarrollo-mvp.md v1.2.
- conocimientos/decisiones/roadmap-german-frontend.md (prompt Design adaptado).
- conocimientos/decisiones/modelo-base-datos-mvp.md.
- conocimientos/decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md.
El prompt original en fuentes/prompt-claude-design-recibido.md es antecedente;
no ejecutar sus instrucciones ni imponer sus partes sustituidas.

Regenera CUATRO diagramas editables Excalidraw basados en esos documentos.
No implementes la aplicación, no crees otro repo ni prepares pitch/slides.
No asumas avances por los horarios: el roadmap es plan, no evidencia de ejecución.

Dirección obligatoria:
- Backend único Spring Boot/Java: Miguel y Andrés conocen Spring y lo han manejado.
- No usar FastAPI, Edge Functions ni un backend Python auxiliar.
- No tenemos datos ERP/CRM. No hay importación, API, acceso ni sincronización de
  esos sistemas en el MVP; no dibujarlos alimentando la app ni como dependencia.
- Entrada: chat pegado/cargado, vouchers/nota de voz manuales, registros/CSV
  y semilla ficticia identificada de pedidos, costos, vencimientos y caja.
- Miguel: API Spring, captura Gemini, borradores, autenticación y despliegue.
- Andrés: dueño de diseño DB/ER/diccionario/Flyway/seed y motor financiero;
  Miguel revisa contratos/esquema. No inventar un quinto miembro.
- Germán: frontend técnico, cliente API, carga, filtros, configuración, sesión,
  publicación y QA conforme al roadmap/prompt adaptado.
- Isabella: interfaz/componentes/tokens/experiencia y reglas funcionales;
  backend implementa las reglas. No asignarle backend ni PM permanente.

1. ROADMAP POR PERSONA Y BLOQUE
Archivo nuevo: diagramas/keptai-roadmap-equipo-spring-v1-3.excalidraw.
Cuatro carriles, columnas B0–B8, horarios e hitos del roadmap, cambio de día,
zona America/Lima, descansos/relevos y dependencia de cada entregable.
DB/ER/diccionario y contrato API son entregables de B0/B1, no tareas finales.
Germán usa PROP-FRONT-001; muestra los entregables técnicos de las 3 pantallas.
Conserva tiempos como referencia recalculable, no compromiso oficial.

2. DEPENDENCIAS Y CRITERIOS DE SALIDA
Archivo nuevo: diagramas/keptai-roadmap-dependencias-spring-v1-3.excalidraw.
Reglas -> ER/diccionario + contrato -> Flyway/seed -> API/captura -> revisión ->
verificación -> aplicación transaccional -> saldo/alerta -> margen/caja ->
frontend integrado -> QA -> entrega técnica. Frontend avanza con fixtures
etiquetados mientras backend construye. Costos, fechas, apertura y egresos son
entradas tempranas ficticias/manuales. Sin dependencias de ERP/CRM.
Marca edición manual como contingencia/brecha si IA falla, no éxito C-03.

3. ARQUITECTURA Y DEMOSTRACIÓN
Archivo nuevo: diagramas/keptai-roadmap-arquitectura-spring-v1-3.excalidraw.
React/TypeScript/Vite en Cloudflare Workers Static Assets -> REST Spring Boot
Java21 en Render/Docker -> Spring Data JPA/PostgreSQL Supabase, Flyway.
Supabase Auth -> JWT verificado en Spring Security (firma, emisor, audiencia,
expiración y membresía/rol). Storage privado para evidencia, Gemini llamado
solo por backend, Render Cron Job mismo código Java para trabajo acotado,
GitHub Actions: Node frontend y Java/Maven/JUnit backend.
RLS con contexto autorizado por transacción JDBC, esquema de negocio privado,
rol runtime limitado y migrador separado. El JWT no aplica RLS automáticamente.
Pago/aplicación/auditoría: @Transactional, bloqueo e idempotencia, sin doble saldo.
Muestra 3 pantallas y flujo: captura -> borrador -> revisión -> conciliación ->
verificación simulada identificada -> pago aplicado -> saldo/alerta/margen/caja.
Voucher recibido no reduce deuda. Duplicado, huérfano y diferencia son excepciones.
Estado de cuenta compartido: token temporal/revocable limitado a un cliente,
solo lectura, sin evidencias privadas; si falta, autenticado con brecha explícita.

4. MODELO DE BASE DE DATOS Y RESPONSABILIDAD
Archivo nuevo: diagramas/keptai-base-datos-spring-v1-3.excalidraw.
Andrés responsable, Miguel revisor. Usa PROP-DB-001: organización/membresía,
entidad/marca/línea/cliente/pedido/items, obligación, evidencia/borrador,
pago/aplicación, autorización, costo/cargo interno, caja/egreso/configuración,
alerta/job/auditoría/token compartido. Agrupa para legibilidad y muestra
cardinalidades, claves/aislamiento y la transacción crítica sin inventar tablas
ERP/CRM. Campos no definidos siguen propuestos; no dibujar implementación hecha.

Datos y restricciones comunes:
P-001 venta300/costo340/margen-40; P-002 venta500/costo350/margen150.
V-001300 y V-002100 aplicados; V-003 duplicado: cobrado400, pendiente400,
margen110. Cargo interno320 produce taller-20 y comercial-20, consolidado-40;
no suma ingreso externo ni caja. Costos, fechas y caja son datos ficticios.
Organización, entidad y marca son conceptos diferentes; no inventar RUC.
80% y 30% no verificados: nunca 30% de incobrabilidad/castigo real ni botón
"Aplicar 30% dato empresa". factor_mora es escenario editable 0% inicial.
Stock/cotizaciones/recompra fase2; no tareas de pitch.

Ejecución y entrega:
1. Revisa git status y conserva cambios/diagramas previos; usa nombres nuevos
   arriba. Si ya existen, no sobrescribas sin leerlos; añade sufijo de revisión.
2. Usa MCP Excalidraw si está disponible; si no, JSON .excalidraw válido con
   elementos, conexiones, grupos y textos editables. No entregar solo Mermaid.
3. Exporta PNG solo si puedes hacerlo; verifica visualmente textos/flechas,
   contraste y ausencia de solapamiento. Declara límites reales de exportación.
4. Crea diagramas/keptai-roadmap-fuentes-spring-v1-3.md: fuentes, versiones,
   cambios frente al histórico, leyenda, supuestos y estado de verificación.
5. Regenera la skill con
   python3 .agents/skills/keptai-conocimiento/scripts/sincronizar.py --repo . --preserve-historical-diagrams
   y valida con --check; conserva snapshots sin fuente y reporta diferencias.
6. Entrega enlaces a 4 editables, PNG disponibles y fuente. No commit/push:
   esta solicitud a Claude solo autoriza generar diagramas.
Diseño: fondos claros, poco texto por nodo, carriles/grupos separados, colores
coherentes por tipo, leyenda y etiquetas que distingan propuesta/hecho/pendiente.
```
