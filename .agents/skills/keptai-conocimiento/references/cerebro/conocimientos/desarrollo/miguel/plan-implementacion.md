> Dirección vigente D-007 (10/10/2026): leer Actores/flujos/DER v1.4, BD/revision-sql-rls.md y Backend/docs/alineacion-bd-n8n.md. IA en n8n transitoria; solo vouchers persistentes y datos estructurados, sin historial/audio. MIG-03 incorpora contexto de usuario/servicio y RLS V4/V5; MIG-05 es ingesta n8n. Referencias antiguas a cliente Gemini/guardar chats quedan reemplazadas.

# Plan de implementación — Miguel y Claude Code

> ID: MIG-PLAN-001. Fecha: 10 de octubre de 2026. Fuente: USR-DEV-MIGUEL-001/002 y roadmap sección Miguel. Estado: plan listo, código aún no iniciado. Responsable humano Miguel; Claude coordinador de implementación. No modifica propiedad DB/motor de Andrés.

> Actualización (10/10/2026): `BD/` ya contiene el esquema de Andrés (V1-V3, no desplegado) y `Middleware/n8n/` los workflows de WhatsApp (D-005, no ejecutados). Antes de cerrar MIG-02 el contrato debe alinearse con ellos; ver [revisión MIG-REV-001](revision-integracion-andres.md). El bloqueo "DB/motor no entregados" aplica ahora solo al motor financiero y a la semilla.

## Entregables de Miguel
D-009 incorpora [seis condiciones de cierre](../../../../BD/validaciones-pre-supabase.md) al plan. MIG-03/04 cubren acceso y Storage; MIG-05/06, idempotencia y auditoría; MIG-07, motor, integridad, concurrencia y aceptación financiera; MIG-08 integra las seis con evidencia por entorno. V6 conserva las 25 tablas vigentes; no declarar una etapa integrada completa usando mocks. Los estados históricos se consultan en estado.md.


Backend Spring reproducible, contrato y DTOs para frontend, autenticación/permisos, evidencias privadas, extracción multimodal, revisión auditada, API de pedido persistente, endpoints/adapters del motor de Andrés, consultas/reportes/estado de cuenta y configuración/test/despliegue. Se construye en Backend/ del repo actual. BD/ guarda el diseño de Andrés; migraciones Flyway dentro del servicio y un solo dueño.

## Etapas que Miguel solicita mediante prompts

### Etapa A — MIG-00: preflight

Claude delega un Explore/read-only para localizar fuentes/archivos y dependencias; verifica entorno y Git él mismo o con otro análisis solo lectura. Sin escritores de código. Entrega hallazgos y bloqueos, registra estado/AGENTS. No instalar ni cambiar herramientas globales sin tratar el entorno real; las capturas no prueban Java/daemon/accesos. Si hay bloqueo, resolver con Miguel y registrar el comando/resultado antes de A completada.

### Etapa B — MIG-01/02: base y contrato

MIG-01 se implementa primero. Delegación: un general-purpose constructor posee scaffold/config/test de arranque; el coordinador conserva README/pom/estado como propietario acordado, sin editar al mismo tiempo los mismos archivos. Acordar propiedad antes de tocar archivos compartidos. Después MIG-02: un encargo de contrato/DTOs y uno de revisión read-only de consistencia monetaria/errores/roles. Contrato aceptado con Andrés, ejemplos etiquetados para Germán. Gate: arranque y verify reales, contrato versionado y baseline estable.

### Etapa C — MIG-03/04: acceso y evidencia

Secuencia: seguridad real primero, luego evidencia. Puede delegar revisión read-only de seguridad durante la implementación, sin dar dos escritores al mismo módulo. Validar JWT/membresía y acceso cruzado; luego carga privada y registro de evidencia. Gate: usuario indebido rechazado y evidencia de otra organización inaccesible. Sin Storage/Auth reales, pruebas aisladas útiles pero gate de integración pendiente.

### Etapa D — MIG-05/06: extracción y revisión

Primero client Gemini + DTO/borrador; después revisión/pedido real. Constructor IA trabaja solo captura; constructor revisión inicia después de contratos/DB acordados. QA read-only recoge casos negativos; las correcciones se asignan al dueño. Gate: chat/imagen/audio reales, error recuperable, corrección auditada y pedido persistente. No usar extracción como verificación de fondos ni cantidad de confianza inventada.

