package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosFinancieros.*;

// C-02/C-05/C-06: margen por pedido, marca y linea; taller como centro de resultados; resumen y CSV de pedidos.
public class MotorResultados extends TransaccionFinanciera {

	private static final Set<String> LECTURA = Set.of("GERENTE", "ADMIN");
	private static final BigDecimal CERO = BigDecimal.ZERO.setScale(2);
	private static final Map<String, List<String>> COMPONENTES_ESPERADOS = Map.of(
			"INTERNA", List.of("MATERIA_PRIMA", "MANO_OBRA", "CIF"),
			"TERCERIZADA", List.of("TERCERO"));

	public MotorResultados(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		super(jdbc, transactionManager);
	}

	private record OrdenDato(UUID id, String ref, String tipoProduccion, BigDecimal total, String moneda,
			boolean costosCerrados, UUID marcaId, String marca, BigDecimal costoReal, Set<String> conceptos,
			boolean asignacionCompleta, String origen, boolean demo, BigDecimal cobrado, BigDecimal saldo,
			LocalDate venceEn, String estadoObligacion) {
		List<String> faltantes() {
			if (costosCerrados) {
				return List.of();
			}
			List<String> f = new ArrayList<>(COMPONENTES_ESPERADOS.getOrDefault(tipoProduccion, List.of()));
			f.removeAll(conceptos);
			return f;
		}
	}

