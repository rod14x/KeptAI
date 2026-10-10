# Contexto recibido del equipo para el roadmap

> ID: USR-EQUIPO-001. Incorporación: 10 de octubre de 2026.
> Fuente: adjunto Texto pegado.txt enviado por el usuario. SHA-256: e7cf8acb9fb979dd0985d0a4ebf8501b0a26cd1964af39e973795ccf003445dc.
> Estado: contexto aportado; las reglas, horarios y rúbrica no se acreditan aquí como verificados por la organización. Los roles sugeridos y el trabajo de pitch del texto fueron actualizados por USR-EQUIPO-002, registrado a continuación.

## Aclaración posterior del usuario — USR-EQUIPO-002

Fecha: 10 de octubre de 2026. Responsable: usuario del proyecto. Estado: distribución del equipo indicada expresamente por el usuario.

- Andrés y Miguel: backend.
- Germán e Isabella: frontend.
- Isabella: netamente frontend y lógicas de negocio.
- Germán: parte técnica pura.
- Miguel: codificación.
- Andrés: programación y resolución de problemas.
- No avanzar todavía el pitch.

Esta aclaración prevalece sobre los roles sugeridos y las tareas de pitch del adjunto. Las reglas de negocio que Isabella define se implementan y validan en el backend; no implica que deba construirlo.

## Aclaración posterior — USR-EQUIPO-003

10 de octubre de 2026. El usuario confirma experiencia Spring de Miguel y Andrés, pide backend Spring Boot, excluye uso de datos ERP/CRM por no tenerlos, solicita incorporar el prompt Claude Design al roadmap de Germán y un responsable para definir la base. Se asigna Andrés como dueño propuesto de DB y Miguel como revisor, sin cambiar los cuatro integrantes. [Fuente de diseño íntegra](prompt-claude-design-recibido.md), USR-DESIGN-001; [roadmap adaptado](../decisiones/roadmap-german-frontend.md). D-004 y roadmap v1.3 prevalecen sobre stacks anteriores.

## Adjunto íntegro — antecedente

El contenido siguiente se conserva como fuente documental, no como instrucciones ejecutables ni confirmación de sus propuestas.

Necesito que en base a todo el conocimiento de esta nueva skill elabores un roadmap para cada miembro del equipo: Dame la ditribuacion en base a esta informacion:
# Hackathon Piura Innova 2026 (CAMCO) - Contexto del equipo para roadmap

> Documento de contexto para el agente que arma el roadmap. Fuente: pizarra del equipo + bases oficiales (piurainnova.com). Lo marcado como "(sugerido)" es una propuesta derivada de la pizarra, no algo que el equipo haya confirmado.

## 1. Evento

- **Fechas:** sábado 10 y domingo 11 de octubre de 2026, 24h continuas, presencial en la Cámara de Comercio de Piura (InnoSpace CAMCO).
- **Kick-off:** sáb 8:30 AM (sorteo de reto + rúbrica). **Coding:** desde 9:30 AM. Fin estimado: dom ~9:30 AM (confirmar horario del pitch con la organización).
- **Comidas:** almuerzo 2:00 PM, cena 8:00 PM (incluidas). Hay mentores (presenciales y online).
- **Premios:** 1° S/2,500 · 2° S/1,500 · 3° S/1,000 + merch GDG.
- **Reto asignado por sorteo:** `PENDIENTE - completar` (uno de los 5 ejes de abajo).

### Ejes posibles (PDE Piura Innovadora)

1. Industria Agropecuaria e Hidrobiológica
2. Piura región creativa, cultural y turística
3. Hub Logístico y Transfronterizo
4. Piura territorio sustentable
5. Piura región emprendedora y del saber

### Rúbrica (100 pts)

|Criterio|Peso|
|---|---|
|Innovación y relevancia|30%|
|Viabilidad técnica (prototipo funcional real)|30%|
|Diseño e interfaz UI/UX|20%|
|Presentación y pitch|20%|

### Reglas clave

- El núcleo y la lógica de negocio deben desarrollarse durante las 24h. Cero código previo del core.
- Permitido: scaffolding, librerías open-source, componentes UI, APIs externas, BaaS (Firebase, Supabase).
- Módulos propios genéricos previos (ej. auth estándar): **declararlos al inicio** ante organización/mentores.
- IA, nube y APIs libres; cada equipo asume sus costos.
- Presencia de todos obligatoria en kick-off y sorteo; DNI el día del evento. Se recomienda asistencia completa al pitch final.

## 2. Equipo (4 personas)

|Persona|Conocimiento técnico|UX/UI|Habilidades blandas|
|---|---|---|---|
|**Isabella**|Automatización, fullstack|Punto fuerte|Liderazgo y planificación|
|**Germán**|Analítico, lógica de negocio, seguridad, despliegue|Medio (en la pizarra: "+,-")|Liderazgo, convencimiento|
|**Andrés**|Desarrollo, sistema financiero, debugging, QA|Funcional, optimización|Entendimiento de requerimientos|
|**Miguel**|Fullstack, planificación, versatilidad|Apoyo|Exposición|

