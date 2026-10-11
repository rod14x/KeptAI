import { daysBetween, todayIso } from "./dates";

export interface DeliveryAlert {
  isOverdue: boolean;
  reason: string | null;
  entrega: string | null;
  despacho: string | null;
  daysLate: number;
}

/**
 * Lógica de Fechas requerida para el módulo Gerencia:
 * Compara la Fecha de Entrega solicitada con la Fecha de Despacho.
 * Si un pedido está vencido (Despacho > Entrega o Fecha Actual > Entrega sin despacho),
 * activa el estado de alerta roja visualmente destacada.
 */
export function checkDeliveryOverdue(
  order: { entregaSolicitada?: string | null; despachoOn?: string | null; estado?: string },
  referenceDate?: string,
): DeliveryAlert {
  const entrega = order.entregaSolicitada;
  const despacho = order.despachoOn;

  if (!entrega) {
    return { isOverdue: false, reason: null, entrega: null, despacho: null, daysLate: 0 };
  }

  const now = referenceDate ?? todayIso();

  // Caso 1: Ya fue despachado pero Despacho > Entrega (retraso en taller)
  if (despacho) {
    const diff = daysBetween(entrega, despacho);
    if (diff > 0) {
      return {
        isOverdue: true,
        reason: `Despacho posterior a entrega (+${diff}d)`,
        entrega,
        despacho,
        daysLate: diff,
      };
    }
  } else if (order.estado !== "rechazada") {
    // Caso 2: No ha sido despachado y Fecha Actual > Entrega
    const diff = daysBetween(entrega, now);
    if (diff > 0) {
      return {
        isOverdue: true,
        reason: `Entrega vencida sin despacho (+${diff}d)`,
        entrega,
        despacho: null,
        daysLate: diff,
      };
    }
  }

  return { isOverdue: false, reason: null, entrega, despacho: despacho ?? null, daysLate: 0 };
}