	public ReporteMargen margen(ContextoFinanciero ctx, Agrupacion agrupacion, String tipoProduccion, LocalDate fechaCorte) {
		Objects.requireNonNull(agrupacion, "agrupacion");
		LocalDate corte = exigirFecha(fechaCorte);
		if (tipoProduccion != null && !COMPONENTES_ESPERADOS.containsKey(tipoProduccion)) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "tipoProduccion debe ser INTERNA o TERCERIZADA");
		}
		return enTransaccion(ctx, LECTURA, () -> {
			List<OrdenDato> ordenes = ordenes(corte).stream()
					.filter(o -> tipoProduccion == null || tipoProduccion.equals(o.tipoProduccion())).toList();
			List<FilaMargen> filas = switch (agrupacion) {
				case ORDEN -> ordenes.stream().map(o -> fila(o.ref(), o.id(), o.tipoProduccion(), List.of(o))).toList();
				case MARCA -> agrupar(ordenes, o -> Optional.ofNullable(o.marca()).orElse("SIN_MARCA"),
						o -> o.marcaId(), tipoProduccion);
				case LINEA -> porLinea(ordenes, tipoProduccion);
			};
			return new ReporteMargen(corte, agrupacion, filas, totales(filas, ordenes.size(), tipoProduccion));
		});
	}

	public ReporteCentro centroProductivo(ContextoFinanciero ctx, LocalDate fechaCorte) {
		LocalDate corte = exigirFecha(fechaCorte);
		return enTransaccion(ctx, LECTURA, () -> {
			List<FilaCentro> filas = jdbc.query("""
					SELECT t.orden_id, o.ref, t.unidad_origen_id, u.nombre, t.monto, o.total, o.costos_reales_completos,
					       (SELECT coalesce(sum(c.monto), 0) FROM keptai.costo_orden c JOIN keptai.orden_etapa e
					           ON e.organizacion_id = c.organizacion_id AND e.id = c.etapa_id
					         WHERE c.orden_id = o.id AND c.origen = 'REAL' AND e.unidad_id = t.unidad_origen_id) AS costo_taller,
					       (SELECT coalesce(sum(t2.monto), 0) FROM keptai.transferencia_interna t2
					         WHERE t2.orden_id = o.id AND t2.anulada_en IS NULL) AS transferencias,
					       (SELECT coalesce(sum(c.monto), 0) FROM keptai.costo_orden c
					         WHERE c.orden_id = o.id AND c.origen = 'REAL') AS costo_total,
					       (SELECT coalesce(sum(c.monto), 0) FROM keptai.costo_orden c LEFT JOIN keptai.orden_etapa e
					           ON e.organizacion_id = c.organizacion_id AND e.id = c.etapa_id
					         WHERE c.orden_id = o.id AND c.origen = 'REAL'
					           AND (e.unidad_id IS NULL OR e.unidad_id NOT IN (
					                SELECT t3.unidad_origen_id FROM keptai.transferencia_interna t3
					                 WHERE t3.orden_id = o.id AND t3.anulada_en IS NULL))) AS costo_externo,
					       (SELECT count(*) FROM keptai.costo_orden c
					         WHERE c.orden_id = o.id AND c.origen = 'REAL' AND c.etapa_id IS NULL) AS sin_etapa
					  FROM keptai.transferencia_interna t
					  JOIN keptai.orden o ON o.organizacion_id = t.organizacion_id AND o.id = t.orden_id
					  JOIN keptai.unidad_produccion u ON u.organizacion_id = t.organizacion_id AND u.id = t.unidad_origen_id
					  JOIN keptai.organizacion org ON org.id = o.organizacion_id
					 WHERE t.anulada_en IS NULL AND o.estado NOT IN ('BORRADOR', 'CANCELADA') AND o.total IS NOT NULL
					   AND timezone(org.zona_horaria, o.creado_en)::date <= ?
					 ORDER BY o.ref, u.nombre""", (rs, i) -> {
				boolean completo = rs.getBoolean(7) && rs.getLong(12) == 0;
				BigDecimal cargo = rs.getBigDecimal(5), total = rs.getBigDecimal(6), costoTaller = rs.getBigDecimal(8);
				return new FilaCentro(rs.getObject(1, UUID.class), rs.getString(2), rs.getObject(3, UUID.class),
						rs.getString(4), cargo, completo ? costoTaller : null,
						completo ? cargo.subtract(costoTaller) : null,
						completo ? total.subtract(rs.getBigDecimal(9)).subtract(rs.getBigDecimal(11)) : null,
						completo ? total.subtract(rs.getBigDecimal(10)) : null, completo);
			}, corte);
			boolean completo = filas.stream().allMatch(FilaCentro::completo);
			Map<UUID, FilaCentro> porOrden = new LinkedHashMap<>();
			filas.forEach(f -> porOrden.putIfAbsent(f.ordenId(), f));
			return new ReporteCentro(corte, filas,
					completo ? sumar(filas.stream().map(FilaCentro::resultadoTaller).toList()) : null,
					completo ? sumar(porOrden.values().stream().map(FilaCentro::resultadoComercial).toList()) : null,
					completo ? sumar(porOrden.values().stream().map(FilaCentro::margenConsolidado).toList()) : null,
					completo);
		});
	}

	public Resumen resumen(ContextoFinanciero ctx, LocalDate fechaCorte) {
		LocalDate corte = exigirFecha(fechaCorte);
		return enTransaccion(ctx, LECTURA, () -> {
			List<OrdenDato> ordenes = ordenes(corte);
			boolean completos = ordenes.stream().allMatch(OrdenDato::costosCerrados);
			BigDecimal ventas = sumar(ordenes.stream().map(OrdenDato::total).toList());
			BigDecimal costo = completos ? sumar(ordenes.stream().map(OrdenDato::costoReal).toList()) : null;
			BigDecimal cobrado = jdbc.queryForObject("""
					SELECT coalesce(sum(a.monto_aplicado), 0) FROM keptai.aplicacion_pago a
					  JOIN keptai.organizacion org ON org.id = a.organizacion_id
					 WHERE a.anulada_en IS NULL AND timezone(org.zona_horaria, a.aplicado_en)::date <= ?""",
					BigDecimal.class, corte);
			TreeSet<String> faltantes = new TreeSet<>();
			ordenes.forEach(o -> faltantes.addAll(o.faltantes()));
			return new Resumen(corte, ventas, cobrado,
					sumar(ordenes.stream().map(o -> o.saldo() == null ? CERO : o.saldo()).toList()), costo,
					costo == null ? null : ventas.subtract(costo), completos, List.copyOf(faltantes));
		});
	}

	// Columnas fijas de GET /reports/orders.csv; importes en centavos; celda vacia = ausente, nunca cero.
	public String csvPedidos(ContextoFinanciero ctx, LocalDate fechaCorte) {
		LocalDate corte = exigirFecha(fechaCorte);
		return enTransaccion(ctx, LECTURA, () -> {
			StringBuilder csv = new StringBuilder(
					"order_id,order_code,brand,production_mode,currency,sale_cents,cost_cents,margin_cents,cost_status,"
							+ "applied_cents,balance_cents,due_date,receivable_status,data_origin\r\n");
			for (OrdenDato o : ordenes(corte)) {
				boolean completo = o.costosCerrados();
				csv.append(String.join(",",
						o.id().toString(), Csv.texto(o.ref()), Csv.texto(o.marca()),
						"INTERNA".equals(o.tipoProduccion()) ? "own" : "outsourced", o.moneda(),
						Csv.centavos(o.total()), completo ? Csv.centavos(o.costoReal()) : "",
						completo ? Csv.centavos(o.total().subtract(o.costoReal())) : "",
						completo ? "complete" : "incomplete", Csv.centavos(o.cobrado()), Csv.centavos(o.saldo()),
						o.venceEn() == null ? "" : o.venceEn().toString(), estadoContrato(o.estadoObligacion()),
						o.demo() ? "demo_fixture" : "WHATSAPP".equals(o.origen()) ? "reviewed_extraction" : "manual_entry"))
						.append("\r\n");
			}
			return csv.toString();
		});
	}

	private List<OrdenDato> ordenes(LocalDate corte) {
		return jdbc.query("""
				WITH costos AS (
				  SELECT c.orden_id, sum(c.monto) AS costo_real, array_agg(DISTINCT c.concepto) AS conceptos
				    FROM keptai.costo_orden c WHERE c.origen = 'REAL' GROUP BY c.orden_id
				), asignacion AS (
				  SELECT c.orden_id, bool_and(coalesce(s.asignado, 0) = c.monto) AS completa
				    FROM keptai.costo_orden c
				    LEFT JOIN (SELECT costo_id, sum(monto) AS asignado FROM keptai.asignacion_costo_item GROUP BY costo_id) s
				      ON s.costo_id = c.id
				   WHERE c.origen = 'REAL' GROUP BY c.orden_id
				)
				SELECT o.id, o.ref, o.tipo_produccion, o.total, o.moneda, o.costos_reales_completos, o.marca_id, m.nombre,
				       coalesce(c.costo_real, 0), c.conceptos, coalesce(a.completa, true), o.origen,
				       org.nombre LIKE 'DEMO %', s.cobrado, s.saldo, ob.vence_en, ob.estado
				  FROM keptai.orden o
				  JOIN keptai.organizacion org ON org.id = o.organizacion_id
				  LEFT JOIN keptai.marca m ON m.organizacion_id = o.organizacion_id AND m.id = o.marca_id
				  LEFT JOIN costos c ON c.orden_id = o.id
				  LEFT JOIN asignacion a ON a.orden_id = o.id
				  LEFT JOIN keptai.obligacion_cobro ob ON ob.organizacion_id = o.organizacion_id AND ob.orden_id = o.id
				  LEFT JOIN keptai.v_saldo_obligacion s ON s.obligacion_id = ob.id
				 WHERE o.estado NOT IN ('BORRADOR', 'CANCELADA') AND o.total IS NOT NULL
				   AND timezone(org.zona_horaria, o.creado_en)::date <= ?
				 ORDER BY o.ref, o.id""", (rs, i) -> new OrdenDato(rs.getObject(1, UUID.class), rs.getString(2),
				rs.getString(3), rs.getBigDecimal(4), rs.getString(5).trim(), rs.getBoolean(6), rs.getObject(7, UUID.class),
				rs.getString(8), rs.getBigDecimal(9), conceptos(rs, 10), rs.getBoolean(11), rs.getString(12),
				rs.getBoolean(13), rs.getBigDecimal(14), rs.getBigDecimal(15), rs.getObject(16, LocalDate.class),
				rs.getString(17)), corte);
	}

	private List<FilaMargen> agrupar(List<OrdenDato> ordenes, Function<OrdenDato, String> clave,
			Function<OrdenDato, UUID> id, String tipoProduccion) {
		Map<String, List<OrdenDato>> grupos = new TreeMap<>();
		ordenes.forEach(o -> grupos.computeIfAbsent(clave.apply(o), k -> new ArrayList<>()).add(o));
		return grupos.entrySet().stream()
				.map(e -> fila(e.getKey(), id.apply(e.getValue().get(0)), tipoProduccion, e.getValue())).toList();
	}

	private FilaMargen fila(String clave, UUID id, String tipoProduccion, List<OrdenDato> ordenes) {
		boolean completo = ordenes.stream().allMatch(OrdenDato::costosCerrados);
		BigDecimal ingreso = sumar(ordenes.stream().map(OrdenDato::total).toList());
		BigDecimal costo = completo ? sumar(ordenes.stream().map(OrdenDato::costoReal).toList()) : null;
		TreeSet<String> faltantes = new TreeSet<>();
		ordenes.forEach(o -> faltantes.addAll(o.faltantes()));
		return new FilaMargen(clave, id, tipoProduccion, ingreso, costo, costo == null ? null : ingreso.subtract(costo),
				completo, List.copyOf(faltantes), ordenes.size());
	}

	// Margen por linea: ingreso del item y costos asignados a ese item; completo solo con costeo cerrado,
	// todos los costos reales asignados al 100% y todos los items con linea (DB-DEF-001 §9).
	private List<FilaMargen> porLinea(List<OrdenDato> ordenes, String tipoProduccion) {
		Map<UUID, OrdenDato> incluidas = new HashMap<>();
		ordenes.forEach(o -> incluidas.put(o.id(), o));
		record Item(UUID ordenId, UUID lineaId, String linea, BigDecimal ingreso, BigDecimal costo) {
		}
		List<Item> items = jdbc.query("""
				SELECT i.orden_id, i.linea_id, l.nombre, i.cantidad * i.precio_unit,
				       coalesce((SELECT sum(ai.monto) FROM keptai.asignacion_costo_item ai
				                   JOIN keptai.costo_orden c ON c.organizacion_id = ai.organizacion_id AND c.id = ai.costo_id
				                  WHERE ai.orden_item_id = i.id AND c.origen = 'REAL'), 0)
				  FROM keptai.orden_item i
				  LEFT JOIN keptai.linea_producto l ON l.organizacion_id = i.organizacion_id AND l.id = i.linea_id""",
				(rs, i) -> new Item(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
						rs.getBigDecimal(4), rs.getBigDecimal(5)))
				.stream().filter(it -> incluidas.containsKey(it.ordenId())).toList();
		Map<String, List<Item>> grupos = new TreeMap<>();
		items.forEach(it -> grupos.computeIfAbsent(it.linea() == null ? "SIN_LINEA" : it.linea(), k -> new ArrayList<>()).add(it));
		List<FilaMargen> filas = new ArrayList<>();
		grupos.forEach((linea, lista) -> {
			Set<OrdenDato> origen = new LinkedHashSet<>();
			lista.forEach(it -> origen.add(incluidas.get(it.ordenId())));
			boolean completo = !"SIN_LINEA".equals(linea)
					&& origen.stream().allMatch(o -> o.costosCerrados() && o.asignacionCompleta());
			BigDecimal ingreso = sumar(lista.stream().map(Item::ingreso).toList());
			BigDecimal costo = completo ? sumar(lista.stream().map(Item::costo).toList()) : null;
			TreeSet<String> faltantes = new TreeSet<>();
			origen.forEach(o -> faltantes.addAll(o.faltantes()));
			filas.add(new FilaMargen(linea, lista.get(0).lineaId(), tipoProduccion, ingreso, costo,
					costo == null ? null : ingreso.subtract(costo), completo, List.copyOf(faltantes), origen.size()));
		});
		return filas;
	}

	private FilaMargen totales(List<FilaMargen> filas, int ordenes, String tipoProduccion) {
		boolean completo = filas.stream().allMatch(FilaMargen::completo);
		BigDecimal ingreso = sumar(filas.stream().map(FilaMargen::ingreso).toList());
		BigDecimal costo = completo ? sumar(filas.stream().map(FilaMargen::costoTotal).toList()) : null;
		TreeSet<String> faltantes = new TreeSet<>();
		filas.forEach(f -> faltantes.addAll(f.componentesFaltantes()));
		return new FilaMargen("TOTAL", null, tipoProduccion, ingreso, costo, costo == null ? null : ingreso.subtract(costo),
				completo, List.copyOf(faltantes), ordenes);
	}

	private static Set<String> conceptos(ResultSet rs, int columna) throws SQLException {
		Array arreglo = rs.getArray(columna);
		return arreglo == null ? Set.of() : Set.of((String[]) arreglo.getArray());
	}

	private static BigDecimal sumar(List<BigDecimal> valores) {
		return valores.stream().filter(Objects::nonNull).reduce(CERO, BigDecimal::add);
	}

	private static String estadoContrato(String estado) {
		if (estado == null) {
			return "";
		}
		return switch (estado) {
			case "PENDIENTE" -> "pending";
			case "PARCIAL" -> "partially_paid";
			case "PAGADA" -> "paid";
			case "MORA" -> "overdue";
			case "ANULADA" -> "voided";
			default -> throw new IllegalStateException("Estado de obligacion desconocido: " + estado);
		};
	}

	static LocalDate exigirFecha(LocalDate fecha) {
		if (fecha == null) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "La fecha de corte es obligatoria");
		}
		return fecha;
	}

	static final class Csv {
		private Csv() {
		}

		// Con signo: margen y resultados pueden ser negativos (MoneyBridge.solesToCents solo admite >= 0).
		static String centavos(BigDecimal soles) {
			if (soles == null) {
				return "";
			}
			long centavos = soles.setScale(2, java.math.RoundingMode.UNNECESSARY).movePointRight(2).longValueExact();
			if (Math.abs(centavos) > pe.keptai.backend.contract.CommonDtos.MAX_SAFE_CENTS) {
				throw new IllegalArgumentException("Importe fuera del rango seguro del contrato");
			}
			return Long.toString(centavos);
		}

		// RFC 4180 y prefijo contra inyeccion de formulas en celdas de texto (=, +, -, @, tab, CR).
		static String texto(String valor) {
			if (valor == null) {
				return "";
			}
			String v = !valor.isEmpty() && "=+-@\t\r".indexOf(valor.charAt(0)) >= 0 ? "'" + valor : valor;
			return v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")
					? "\"" + v.replace("\"", "\"\"") + "\"" : v;
		}
	}
}