### Etapa E — MIG-07: integrar el motor de Andrés

Depende de motor entregado. Un implementador de adapters/controllers y un revisor de fronteras. No encargar a un subagente reconstruir conciliación/caja si falta el trabajo de Andrés. Gate: API invoca motor real, partial/retry/rollback y saldo/margen esperados. Si falta dependencia, registrar bloqueo y completar solamente contrato/adapter testeable sin declararlo implementado real.

### Etapa F — MIG-08: validar y entregar

Un encargo de QA con PostgreSQL real y recorrido conjunto; otro read-only revisa config/secrets/operación. Un responsable ejecuta suite integrada una vez por versión y repite solo tras cambios/fallos. Coordinador resuelve hallazgos, registra evidencia y handoff. Despliegue depende de cuentas autorizadas; no contratar como parte implícita. Gate: criterios MIG-GENERAL, URL real cuando exista, documentación de lo implementado y limitaciones pendientes visibles.

## Contrato de delegación

Cada subagente recibe ID/sub-ID, objetivo concreto, raíz del repo, 2–4 fuentes, archivos que puede editar, archivos fuera de alcance, contratos/dependencias, casos de aceptación y comando de verificación. Devuelve resumen breve, archivos/diff, prueba real y pendientes. No hereda automáticamente skill/conversación: incluir esas rutas explícitas incluso a Explore/Plan. Usar subagente con capacidad de editar para código; Explore/Plan solo investigación. No crear configuraciones/agentes personalizados por anticipación.

Límite operativo propuesto: como máximo dos encargos útiles a la vez y un escritor por archivo. Paralelo solo para código de módulos independientes con contratos estables o revisión solo lectura; dependencies se resuelven secuencialmente. No instanciar agentes recursivos ni aplicar todas las skills. Subagentes consumen el mismo límite de uso: delegar no crea tokens extra. Si no están disponibles, el coordinador ejecuta secuencialmente y lo informa.

Solo coordinador actualiza AGENTS/estado y hace integración. Ningún subagente commit/push, borra trabajo, cambia branch ni toca código del compañero sin coordinación. Revisores no corregirán archivos mientras el constructor trabaja; devolverán observaciones para su dueño.

## Documentación por etapa y checkpoint

AGENTS.md: resumen breve de último ID completado, siguiente ID, bloqueos y enlace a bitácora. Estado.md: evidencia detallada y sección por tarea (comando/resultado, archivos, decisiones, fixture o real, próximo paso). Tareas.md: plan/criterios; estado efectivo se consulta en bitácora para evitar estados contradictorios. No llenar AGENTS de logs, tokens, datos reales o historias largas.

Antes de que se agote uso/contexto: esperar/cerrar encargos activos, registrar archivos y pruebas, diff no publicado, errores abiertos y siguiente tarea exacta. No inventar cuántos tokens quedan. El usuario consulta uso en su CLI/cuenta; compaction reduce contexto, no repone cuota de uso. No abrir más encargos para agotar tokens deliberadamente.

Si termina el principal: OpenCode puede QA/refinamientos concretos. Si se agota Claude antes: traspaso explícito a OpenCode para siguiente tarea pendiente, con los mismos permisos/fronteras y estado incompleto. El agente nuevo no asume que un scaffold equivale a backend terminado. Guía y prompts en [guia-trabajo.md](guia-trabajo.md).

Fuentes oficiales de delegación: [subagentes Claude](https://code.claude.com/docs/en/sub-agents); guía consultada 10/10/2026. Para esquema y negocio: [MIG-GENERAL](tarea-general.md), [tareas](tareas.md), [estado](estado.md).

## Continuación vigente tras integración (11/10/2026)
Los estados iniciales anteriores son históricos. La integración de seguridad/API de Miguel y motores/V8/V9 de Andrés está validada en215bcad y se incorpora a main. Consultar plan-continuacion-backend-integrado.md (MIG-INTEGRADO-001) para secuencia vigente y estado.md para evidencias. Próxima entrega AUTH-FE-01/04 + MIG-03-E real; después D3, MIG-04..08. La IA/extracción es n8n transitoria según D-007, sin cliente Gemini en Spring ni persistencia de mensajes.
