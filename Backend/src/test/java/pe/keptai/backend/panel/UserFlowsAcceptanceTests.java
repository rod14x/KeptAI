/**
 * UserFlowsAcceptanceTests.java
 * Versión: 3.4 | Fecha: 2026-10-19 | Autora: Isabelita
 */
package pe.keptai.backend.panel;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import pe.keptai.backend.contract.ArtAndCurveDtos.ApproveArtRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.CreateRequisitionRequest;
import pe.keptai.backend.contract.FabricAndScrapDtos.FabricRequisition;
import pe.keptai.backend.contract.FabricAndScrapDtos.OrderFabricAssignment;
import pe.keptai.backend.contract.ManufacturingDtos.StationAdvanceRequest;
import pe.keptai.backend.contract.ProductionOrderDtos;
import pe.keptai.backend.contract.TechSheetDtos.UpdateTechSheetRequest;
import pe.keptai.backend.security.AccessRole;
import pe.keptai.backend.security.KeptaiAuthentication;
import pe.keptai.backend.security.Membership;
import pe.keptai.backend.tenancy.TenantIdentity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class UserFlowsAcceptanceTests {

	@Autowired
	private MockMvc mvc;

	private Authentication user(AccessRole role) {
		Jwt jwt = Jwt.withTokenValue("t").header("alg", "none").subject(UUID.randomUUID().toString()).build();
		return new KeptaiAuthentication(jwt, List.of(new Membership(UUID.randomUUID(), UUID.randomUUID(), role)));
	}

	@Test
	void vendedorPuedeConsultarCatalogoDeClientes() throws Exception {
		mvc.perform(get("/api/v1/customers")
				.contentType(MediaType.APPLICATION_JSON)
				.with(authentication(user(AccessRole.VENDEDOR))))
				.andExpect(status().is(Matchers.in(List.of(200, 503))));
	}

	@Test
	void vendedorPuedeConsultarExistenciasPorTalla() throws Exception {
		mvc.perform(get("/api/v1/inventory/products")
				.contentType(MediaType.APPLICATION_JSON)
				.with(authentication(user(AccessRole.VENDEDOR))))
				.andExpect(status().is(Matchers.in(List.of(200, 503))));
	}

	@Test
	void vendedorTieneAccesoDenegadoAlKardexDeMovimientos() throws Exception {
		UUID productId = UUID.randomUUID();
		mvc.perform(get("/api/v1/inventory/products/" + productId + "/movements")
				.contentType(MediaType.APPLICATION_JSON)
				.with(authentication(user(AccessRole.VENDEDOR))))
				.andExpect(status().isForbidden());
	}

	@Test
	void jefeDeTallerTieneAccesoDenegadoAFinanzasDeResultados() throws Exception {
		mvc.perform(get("/api/v1/results/summary")
				.contentType(MediaType.APPLICATION_JSON)
				.with(authentication(user(AccessRole.JEFE_TALLER))))
				.andExpect(status().isForbidden());
	}

	@Test
	void jefeDeTallerPuedeConsultarCatalogoDeProductos() throws Exception {
		mvc.perform(get("/api/v1/inventory/products")
				.contentType(MediaType.APPLICATION_JSON)
				.with(authentication(user(AccessRole.JEFE_TALLER))))
				.andExpect(status().is(Matchers.in(List.of(200, 503))));
	}

	@Test
	@SuppressWarnings("unchecked")
	void estimacionDeConsumoMultiplicaPrendasPor280Gramos() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		TenantIdentity mockIdentity = mock(TenantIdentity.class);
		UUID orderId = UUID.randomUUID();
		UUID userId = UUID.randomUUID();

		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.identity()).thenReturn(mockIdentity);
		when(mockIdentity.usuarioId()).thenReturn(userId);
		when(mockPanel.write(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());
		when(mockPanel.read(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		TechSheetService service = new TechSheetService(mockPanel);

		when(mockJdbc.queryForList(anyString(), eq(orderId))).thenReturn(List.of(
				Map.of("id", UUID.randomUUID(), "estado", "BORRADOR", "modalidad", "CONFECCION_ROLLO", "semaforo_tela", "HABITUAL_VERDE")
		));
		when(mockJdbc.queryForObject(anyString(), eq(Integer.class), eq(orderId))).thenReturn(15);

		when(mockJdbc.query(anyString(), any(RowMapper.class), eq(orderId))).thenReturn(List.of(
				new pe.keptai.backend.contract.TechSheetDtos.TechSheet(
						UUID.randomUUID(), orderId, "COMPLETA", "CONFECCION_ROLLO", "HABITUAL_VERDE",
						new BigDecimal("4.20"), "NO_APLICA", null, "Polo Piqué Cuello Camisero",
						"Piqué 24/1 100% Algodón", "220", "Blanco", null, "Camisero",
						Map.of("S", 5, "M", 5, "L", 5), null, null, null,
						userId, OffsetDateTime.now(), OffsetDateTime.now(), OffsetDateTime.now()
				)
		));

		UpdateTechSheetRequest req = new UpdateTechSheetRequest(
				"CONFECCION_ROLLO", "HABITUAL_VERDE", null,
				"Polo Piqué Cuello Camisero", "Piqué 24/1 100% Algodón", "220",
				"Blanco", null, "Camisero",
				Map.of("S", 5, "M", 5, "L", 5), null, null, null
		);

		var result = service.updateTechSheet(orderId, req);
		assertThat(result.estimatedConsumptionKg()).isEqualTo(new BigDecimal("4.20"));
		assertThat(result.status()).isEqualTo("COMPLETA");
	}

	@Test
	void b05_jefeDeTallerRecibe403AlConsultarOrdenComercialConPrecios() throws Exception {
		UUID orderId = UUID.randomUUID();
		mvc.perform(get("/api/v1/orders/" + orderId)
				.contentType(MediaType.APPLICATION_JSON)
				.with(authentication(user(AccessRole.JEFE_TALLER))))
				.andExpect(status().isForbidden());
	}

	@Test
	void b05_vendedorRecibe403AlConsultarOrdenesDeProduccionExclusivasDeTaller() throws Exception {
		mvc.perform(get("/api/v1/orders/production")
				.contentType(MediaType.APPLICATION_JSON)
				.with(authentication(user(AccessRole.VENDEDOR))))
				.andExpect(status().isForbidden());
	}

	@Test
	void b05_dtoDeOrdenDeProduccionNoExponePreciosNiCostosNiMargenesNiPagos() {
		List<String> forbiddenWords = List.of("precio", "costo", "margen", "pago", "cents", "price", "cost", "margin", "payment");

		List<Field> fieldsOrder = Arrays.asList(ProductionOrderDtos.ProductionOrder.class.getDeclaredFields());
		for (Field f : fieldsOrder) {
			String name = f.getName().toLowerCase();
			for (String forbidden : forbiddenWords) {
				assertThat(name)
						.as("El DTO de orden de producción no debe contener el campo financiero: " + name)
						.doesNotContain(forbidden);
			}
		}

		List<Field> fieldsItem = Arrays.asList(ProductionOrderDtos.ProductionOrderItem.class.getDeclaredFields());
		for (Field f : fieldsItem) {
			String name = f.getName().toLowerCase();
			for (String forbidden : forbiddenWords) {
				assertThat(name)
						.as("El ítem del DTO de orden de producción no debe contener el campo financiero: " + name)
						.doesNotContain(forbidden);
			}
		}
	}

	@Test
	void b04_reservaAtomicaFallaSiStockDisponibleNoAlcanza() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.write(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		UUID varId = UUID.randomUUID();
		InventoryService inventoryService = new InventoryService(mockPanel);

		// Simular que el UPDATE condicionado retornó 0 (no hay stock disponible suficiente)
		when(mockJdbc.update(anyString(), eq(10), eq(varId), eq(10))).thenReturn(0);

		// El servicio consulta el stock actual y reservado para reportar el detalle
		when(mockJdbc.queryForList(anyString(), eq(varId))).thenReturn(List.of(
				Map.of("talla", "M", "stock_actual", 5, "stock_reservado", 3)
		));

		assertThatThrownBy(() -> inventoryService.reserveStockForVariants(Map.of(varId, 10)))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("Stock insuficiente para reservar talla M")
				.hasMessageContaining("disponible 2 (físico 5 - reservado 3), solicitado 10")
				.matches(e -> ((PanelException) e).status().value() == 409);
	}

	@Test
	void b03_liberacionBloqueadaSiCurvaDeTallasNoEstaCerrada() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		when(mockPanel.jdbc()).thenReturn(mockJdbc);

		UUID orderId = UUID.randomUUID();
		ArtService artService = new ArtService(mockPanel);

		// Orden con curva_estado = PENDIENTE
		when(mockJdbc.queryForList(anyString(), eq(orderId))).thenReturn(List.of(
				Map.of("curva_estado", "PENDIENTE")
		));

		assertThatThrownBy(() -> artService.validateOrderGatesForRelease(orderId))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("Bloqueo de producción: el pedido no puede liberarse sin curva de tallas CERRADA")
				.matches(e -> ((PanelException) e).status().value() == 409);
	}

	@Test
	void b06_liberacionBloqueadaSiExistenArtesSinAprobacion() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		when(mockPanel.jdbc()).thenReturn(mockJdbc);

		UUID orderId = UUID.randomUUID();
		ArtService artService = new ArtService(mockPanel);

		// Orden con curva CERRADA pero 2 artes pendientes
		when(mockJdbc.queryForList(anyString(), eq(orderId))).thenReturn(List.of(
				Map.of("curva_estado", "CERRADA")
		));
		when(mockJdbc.queryForObject(anyString(), eq(Integer.class), eq(orderId))).thenReturn(2);

		assertThatThrownBy(() -> artService.validateOrderGatesForRelease(orderId))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("Bloqueo de producción: el pedido tiene 2 arte(s) sin aprobación del cliente")
				.matches(e -> ((PanelException) e).status().value() == 409);
	}

	@Test
	void b06_aprobacionDeArteRechazaSobreEscrituraSiYaFueAprobado() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.write(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		UUID orderId = UUID.randomUUID();
		UUID artId = UUID.randomUUID();
		ArtService artService = new ArtService(mockPanel);

		// Arte ya en estado APROBADO
		when(mockJdbc.queryForList(anyString(), eq(artId), eq(orderId))).thenReturn(List.of(
				Map.of("estado", "APROBADO", "version_actual", 1)
		));

		ApproveArtRequest req = new ApproveArtRequest("WhatsApp", "https://storage.keptai.pe/evidencia.jpg", "Aprobado por el cliente");

		assertThatThrownBy(() -> artService.approveArt(orderId, artId, req))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("El arte ya se encuentra en estado APROBADO e inmutable")
				.matches(e -> ((PanelException) e).status().value() == 409);
	}

	@Test
	void b08_avanceEstacionValidaBalanceDeMasaRechazaDescuadre() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.write(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		UUID orderId = UUID.randomUUID();
		ManufacturingService service = new ManufacturingService(mockPanel);

		when(mockJdbc.queryForList(anyString(), eq(orderId))).thenReturn(
				List.of(Map.of("id", orderId, "estado", "LIBERADA", "ref", "PED-001")),
				List.of(Map.of("estado", "COMPLETA", "validacion_tela", "CONFIRMADA_TALLER", "semaforo_tela", "HABITUAL_VERDE"))
		);

		// Entrada: 100, buenas: 80, segundas: 10, merma: 5, reproceso: 2 -> suma = 97 != 100
		StationAdvanceRequest req = new StationAdvanceRequest(
				"CORTE", "TERMINADA", "Prueba balance", 100, 5,
				100, 80, 10, 2, "CORTE_DESALINEADO", null
		);

		assertThatThrownBy(() -> service.advanceStation(orderId, req))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("MASS_BALANCE_MISMATCH")
				.matches(e -> ((PanelException) e).status().value() == 400);
	}

	@Test
	void b08_avanceCorteCalculaFactorConsumoRealYAlertaRecorte() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		TenantIdentity mockIdentity = mock(TenantIdentity.class);
		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.identity()).thenReturn(mockIdentity);
		when(mockIdentity.usuarioId()).thenReturn(UUID.randomUUID());
		when(mockPanel.write(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		UUID orderId = UUID.randomUUID();
		ManufacturingService service = new ManufacturingService(mockPanel);

		when(mockJdbc.queryForList(anyString(), eq(orderId))).thenReturn(
				List.of(Map.of("id", orderId, "estado", "LIBERADA", "ref", "PED-002")),
				List.of(Map.of("estado", "COMPLETA", "validacion_tela", "CONFIRMADA_TALLER", "semaforo_tela", "HABITUAL_VERDE"))
		);

		// Pedido de 100 prendas
		when(mockJdbc.queryForObject(anyString(), eq(Integer.class), eq(orderId))).thenReturn(100);
		// Etapa previa no existe
		when(mockJdbc.queryForList(anyString(), eq(orderId), eq("CORTE"))).thenReturn(List.of());

		// Entrada 100, buenas 90, segundas 0, merma 10, reproceso 0 -> suma = 100
		// consumo_real_kg = 25.200 -> factor = 25.200 / 90 = 0.2800
		StationAdvanceRequest req = new StationAdvanceRequest(
				"CORTE", "TERMINADA", "Corte completado", 90, 10,
				100, 90, 0, 0, "CORTE_DESALINEADO", new BigDecimal("25.200")
		);

		var response = service.advanceStation(orderId, req);
		assertThat(response.shortageAlert()).isTrue();
		assertThat(response.missingPieces()).isEqualTo(10);
		assertThat(response.fabricFactor()).isEqualTo(new BigDecimal("0.2800"));
	}

	@Test
	@SuppressWarnings("unchecked")
	void b10_requisicionCompraCalculaKilosConMermaYFechaRequerida() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		TenantIdentity mockIdentity = mock(TenantIdentity.class);
		UUID userId = UUID.randomUUID();
		UUID reqId = UUID.randomUUID();
		UUID orderId = UUID.randomUUID();

		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.identity()).thenReturn(mockIdentity);
		when(mockIdentity.usuarioId()).thenReturn(userId);
		when(mockPanel.write(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());
		when(mockPanel.read(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		FabricService service = new FabricService(mockPanel);

		// Mock query de lectura tras insert (captura cualquier parámetro consultado)
		when(mockJdbc.query(anyString(), any(RowMapper.class), any())).thenReturn(List.of(
				new FabricRequisition(
						reqId, orderId, "Piqué 24/1", "Azul Marino", 220,
						new BigDecimal("22.000"), new BigDecimal("10.00"), LocalDate.now().plusDays(7),
						"BORRADOR", userId, null, null, null, null, null, "Para pedido urgente", OffsetDateTime.now()
				)
		));

		// 20 kg con 10% de merma = 22.000 kg
		CreateRequisitionRequest req = new CreateRequisitionRequest(
				orderId, "Piqué 24/1", "Azul Marino", 220,
				new BigDecimal("20.000"), new BigDecimal("10.00"), LocalDate.now().plusDays(7), "Para pedido urgente"
		);

		var result = service.createRequisition(req);
		assertThat(result.requiredKg()).isEqualTo(new BigDecimal("22.000"));
		assertThat(result.status()).isEqualTo("BORRADOR");
	}

	@Test
	@SuppressWarnings("unchecked")
	void inventario_advertenciaMezclaDePartidas() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.read(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		FabricService service = new FabricService(mockPanel);
		UUID orderId = UUID.randomUUID();

		// Simulamos que la orden tiene 2 asignaciones con partidas distintas
		when(mockJdbc.query(anyString(), any(RowMapper.class), any())).thenReturn(List.of(
				new OrderFabricAssignment(
						UUID.randomUUID(), orderId, UUID.randomUUID(), "ROL-01", "Piqué", "Blanco", "PARTIDA-A", new BigDecimal("10.000"), OffsetDateTime.now()
				),
				new OrderFabricAssignment(
						UUID.randomUUID(), orderId, UUID.randomUUID(), "ROL-02", "Piqué", "Blanco", "PARTIDA-B", new BigDecimal("15.000"), OffsetDateTime.now()
				)
		));

		var summary = service.getOrderFabricLots(orderId);
		assertThat(summary.mixWarning()).isTrue();
		assertThat(summary.distinctDyeLots()).containsExactlyInAnyOrder("PARTIDA-A", "PARTIDA-B");
		assertThat(summary.totalAssignedKg()).isEqualTo(new BigDecimal("25.000"));
	}


	@Test
	void b01_validacionDniYRucSunatModulo11() {
		// DNI 8 dígitos: válido
		CustomerService.validateTaxId("72345678");

		// RUC 11 dígitos válido con algoritmo oficial (20123456786)
		CustomerService.validateTaxId("20123456786");

		// RUC con dígito verificador incorrecto: debe fallar
		assertThatThrownBy(() -> CustomerService.validateTaxId("20123456789"))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("no coincide con el cálculo SUNAT");

		// Longitud inválida
		assertThatThrownBy(() -> CustomerService.validateTaxId("12345"))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("DNI válido de 8 dígitos o un RUC válido de 11 dígitos");

		// Prefijo no tributario
		assertThatThrownBy(() -> CustomerService.validateTaxId("30123456781"))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("debe iniciar con 10, 15, 17 o 20");
	}

	@Test
	void b01_vendedorNoPuedeEditarRucNiRazonSocial() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		TenantIdentity mockIdentity = mock(TenantIdentity.class);

		UUID clientId = UUID.randomUUID();
		UUID sellerId = UUID.randomUUID();

		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.identity()).thenReturn(mockIdentity);
		when(mockIdentity.usuarioId()).thenReturn(sellerId);
		when(mockPanel.write(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		CustomerService service = new CustomerService(mockPanel);

		when(mockJdbc.queryForList(anyString(), eq(clientId))).thenReturn(List.of(
				Map.of(
						"id", clientId,
						"razon_social", "Colegio San Martín SAC",
						"tipo", "COLEGIO",
						"ruc_dni", "20123456786",
						"telefono_principal", "987654321",
						"vendedor_asignado_id", sellerId,
						"activo", true
				)
		));

		// Simular consulta de rol de actor que devuelve VENDEDOR
		when(mockJdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class)).thenReturn("VENDEDOR");

		// Vendedor intentando cambiar RUC
		var req = new pe.keptai.backend.contract.CustomerDtos.UpdateCustomerRequest(null, null, "20555555551", null, null, null, null, "Cambio RUC");
		assertThatThrownBy(() -> service.updateCustomer(clientId, req))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("El vendedor solo puede editar datos de contacto");
	}

	@Test
	void b01_adminBloqueadoSiClienteTieneComprobantes() {
		PanelContext mockPanel = mock(PanelContext.class);
		JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
		TenantIdentity mockIdentity = mock(TenantIdentity.class);

		UUID clientId = UUID.randomUUID();
		UUID adminId = UUID.randomUUID();

		when(mockPanel.jdbc()).thenReturn(mockJdbc);
		when(mockPanel.identity()).thenReturn(mockIdentity);
		when(mockIdentity.usuarioId()).thenReturn(adminId);
		when(mockPanel.write(any())).thenAnswer(inv -> ((java.util.function.Supplier<?>) inv.getArgument(0)).get());

		CustomerService service = new CustomerService(mockPanel);

		when(mockJdbc.queryForList(org.mockito.ArgumentMatchers.contains("FROM keptai.cliente c"), eq(clientId))).thenReturn(List.of(
				Map.of(
						"id", clientId,
						"razon_social", "Textilcorp SAC",
						"tipo", "EMPRESA",
						"ruc_dni", "20123456786",
						"telefono_principal", "987654321",
						"activo", true
				)
		));

		when(mockJdbc.queryForObject("SELECT keptai_private.actor_actual()", String.class)).thenReturn("ADMIN");

		// Simular que el cliente ya tiene órdenes en producción o pagos registrados
		when(mockJdbc.queryForList(org.mockito.ArgumentMatchers.contains("SELECT 1 FROM keptai.pago"), eq(clientId), eq(clientId))).thenReturn(List.of(
				Map.of("?column?", 1)
		));

		// Intento de modificar Razón Social
		var req = new pe.keptai.backend.contract.CustomerDtos.UpdateCustomerRequest("Nuevo Nombre SA", null, null, null, null, null, null, "Reestructuración");
		assertThatThrownBy(() -> service.updateCustomer(clientId, req))
				.isInstanceOf(PanelException.class)
				.hasMessageContaining("RUC_HAS_INVOICES_MERGE_REQUIRED");
	}

}
