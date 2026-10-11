# Diagramas KeptAI con Spring Boot (v1.3) — fuentes, leyenda y supuestos

Estado: propuesta para revisión, 10 de octubre de 2026 (zona America/Lima). Los diagramas no acreditan software implementado, cuentas contratadas, tareas realizadas ni horarios oficiales de entrega. No incluyen pitch ni slides.

## Archivos

| Diagrama | Editable | Vista |
|---|---|---|
| 1. Roadmap por integrante | keptai-roadmap-equipo-spring-v1-3.excalidraw | keptai-roadmap-equipo-spring-v1-3.png |
| 2. Dependencias e hitos | keptai-roadmap-dependencias-spring-v1-3.excalidraw | keptai-roadmap-dependencias-spring-v1-3.png |
| 3. Arquitectura y recorrido de demostración | keptai-roadmap-arquitectura-spring-v1-3.excalidraw | keptai-roadmap-arquitectura-spring-v1-3.png |
| 4. Modelo de base de datos y responsabilidad | keptai-base-datos-spring-v1-3.excalidraw | keptai-base-datos-spring-v1-3.png |

## Fuentes y versiones

- conocimientos/decisiones/roadmap-hackathon-equipo.md, PROP-ROADMAP-001 v1.3: §1 resultado y entradas, §2 roles, §3 pantallas e infraestructura, §4 bloques B0–B8 e hitos H1–H7, §5 camino crítico, §6 datos ficticios, §7 QA-01 a QA-13 y C-01 a C-07, §8 recortes.
- conocimientos/decisiones/infraestructura-desarrollo-mvp.md, PROP-INFRA-001 v1.2: Cloudflare Workers Static Assets, Spring Boot/Java 21 en Render (Docker), Supabase (PostgreSQL, Auth, Storage), Gemini, Render Cron Job, GitHub Actions, JWT, RLS.
- conocimientos/decisiones/modelo-base-datos-mvp.md, PROP-DB-001 v1.0: tablas, relaciones, invariantes, transacción de pago, semilla.
- conocimientos/decisiones/roadmap-german-frontend.md, PROP-FRONT-001 (prompt Design adaptado): trabajo de Germán por bloque.
- conocimientos/decisiones/decisiones-del-proyecto.md, D-003 y D-004; conocimientos/fuentes/contexto-equipo-hackathon-2026.md, USR-EQUIPO-002/003.
- conocimientos/decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md, C-01 a C-07.
- Solicitud: conocimientos/decisiones/prompt-claude-diagramas-roadmap.md (v3). El prompt original en conocimientos/fuentes/prompt-claude-design-recibido.md se trató como antecedente.

## Cambios frente al histórico

- Los diagramas anteriores (keptai-roadmap-equipo, -dependencias y -arquitectura, sin sufijo) quedan como antecedente: usan Supabase Edge Functions y no fijan la base de datos. No se modificaron ni se sobrescribieron.
- Backend único Spring Boot/Java; sin FastAPI, Edge Functions ni backend Python.
- Sin ERP/CRM: no hay importación, API, acceso ni sincronización; las entradas son manuales (chat, vouchers, nota de voz, registros/CSV y semilla ficticia).
- ER, diccionario y contrato API pasan a entregables de B0/B1; Andrés es dueño de la base y Miguel revisa.
- Germán sigue PROP-FRONT-001; Isabella define interfaz y reglas funcionales que implementa el backend.
- Se añade el diagrama 4 (base de datos).

## Leyenda

- Azul: frontend. Morado: backend Spring. Cian: datos o carga. Amarillo: hito. Verde: criterio de salida o costos y caja. Rojo discontinuo: excepción o contingencia. Gris discontinuo: descanso, soporte o pendiente. Punteado: alcance, nota o segunda fase.
- Diagrama 1: borde grueso = entregable temprano (ER, contrato); las columnas no están a escala horaria; B4 cruza la medianoche.
- Diagramas 2 y 3: flecha gruesa = camino crítico; discontinua = alterno o soporte; punteada azul = fixtures; naranja = entradas tempranas o llamadas desde la API.
- Diagrama 4: cada cuadro es una tabla propuesta; cardinalidades y campos son los de PROP-DB-001, no un diccionario cerrado.

## Supuestos y limitaciones

- Horarios, bloques, tareas, QA y datos (P-001, P-002, V-001 a V-003, cargo interno S/320, PEN) son propuesta o ficticios. La ventana 15:30–09:30 es referencia recalculable.
- Cloudflare, Render, Supabase, Gemini y GitHub Actions son una recomendación pendiente de una prueba de acceso y despliegue. La verificación de fondos es simulada.
- El 80 % a crédito y el significado del 30 % no están verificados y no se usan; factor_mora es un escenario editable que parte de 0 %.
- Estado de cuenta compartido: token temporal y revocable limitado a un cliente; si falta, vista autenticada con brecha explícita.
- Si falla Gemini, la edición manual es una limitación que no cumple C-03/C-04.
- Descansos: Isabella y Germán 01:00–03:00; Miguel y Andrés 03:00–05:00, con relevo de 10 min; invertibles según el estado real.
- Campos y relaciones no definidos en PROP-DB-001 (por ejemplo, vínculos entre entidad y marca) no se dibujaron; el ER definitivo lo entrega Andrés.

## Exportación y verificación

- Los .excalidraw se generaron como JSON editable (textos ligados a contenedores, flechas ligadas a elementos) con un script temporal no versionado. Se importaron en el MCP Excalidraw local y los PNG se exportaron con su renderizador headless; usa fuentes del sistema y puede variar entre máquinas.
- Verificado: sin solapes entre cajas ni flechas que crucen cajas ajenas (comprobación geométrica) y revisión visual de los PNG de arquitectura y base de datos. No se abrieron en la interfaz web de Excalidraw.
