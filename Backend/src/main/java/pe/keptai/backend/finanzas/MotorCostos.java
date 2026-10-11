package pe.keptai.backend.finanzas;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import pe.keptai.backend.finanzas.MotorFinancieroException.Codigo;
import pe.keptai.backend.finanzas.ResultadosCostos.*;

// Registro de costeo (C-05/C-06): costos por etapa, reparto a items, cargo interno del taller y cierre explicito.
// Las invariantes viven en V9 (misma orden y moneda, suma <= costo, taller interno, inmutabilidad); aqui se orquesta,
// se valida la entrada y se audita en la misma transaccion.
public class MotorCostos extends TransaccionFinanciera {

	private static final Set<String> PRODUCCION = Set.of("ADMIN", "JEFE_TALLER");
	private static final Set<String> ADMINISTRACION = Set.of("ADMIN");
	private static final Set<String> CONCEPTOS = Set.of("MATERIA_PRIMA", "MANO_OBRA", "TERCERO", "CIF", "LOGISTICA");
	private static final Set<String> ORIGENES = Set.of("REAL", "TEORICO");
	private static final Map<String, List<String>> ESPERADOS = Map.of(
			"INTERNA", List.of("MATERIA_PRIMA", "MANO_OBRA", "CIF"), "TERCERIZADA", List.of("TERCERO"));

	public MotorCostos(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
		super(jdbc, transactionManager);
	}

	public Costo registrarCosto(ContextoFinanciero ctx, UUID ordenId, UUID etapaId, String concepto, BigDecimal monto,
			String origen, String fuente) {
		exigir(CONCEPTOS.contains(concepto), "Concepto no valido: " + concepto);
		exigir(ORIGENES.contains(origen), "Origen debe ser REAL o TEORICO");
		exigir(fuente != null && !fuente.isBlank(), "La fuente del costo es obligatoria");
		BigDecimal importe = importe(monto, true);
		return enTransaccion(ctx, PRODUCCION, () -> {
			String moneda = monedaOrden(ordenId);
			UUID id = jdbc.queryForObject("""
					INSERT INTO keptai.costo_orden (organizacion_id, orden_id, etapa_id, concepto, monto, moneda, origen, fuente, registrado_por)
					VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""", UUID.class,
					ordenId, etapaId, concepto, importe, moneda, origen, fuente.strip(), ctx.usuarioId());
			auditar(ctx, "COSTO_REGISTRADO", "costo_orden", id,
					"jsonb_build_object('orden_id', ?::uuid, 'concepto', ?::text, 'monto', ?::numeric, 'origen', ?::text)",
					ordenId, concepto, importe, origen);
			return new Costo(id, ordenId, etapaId, concepto, importe, moneda, origen);
		});
	}

	// Asignacion manual (alta o correccion) de un costo a un item.
	public Asignacion asignarCosto(ContextoFinanciero ctx, UUID costoId, UUID ordenItemId, BigDecimal monto, String fuente) {
		BigDecimal importe = importe(monto, true);
		exigir(fuente != null && !fuente.isBlank(), "La fuente de la asignacion es obligatoria");
		return enTransaccion(ctx, PRODUCCION, () -> {
			upsertAsignacion(ctx, costoId, ordenItemId, importe, "MANUAL", fuente.strip());
			auditar(ctx, "COSTO_ASIGNADO", "costo_orden", costoId,
					"jsonb_build_object('orden_item_id', ?::uuid, 'monto', ?::numeric, 'metodo', 'MANUAL')", ordenItemId, importe);
			return new Asignacion(costoId, ordenItemId, importe, "MANUAL");
		});
	}

