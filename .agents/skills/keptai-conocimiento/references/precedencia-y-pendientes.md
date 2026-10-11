> Actualización vigente 10/10/2026: D-007 y Actores/flujos/DER v1.4 prohíben guardar mensajes. Consultar [revisión SQL](BD/revision-sql-rls.md), V4/V5, [alineación API](Backend/docs/alineacion-bd-n8n.md) y contrato. MIG-02 está alineado con cuatro roles, credencial n8n y campos SQL; las menciones anteriores de ocho roles/BD ausente son antecedentes. El remoto Supabase y MIG-03 siguen sin acreditar.

# Precedencia y pendientes que cambian decisiones

## Prioridad vigente

La [idea de negocio](cerebro/conocimientos/empresa/idea-negocio-replanteada.md) y [D-003](cerebro/conocimientos/decisiones/decisiones-del-proyecto.md) definen el alcance actual. La ficha del [Reto 6](cerebro/conocimientos/decisiones/reto-6-corpotex-conciliacion-y-rentabilidad.md) aporta contexto y criterios de evaluación independientes. No convertir dirección del equipo en una aprobación empresarial que no consta.

Los documentos antiguos conservan valor como evidencia del proceso y propuestas de diseño. Cuando una nueva instrucción del usuario cambie el producto, registrar su precedencia; esta lista no congela el proyecto.

## Diferencias encontradas en la revisión

1. **Primera fase:** D-001, P-007 y los anexos 4 y 10 del diseño priorizaban stock y postergaban rentabilidad. D-003 los actualiza: captura, conciliación, cobranza y visibilidad financiera primero; stock, cotizaciones y recompra después. Los diagramas son antecedentes del alcance anterior.
2. **30%:** el flujo y rediseño usan expresiones de pérdida, morosidad e incobrabilidad. A02-Q11 solo registra una estimación de cuentas abiertas sin denominador ni período. USR-IDEA-001 aclara que su significado está pendiente. No aplicar automáticamente un 30% de castigo ni anunciar 30% de pérdida.
3. **80%:** aparece en textos del equipo; A02-Q10 contiene reconocimiento discrepante y no lo confirma. Se necesita cálculo y período.
4. **Crédito:** la idea menciona 15 y 30 días; A02-Q32 y el rediseño mencionan 30 y 45. La dirección de autorización cuando ya hay saldo es vigente, pero quién aprueba, límites, excepciones y evento que inicia el plazo siguen pendientes. Los bloqueos absolutos, pagarés y cadencias de -3/0/+3 días del rediseño siguen siendo propuestas.
5. **Registro de pagos:** la ficha menciona dos personas registrando pagos y los textos posteriores hablan de dependencia de una persona. Confirmar el reparto de responsabilidades. La entrevista acredita una declaración de módulo de cuentas por cobrar desactualizado; no afirmar que técnicamente no existe ninguno.
6. **Ventas:** el escenario del usuario habla de tres vendedores y A02-Q15 recoge tres presenciales y una online mediante una reformulación. No fijar licencias ni permisos por ese número sin confirmación.
7. **Sistemas:** la idea nombra Kommo y ERP; las entrevistas conservan nombres posibles. La ficha añade Apps Script. Confirmar si son sistemas separados, su autoridad y sus accesos antes de prometer sincronización automática.
8. **Marcas y entidades:** la ficha describe Corpotex, Unicrack Sport y Unicrack Uniformes y habla también de empresas por RUC. No suponer que una marca es una persona jurídica. La consolidación debe respetar entidades y evitar duplicar cargos internos.
9. **Márgenes:** el catálogo compara productos terminados y confección; la ficha compara deportivos y profesionales. No son categorías equivalentes. El rediseño usa un indicador de margen sobre recaudación: definirlo por separado del costo y margen del pedido y del flujo de caja.
10. **Negocio comercial:** suscripción e incorporación del planteamiento inicial son antecedentes. La hipótesis vigente es mensualidad más porcentaje recuperado, sin tarifa ni contrato validados. Corpotex sigue siendo piloto previsto, no caso de éxito demostrado.

## Actualización D-005/D-006 y trabajo de Andrés (10/10/2026)

