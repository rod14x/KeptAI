package pe.keptai.backend.security;

import static pe.keptai.backend.security.AccessRole.ADMIN;
import static pe.keptai.backend.security.AccessRole.DISENO;
import static pe.keptai.backend.security.AccessRole.GERENTE;
import static pe.keptai.backend.security.AccessRole.INGESTA;
import static pe.keptai.backend.security.AccessRole.JEFE_TALLER;
import static pe.keptai.backend.security.AccessRole.VENDEDOR;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpMethod;

/**
 * Autorización por método HTTP y ruta exacta (MIG-03-D2): una regla por cada operación entrante de
 * {@code openapi.yaml}. Abrir una ruta es solo el permiso de rol o alcance; <b>no implementa la funcionalidad</b>
 * (sin controlador responde 404). Toda ruta, método o variante no listada queda denegada por defecto.
 * Los roles del panel proceden de la membresía en PostgreSQL; los alcances de servicio, de la fila de
 * {@code integracion_servicio}. Las reglas cerradas conservan el motivo hasta que se decida la regla pendiente.
 * Una prueba compara esta tabla con el contrato y la matriz de acceso.
 */
public final class AccessPolicy {

	public enum Kind {
		/** JWT de Supabase + membresía única (KeptaiAuthentication). */
		PANEL,
		/** X-Api-Key de n8n (ServiceAuthentication). */
		SERVICE
	}

	/**
	 * @param closedReason {@code null} = abierta para {@code actors}; texto = cerrada (nadie accede) y por qué
	 */
	public record Rule(String operationId, HttpMethod method, String path, Kind kind, Set<AccessRole> actors, String closedReason) {

		public boolean open() {
			return closedReason == null;
		}

	}

	private static final String D007 = "Fuera del MVP (D-007): no se persiste captura de texto ni extracción; no implementar";

	private static final String SEGREGACION = "Segregación registrar/verificar/aplicar pago sin decidir (matriz 5.5) y motor financiero de Andrés pendiente";

	private static final String CONFIRMAR = "Confirmación por vendedorJid sin acuerdo (matriz 5.3, MIG-06): un servicio no firma como vendedor";

	private static final String CALLBACK = "Alcance SCHEDULER del callback WF3 solo propuesto (matriz 5.4); credencial separada pendiente (D3)";