	// Prorratea cada costo REAL de la orden entre todos sus items por unidades o por valor de venta.
	// Centavos por mayor residuo con desempate por item: deterministico y sin perder ni crear centavos.
	public Reparto repartirCostos(ContextoFinanciero ctx, UUID ordenId, String metodo) {
		exigir("UNIDADES".equals(metodo) || "VALOR_VENTA".equals(metodo), "Metodo debe ser UNIDADES o VALOR_VENTA");
		return enTransaccion(ctx, PRODUCCION, () -> {
			monedaOrden(ordenId);
			record Item(UUID id, BigDecimal peso) {
			}
			List<Item> items = jdbc.query("""
					SELECT id, CASE WHEN ? = 'UNIDADES' THEN cantidad::numeric ELSE cantidad * precio_unit END
					  FROM keptai.orden_item WHERE orden_id = ? ORDER BY id""",
					(rs, i) -> new Item(rs.getObject(1, UUID.class), rs.getBigDecimal(2)), metodo, ordenId);
			BigDecimal pesoTotal = items.stream().map(Item::peso).reduce(BigDecimal.ZERO, BigDecimal::add);
			if (items.isEmpty() || pesoTotal.signum() == 0) {
				throw new MotorFinancieroException(Codigo.VALIDATION_ERROR,
						"La orden no tiene items con peso para repartir por " + metodo);
			}
			List<Map<String, Object>> costos = jdbc.queryForList(
					"SELECT id, monto FROM keptai.costo_orden WHERE orden_id = ? AND origen = 'REAL' ORDER BY id", ordenId);
			List<Asignacion> resultado = new ArrayList<>();
			for (Map<String, Object> c : costos) {
				UUID costoId = (UUID) c.get("id");
				long centavos = ((BigDecimal) c.get("monto")).movePointRight(2).longValueExact();
				long[] partes = new long[items.size()];
				BigDecimal[] residuos = new BigDecimal[items.size()];
				long asignados = 0;
				for (int i = 0; i < items.size(); i++) {
					BigDecimal exacto = BigDecimal.valueOf(centavos).multiply(items.get(i).peso())
							.divide(pesoTotal, 10, RoundingMode.DOWN);
					partes[i] = exacto.setScale(0, RoundingMode.DOWN).longValueExact();
					residuos[i] = exacto.subtract(BigDecimal.valueOf(partes[i]));
					asignados += partes[i];
				}
				Integer[] orden = new Integer[items.size()];
				for (int i = 0; i < orden.length; i++) {
					orden[i] = i;
				}
				Arrays.sort(orden, (a, b) -> residuos[b].compareTo(residuos[a]) != 0 ? residuos[b].compareTo(residuos[a])
						: items.get(a).id().compareTo(items.get(b).id()));
				for (int k = 0; k < centavos - asignados; k++) {
					partes[orden[k % orden.length]]++;
				}
				// Primero a cero para que ninguna fila intermedia supere el costo durante la correccion.
				jdbc.update("UPDATE keptai.asignacion_costo_item SET monto = 0 WHERE costo_id = ?", costoId);
				for (int i = 0; i < items.size(); i++) {
					BigDecimal monto = BigDecimal.valueOf(partes[i], 2);
					upsertAsignacion(ctx, costoId, items.get(i).id(), monto, metodo, "reparto_" + metodo.toLowerCase());
					resultado.add(new Asignacion(costoId, items.get(i).id(), monto, metodo));
				}
			}
			auditar(ctx, "COSTOS_REPARTIDOS", "orden", ordenId,
					"jsonb_build_object('metodo', ?::text, 'costos', ?::int, 'items', ?::int)", metodo, costos.size(), items.size());
			return new Reparto(ordenId, metodo, List.copyOf(resultado));
		});
	}