11. **Numeración:** D-005 = WhatsApp con Evolution API y n8n (Isabel); D-006 = preparación y delegación de Miguel (antes rotulada D-005 en documentos de desarrollo). No confundirlas.
12. **WhatsApp y IA:** D-005 prevalece sobre "solo entrada manual" de D-004 en la entrada de datos y sobre el cliente Gemini directo previsto en MIG-05 (n8n invoca un LLM compatible OpenAI y Spring valida). Spring sigue siendo único dueño de reglas, fechas, saldos y conciliación. Entrevistas A02-Q29 (sin canal único obligatorio) y A01-Q05 no respaldan WhatsApp como obligatorio.
13. **Crédito:** plazo 15 a 30 días por orden (Isabel) frente a 30 y 45 de A02-Q32; una sola obligación sin cuotas (coincide con A02-Q32); vence = despacho + plazo; el vendedor aprueba según historial; la mora avisa y no bloquea. El README de n8n aún dice "30/45" y "regla dura" contra mora: prevalece D-005 hasta que el equipo diga otra cosa. Ninguna entrevista respalda 15 días, la aprobación por el vendedor ni el aviso por mora: son dirección del equipo.
14. **BD:** el esquema de `BD/` (español, `obligacion_cobro`, roles `VENDEDOR/ADMIN/GERENTE/JEFE_TALLER`, vistas de saldo/mora/margen) es propuesta de Andrés versionada, no ejecutada en Supabase. Prevalece sobre nombres en inglés de PROP-DB-001 una vez Andrés y Miguel lo confirmen; el contrato MIG-02 (inglés, centavos, ocho roles) debe alinearse y no está cerrado.
15. **Identidad:** Isabel (D-005, DER) e Isabella (roles de frontend) aparecen en documentos distintos; no hay confirmación de que sean la misma persona.
16. **Autenticación:** panel con JWT de Supabase; n8n con `X-Api-Key` y WF3 con `X-Api-Secret` (README de n8n). El segundo canal no está en el contrato ni en MIG-03.
17. **Antecedentes sin banner D-005:** `objetivos.md`, `atencion-cliente.md`, `ventas.md` y los diagramas Excalidraw describen CRM/bot/Kommo o arquitecturas anteriores; leerlos como antecedentes.

## Datos que faltan para demostrar el núcleo

- Identificadores de clientes, pedidos, marcas, líneas, entidades y documentos por cobrar.
- Vouchers y pagos con monto, moneda, fecha, referencia y verificación; reglas de correspondencia y aplicación parcial.
- Acuerdos de crédito, vencimientos, saldo inicial y responsables de aprobación y cobranza.
- Consumos, mano de obra, terceros y asignación de indirectos para calcular costos y margen.
- Precios de transferencia y reglas de consolidación del centro productivo.
- Apertura de caja, cobros esperados, egresos y supuestos por semana para las 4 semanas.
- Formatos de exportación de Excel/CSV y responsables de validación.

Estas dependencias proceden de las fuentes y sus observaciones; no son datos ya recibidos. Para una demo, pueden usarse muestras ficticias expresamente identificadas. Para afirmar impacto real, se requieren registros y una línea base validada.

## Actualización técnica vigente — D-004

USR-EQUIPO-003 confirma experiencia Spring, elige Spring Boot y excluye datos ERP/CRM del MVP. Prevalece sobre FastAPI/Edge Functions anteriores. Andrés define DB, Miguel revisa/API; Germán adopta PROP-FRONT-001 coordinado con Isabella. Prompt original USR-DESIGN-001 es fuente histórica; usar adaptación sin 30% de castigo empresarial ni acceso público sin token. Entrada manual/CSV y semilla ficticia no son integración externa.

## Trazabilidad de tablas (DB-MAP-001)

D-008 posterior: 25 tablas aprobadas y V6 local. [Guia](BD/local/README.md); retirar opcionales solo si vacias, sin remoto automatico.

[Mapeo canonico](cerebro/conocimientos/decisiones/trazabilidad-tablas-mvp.md): necesidad, evidencia y prioridad de las 27 tablas; 2 opcionales, brechas C-05/C-06. Prima sobre interpretar un inventario/DER como requisito de la empresa. No cambia SQL ni decisiones comerciales.


D-009 / USR-DB-VALIDACION-001: seis condiciones de cierre adoptadas por Miguel; [DB-VAL-001](BD/validaciones-pre-supabase.md) prevalece para evaluar integridad, idempotencia, aislamiento, reversión, concurrencia y aceptación. Son requisitos, no pruebas nuevas.