	public static final List<Rule> RULES = List.of(
		panel("getMyContext", HttpMethod.GET, "/api/v1/me", VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO),
		closedPanel("createTextEvidence", HttpMethod.POST, "/api/v1/evidences/text", D007),
		panel("uploadEvidenceFile", HttpMethod.POST, "/api/v1/evidences/files", ADMIN),
		panel("listEvidences", HttpMethod.GET, "/api/v1/evidences", ADMIN),
		panel("getEvidence", HttpMethod.GET, "/api/v1/evidences/{evidence_id}", ADMIN),
		panel("getEvidenceDownloadLink", HttpMethod.GET, "/api/v1/evidences/{evidence_id}/download-link", ADMIN),
		closedPanel("startExtraction", HttpMethod.POST, "/api/v1/evidences/{evidence_id}/extractions", D007),
		closedPanel("getExtractionJob", HttpMethod.GET, "/api/v1/extraction-jobs/{job_id}", D007),
		panel("listDrafts", HttpMethod.GET, "/api/v1/drafts", ADMIN),
		panel("getDraft", HttpMethod.GET, "/api/v1/drafts/{draft_id}", ADMIN),
		panel("correctDraft", HttpMethod.PATCH, "/api/v1/drafts/{draft_id}", ADMIN),
		panel("confirmDraft", HttpMethod.POST, "/api/v1/drafts/{draft_id}/confirmation", ADMIN),
		panel("discardDraft", HttpMethod.POST, "/api/v1/drafts/{draft_id}/discard", ADMIN),
		// B-05: Órdenes de producción sin precios exclusivas para taller (rutas específicas antes de {order_id})
		panel("listProductionOrders", HttpMethod.GET, "/api/v1/orders/production", JEFE_TALLER, ADMIN, GERENTE, DISENO),
		panel("getProductionOrder", HttpMethod.GET, "/api/v1/orders/{order_id}/production", JEFE_TALLER, ADMIN, GERENTE, DISENO),
		// Fase 3 (B-08 e Inventario de Tela): Semáforo y asignación de partidas
		panel("getFabricSemaphore", HttpMethod.GET, "/api/v1/orders/{order_id}/fabric-semaphore", ADMIN, JEFE_TALLER, VENDEDOR, GERENTE),
		panel("getOrderFabricLots", HttpMethod.GET, "/api/v1/orders/{order_id}/fabric-lots", ADMIN, JEFE_TALLER, GERENTE),
		panel("assignFabricLot", HttpMethod.POST, "/api/v1/orders/{order_id}/fabric-lots", ADMIN, JEFE_TALLER),
		// B-06 y B-03: Artes de personalización y nómina de personal
		panel("approveArt", HttpMethod.POST, "/api/v1/orders/{order_id}/arts/{art_id}/approval", DISENO, ADMIN, VENDEDOR),
		panel("listArts", HttpMethod.GET, "/api/v1/orders/{order_id}/arts", DISENO, VENDEDOR, ADMIN, JEFE_TALLER, GERENTE),
		panel("createArt", HttpMethod.POST, "/api/v1/orders/{order_id}/arts", DISENO, ADMIN),
		panel("importPersonnel", HttpMethod.POST, "/api/v1/orders/{order_id}/personnel", VENDEDOR, ADMIN),
		panel("listOrders", HttpMethod.GET, "/api/v1/orders", VENDEDOR, ADMIN, GERENTE),
		panel("getOrder", HttpMethod.GET, "/api/v1/orders/{order_id}", VENDEDOR, ADMIN, GERENTE),
		panel("createOrder", HttpMethod.POST, "/api/v1/orders", VENDEDOR, ADMIN),
		panel("listCustomers", HttpMethod.GET, "/api/v1/customers", VENDEDOR, ADMIN, GERENTE),
		panel("getCustomer", HttpMethod.GET, "/api/v1/customers/{customer_id}", VENDEDOR, ADMIN, GERENTE),
		panel("createCustomer", HttpMethod.POST, "/api/v1/customers", VENDEDOR, ADMIN),
		panel("updateCustomer", HttpMethod.PUT, "/api/v1/customers/{customer_id}", VENDEDOR, ADMIN),
		panel("reassignCustomerPortfolio", HttpMethod.POST, "/api/v1/customers/{customer_id}/reassign-portfolio", ADMIN),
		panel("mergeCustomers", HttpMethod.POST, "/api/v1/customers/{customer_id}/merge", ADMIN),
		panel("getCustomerHistory", HttpMethod.GET, "/api/v1/customers/{customer_id}/history", VENDEDOR, ADMIN, GERENTE),
		panel("createCustomerContact", HttpMethod.POST, "/api/v1/customers/{customer_id}/contacts", VENDEDOR, ADMIN),
		panel("getOrderTechSheet", HttpMethod.GET, "/api/v1/orders/{order_id}/tech-sheet", VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO),
		panel("updateOrderTechSheet", HttpMethod.PUT, "/api/v1/orders/{order_id}/tech-sheet", VENDEDOR, ADMIN),
		panel("validateFabric", HttpMethod.POST, "/api/v1/orders/{order_id}/tech-sheet/validate-fabric", ADMIN, JEFE_TALLER),
		panel("advanceStation", HttpMethod.POST, "/api/v1/orders/{order_id}/station-advance", ADMIN, JEFE_TALLER),
		panel("getOrderStages", HttpMethod.GET, "/api/v1/orders/{order_id}/stages", VENDEDOR, ADMIN, GERENTE, JEFE_TALLER, DISENO),
		// Fase 3: Inventario de Rollos de Tela e Insumos
		panel("listFabricRolls", HttpMethod.GET, "/api/v1/fabric/rolls", ADMIN, JEFE_TALLER, GERENTE),
		panel("createFabricRoll", HttpMethod.POST, "/api/v1/fabric/rolls", ADMIN, JEFE_TALLER),
		panel("listSupplies", HttpMethod.GET, "/api/v1/supplies", ADMIN, JEFE_TALLER, GERENTE),
		panel("createSupply", HttpMethod.POST, "/api/v1/supplies", ADMIN),
		// Fase 3 (B-10): Requisiciones de Compra de Tela
		panel("listRequisitions", HttpMethod.GET, "/api/v1/fabric/requisitions", ADMIN, JEFE_TALLER, GERENTE),
		panel("createRequisition", HttpMethod.POST, "/api/v1/fabric/requisitions", ADMIN, JEFE_TALLER),
		panel("approveRequisition", HttpMethod.POST, "/api/v1/fabric/requisitions/{requisition_id}/approve", ADMIN),
		panel("receiveRequisition", HttpMethod.POST, "/api/v1/fabric/requisitions/{requisition_id}/receive", ADMIN, JEFE_TALLER),
		// Defecto 1: Inventario textil y matriz de stock por talla
		panel("listProducts", HttpMethod.GET, "/api/v1/inventory/products", ADMIN, VENDEDOR, GERENTE, JEFE_TALLER),
		panel("createProduct", HttpMethod.POST, "/api/v1/inventory/products", ADMIN),
		panel("registerStockMatrix", HttpMethod.POST, "/api/v1/inventory/products/{productId}/stock-matrix", ADMIN),
		panel("listProductMovements", HttpMethod.GET, "/api/v1/inventory/products/{productId}/movements", ADMIN, GERENTE),
		panel("listPayments", HttpMethod.GET, "/api/v1/payments", ADMIN, GERENTE),
		panel("getPayment", HttpMethod.GET, "/api/v1/payments/{payment_id}", ADMIN, GERENTE),
		panel("getReconciliationCandidates", HttpMethod.GET, "/api/v1/payments/{payment_id}/reconciliation", ADMIN),
		panel("registerPaymentVerification", HttpMethod.POST, "/api/v1/payments/{payment_id}/verifications", ADMIN),
		panel("applyPayment", HttpMethod.POST, "/api/v1/payments/{payment_id}/applications", ADMIN),
		panel("listReceivables", HttpMethod.GET, "/api/v1/receivables", VENDEDOR, ADMIN, GERENTE),
		panel("getReceivable", HttpMethod.GET, "/api/v1/receivables/{receivable_id}", VENDEDOR, ADMIN, GERENTE),
		panel("listCollectionAlerts", HttpMethod.GET, "/api/v1/collection-alerts", VENDEDOR, ADMIN),
		panel("getCustomerStatement", HttpMethod.GET, "/api/v1/customers/{customer_id}/statement", VENDEDOR, ADMIN, GERENTE),
		panel("getResultsSummary", HttpMethod.GET, "/api/v1/results/summary", GERENTE),
		panel("getMarginReport", HttpMethod.GET, "/api/v1/results/margins", GERENTE),
		panel("getProductionCenterResults", HttpMethod.GET, "/api/v1/results/production-center", GERENTE),
		panel("getCashForecast", HttpMethod.GET, "/api/v1/results/cash-forecast", GERENTE),
		panel("exportOrdersCsv", HttpMethod.GET, "/api/v1/reports/orders.csv", GERENTE),
		panel("listAuditEvents", HttpMethod.GET, "/api/v1/audit-events", ADMIN, GERENTE),
		panel("getCreditDecision", HttpMethod.GET, "/api/v1/orders/{order_id}/credit-decision", VENDEDOR, ADMIN, GERENTE),
		panel("submitCreditDecision", HttpMethod.POST, "/api/v1/orders/{order_id}/credit-decision", ADMIN),
		panel("registerDispatch", HttpMethod.POST, "/api/v1/orders/{order_id}/dispatch", ADMIN, JEFE_TALLER),
		// INT-FE-API-002: cierre manual de alertas, duplicado (MotorPagos) y bitácora de envíos (solo metadatos, D-007).
		panel("resolveCollectionAlert", HttpMethod.POST, "/api/v1/collection-alerts/{alert_id}/resolution", ADMIN),
		panel("markPaymentDuplicate", HttpMethod.POST, "/api/v1/payments/{payment_id}/duplicate", ADMIN),
		panel("listNotifications", HttpMethod.GET, "/api/v1/notifications", VENDEDOR, ADMIN, GERENTE),
		service("n8nIngestOrder", HttpMethod.POST, "/api/v1/ordenes/ingesta", INGESTA),
		closed("n8nConfirmOrder", HttpMethod.POST, "/api/v1/ordenes/confirmar", Kind.SERVICE, CONFIRMAR),
		service("n8nReceiveVoucher", HttpMethod.POST, "/api/v1/pagos/voucher", INGESTA),
		closed("n8nReportMessageStatus", HttpMethod.POST, "/api/v1/mensajes/{id}/estado", Kind.SERVICE, CALLBACK));

	private AccessPolicy() {
	}

	private static Rule panel(String operationId, HttpMethod method, String path, AccessRole first, AccessRole... rest) {
		return new Rule(operationId, method, path, Kind.PANEL, EnumSet.of(first, rest), null);
	}

	private static Rule service(String operationId, HttpMethod method, String path, AccessRole role) {
		return new Rule(operationId, method, path, Kind.SERVICE, EnumSet.of(role), null);
	}

	private static Rule closed(String operationId, HttpMethod method, String path, Kind kind, String reason) {
		return new Rule(operationId, method, path, kind, Set.of(), reason);
	}

	private static Rule closedPanel(String operationId, HttpMethod method, String path, String reason) {
		return closed(operationId, method, path, Kind.PANEL, reason);
	}
}