	public Transferencia registrarTransferencia(ContextoFinanciero ctx, UUID ordenId, UUID unidadTallerId, BigDecimal monto,
			String criterio, String fuente) {
		BigDecimal importe = importe(monto, true);
		exigir(criterio != null && !criterio.isBlank(), "El criterio del precio interno es obligatorio");
		exigir(fuente != null && !fuente.isBlank(), "La fuente del precio interno es obligatoria");
		return enTransaccion(ctx, ADMINISTRACION, () -> {
			String moneda = monedaOrden(ordenId);
			Boolean activa = jdbc.queryForObject("""
					SELECT EXISTS (SELECT 1 FROM keptai.transferencia_interna
					                WHERE orden_id = ? AND unidad_origen_id = ? AND anulada_en IS NULL)""",
					Boolean.class, ordenId, unidadTallerId);
			if (Boolean.TRUE.equals(activa)) {
				throw new MotorFinancieroException(Codigo.INVALID_STATE,
						"Ya hay un cargo interno activo de ese taller para la orden: anularlo antes de registrar otro");
			}
			UUID id = jdbc.queryForObject("""
					INSERT INTO keptai.transferencia_interna (organizacion_id, orden_id, unidad_origen_id, monto, moneda, criterio, fuente, registrado_por)
					VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, ?) RETURNING id""", UUID.class,
					ordenId, unidadTallerId, importe, moneda, criterio.strip(), fuente.strip(), ctx.usuarioId());
			auditar(ctx, "CARGO_INTERNO_REGISTRADO", "transferencia_interna", id,
					"jsonb_build_object('orden_id', ?::uuid, 'unidad_id', ?::uuid, 'monto', ?::numeric)", ordenId, unidadTallerId, importe);
			return new Transferencia(id, ordenId, unidadTallerId, importe, moneda, false);
		});
	}

	public Transferencia anularTransferencia(ContextoFinanciero ctx, UUID transferenciaId, String motivo) {
		exigir(motivo != null && !motivo.isBlank() && motivo.length() <= 500, "Motivo obligatorio (maximo 500 caracteres)");
		return enTransaccion(ctx, ADMINISTRACION, () -> {
			List<Transferencia> filas = jdbc.query("""
					UPDATE keptai.transferencia_interna SET anulada_en = now(), anulada_por = ?, motivo_anulacion = ?
					 WHERE id = ? AND anulada_en IS NULL
					RETURNING id, orden_id, unidad_origen_id, monto, moneda""",
					(rs, i) -> new Transferencia(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
							rs.getObject(3, UUID.class), rs.getBigDecimal(4), rs.getString(5).trim(), true),
					ctx.usuarioId(), motivo.strip(), transferenciaId);
			if (filas.isEmpty()) {
				Boolean existe = jdbc.queryForObject(
						"SELECT EXISTS (SELECT 1 FROM keptai.transferencia_interna WHERE id = ?)", Boolean.class, transferenciaId);
				throw Boolean.TRUE.equals(existe)
						? new MotorFinancieroException(Codigo.INVALID_STATE, "El cargo interno ya estaba anulado")
						: new MotorFinancieroException(Codigo.NOT_FOUND, "Cargo interno no encontrado");
			}
			auditar(ctx, "CARGO_INTERNO_ANULADO", "transferencia_interna", transferenciaId, "'{}'::jsonb");
			return filas.get(0);
		});
	}