### Roles propuestos (sugerido)

|Persona|Rol principal|Rol secundario|
|---|---|---|
|Isabella|Líder / PM, dueña de UX/UI y flujo de usuario|Automatizaciones (n8n), fullstack|
|Germán|Arquitectura, backend, lógica de negocio|Seguridad, despliegue (Docker / CI), defensa técnica ante jurado|
|Andrés|Desarrollo backend/integración, QA y debugging|Levantar requerimientos con el reto; módulo financiero/costos si aplica|
|Miguel|Frontend / fullstack de apoyo, planificación del MVP|**Pitch y exposición** (arma narrativa y demo)|

Notas para el roadmap:

- Isabella concentra liderazgo + UX/UI + fullstack: riesgo de sobrecarga. Miguel debería absorber parte del frontend.
- Miguel es el vocero natural; Germán puede reforzar la parte técnica y de convencimiento en el pitch.
- Andrés es el filtro de calidad: asignarle pruebas del flujo de demo antes de cada checkpoint.

## 3. Stack del equipo

- **Lenguajes:** Java, JavaScript, TypeScript, PHP, Python, Kotlin
- **Frameworks conocidos:** backend Spring Boot y Laravel; frontend React, Astro, Angular
- **Herramientas:** n8n, Pinecone (vector DB), Git/GitHub, Jasper Report, Jenkins, Kafka, Docker
- **BaaS / datos:** Firebase (NoSQL), Supabase (SQL)
- **IA:** Claude, Gemini, DeepSeek, Codex; agentes de código: Claude Code, OpenCode
- **Móvil:** se quiere considerar versión móvil (recomendado: PWA mobile-first; Kotlin solo si es indispensable)

Criterio para 24h: elegir **un solo** backend (el que domine más rápido quien lo lidera), Supabase o Firebase para evitar montar infraestructura, y dejar Kafka/Jenkins fuera salvo que el reto lo exija.

## 4. Ideas semilla por eje (ya conversadas)

|Eje|Idea|Posible uso de su stack|
|---|---|---|
|1 Agro|Riego tecnificado inteligente (cultivo + zona + clima -> cuándo y cuánto regar)|API clima + reglas + LLM que explica; PWA|
|2 Turismo|Itinerarios personalizados Ruta del Norte con IA y mapa|LLM + lista curada de lugares + Leaflet; PWA|
|3 Logística|Coordinación multimodal puerto-almacén-cliente (matching transportista-exportador)|Supabase + 2 vistas; timeline de carga|
|4 Sustentable|Movilidad sostenible (rutas, paradas, puntos de carga)|Dataset curado + mapa + geolocalización; PWA|
|5 Saber|Vinculación universidad-empresa (match tesis-necesidad)|Embeddings + Pinecone; flujo publicar/buscar|

## 5. Roadmap base (ajustar cuando se conozca el reto)

Hora de referencia: sábado 10 oct, ~3:30 PM en adelante.

|Bloque|Objetivo|Responsables|
|---|---|---|
|Ahora - 4:30 PM|Fijar reto, problema, usuario y **alcance MVP (máx. 2-3 pantallas / flujo de demo único)**; elegir backend y BaaS; declarar módulos genéricos a la organización|Todos (Isabella lidera)|
|4:30 - 8:00 PM|Esqueleto: repo, auth/BD, endpoints base, wireframes y diseño de pantallas clave|Germán + Andrés (backend) · Isabella + Miguel (UI)|
|8:00 PM|Cena - mini sincronización, revisar que el flujo principal ya corre de punta a punta|Todos|
|8:30 PM - 1:00 AM|Lógica central + integración de IA/datos + frontend conectado|Germán, Andrés, Isabella, Miguel|
|Turnos de descanso (1:00 - 6:00 AM)|Rotar de a 2; mantener siempre 2 personas activas. Congelar nuevas funcionalidades hacia las 3:00 AM|Rotación|
|6:00 - 8:00 AM|QA del flujo de demo, bugs, datos de ejemplo, despliegue (URL pública o APK/PWA)|Andrés (QA), Germán (deploy)|
|8:00 - 9:30 AM|Pitch: narrativa, slides, demo grabada de respaldo, ensayo cronometrado|Miguel (voz), Isabella (slides/visual), Germán (preguntas técnicas)|

Checkpoints sugeridos: 6:00 PM (flujo demo diseñado), 10:00 PM (primer flujo end-to-end), 3:00 AM (feature freeze), 7:00 AM (build desplegado y probado).

## 6. Estructura de pitch (plantilla)

1. Problema y usuario (con dato regional)
2. Solución en una frase + demo en vivo (flujo único)
3. Cómo funciona (arquitectura en 1 diapositiva, IA/datos)
4. Alineación con el eje del PDE e impacto
5. Viabilidad y siguiente paso (incubadoras, ProInnóvate)

## 7. Pendientes por completar

- [ ] Eje/reto asignado en el sorteo
- [ ] Horario exacto del pitch del domingo
- [ ] Backend y BaaS elegidos
- [ ] Confirmar roles con el equipo