	// Cierre explicito del costeo REAL o TEORICO (habilita margen certificado). Cualquier cambio posterior lo reabre (V5/V9).
	public CierreCosteo cerrarCosteo(ContextoFinanciero ctx, UUID ordenId, String origen) {
		exigir(ORIGENES.contains(origen), "Origen debe ser REAL o TEORICO");
		return enTransaccion(ctx, ADMINISTRACION, () -> {
			List<Map<String, Object>> orden = jdbc.queryForList(
					"SELECT tipo_produccion FROM keptai.orden WHERE id = ? FOR UPDATE", ordenId);
			if (orden.isEmpty()) {
				throw new MotorFinancieroException(Codigo.NOT_FOUND, "Orden no encontrada");
			}
			Map<String, Object> resumen = jdbc.queryForMap("""
					SELECT count(*) AS n, coalesce(sum(monto), 0) AS total, array_remove(array_agg(DISTINCT concepto), NULL) AS conceptos
					  FROM keptai.costo_orden WHERE orden_id = ? AND origen = ?""", ordenId, origen);
			if (((Number) resumen.get("n")).longValue() == 0) {
				throw new MotorFinancieroException(Codigo.INVALID_STATE, "No hay costos " + origen + " que cerrar");
			}
			Set<String> presentes = new HashSet<>();
			try {
				presentes.addAll(Arrays.asList((String[]) ((java.sql.Array) resumen.get("conceptos")).getArray()));
			} catch (java.sql.SQLException e) {
				throw new IllegalStateException(e);
			}
			List<String> faltantes = new ArrayList<>(ESPERADOS.getOrDefault((String) orden.get(0).get("tipo_produccion"), List.of()));
			faltantes.removeAll(presentes);
			Boolean asignada = jdbc.queryForObject("""
					SELECT coalesce(bool_and(coalesce(s.asignado, 0) = c.monto), true)
					  FROM keptai.costo_orden c
					  LEFT JOIN (SELECT costo_id, sum(monto) AS asignado FROM keptai.asignacion_costo_item GROUP BY costo_id) s
					    ON s.costo_id = c.id
					 WHERE c.orden_id = ? AND c.origen = ?""", Boolean.class, ordenId, origen);
			jdbc.update("UPDATE keptai.orden SET " + ("REAL".equals(origen) ? "costos_reales_completos" : "costos_teoricos_completos")
					+ " = true, actualizado_en = now(), version = version + 1 WHERE id = ?", ordenId);
			BigDecimal total = (BigDecimal) resumen.get("total");
			auditar(ctx, "COSTEO_CERRADO", "orden", ordenId,
					"jsonb_build_object('origen', ?::text, 'costo_total', ?::numeric, 'faltantes', ?::int, 'asignacion_completa', ?::boolean)",
					origen, total, faltantes.size(), asignada);
			return new CierreCosteo(ordenId, origen, total, List.copyOf(faltantes), Boolean.TRUE.equals(asignada));
		});
	}

	private void upsertAsignacion(ContextoFinanciero ctx, UUID costoId, UUID itemId, BigDecimal monto, String metodo, String fuente) {
		String moneda = jdbc.queryForList("SELECT moneda FROM keptai.costo_orden WHERE id = ?", String.class, costoId)
				.stream().findFirst().map(String::trim)
				.orElseThrow(() -> new MotorFinancieroException(Codigo.NOT_FOUND, "Costo no encontrado"));
		jdbc.update("""
				INSERT INTO keptai.asignacion_costo_item (organizacion_id, costo_id, orden_item_id, monto, moneda, metodo, fuente, registrado_por)
				VALUES (keptai.app_organizacion_actual(), ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (organizacion_id, costo_id, orden_item_id)
				DO UPDATE SET monto = EXCLUDED.monto, metodo = EXCLUDED.metodo, fuente = EXCLUDED.fuente,
				              registrado_por = EXCLUDED.registrado_por""",
				costoId, itemId, monto, moneda, metodo, fuente, ctx.usuarioId());
	}

	private String monedaOrden(UUID ordenId) {
		return jdbc.queryForList("SELECT moneda FROM keptai.orden WHERE id = ?", String.class, ordenId).stream()
				.findFirst().map(String::trim)
				.orElseThrow(() -> new MotorFinancieroException(Codigo.NOT_FOUND, "Orden no encontrada o fuera de alcance"));
	}

	private static BigDecimal importe(BigDecimal monto, boolean admiteCero) {
		if (monto == null || monto.signum() < 0 || (!admiteCero && monto.signum() == 0)) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "Importe invalido");
		}
		if (monto.stripTrailingZeros().scale() > 2) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, "El importe admite como maximo dos decimales");
		}
		return monto.setScale(2, RoundingMode.UNNECESSARY);
	}

	private static void exigir(boolean condicion, String mensaje) {
		if (!condicion) {
			throw new MotorFinancieroException(Codigo.VALIDATION_ERROR, mensaje);
		}
	}
}
