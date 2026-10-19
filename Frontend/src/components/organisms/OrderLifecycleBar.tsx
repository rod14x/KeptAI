import type { ReactNode } from "react";
import {
  Check,
  NotePencil,
  ShieldCheck,
  Hourglass,
  Factory,
  Truck,
  HandCoins,
  WarningCircle,
} from "../ui/icons";
import { Chip, type Tone } from "../ui/Chip";
import { cx, formatDate, formatMoney } from "../../lib/format";
import type { OrderDetailDTO, PaymentTerms } from "../../api/client";

export interface LifecycleStep {
  key: string;
  stageNumber: number;
  stageName: string;
  title: string;
  status: "completed" | "current" | "pending" | "alert";
  badgeLabel?: string;
  badgeTone?: Tone;
  subtitle?: string;
  detail?: string;
  date?: string | null;
  actor?: string | null;
  icon: ReactNode;
  active?: boolean;
}

export interface OrderLifecycleBarProps {
  steps: LifecycleStep[];
  currentStepKey?: string;
  onStepClick?: (stepKey: string) => void;
  className?: string;
}

/** Helper para etiquetar condiciones de pago */
function termsLabel(c?: PaymentTerms | null): string {
  if (!c) return "Sin condición";
  if (c.tipo === "contado") return "Contado";
  if (c.tipo === "anticipo") return `Anticipo ${c.anticipoPct ?? 50}% y saldo a ${c.plazoDias}d`;
  return `Crédito a ${c.plazoDias} días`;
}

/** Construye los 5 pasos del ciclo Order-to-Cash con iconos semánticos según Corpotex */
export function buildOrderLifecycleSteps(d: OrderDetailDTO): LifecycleStep[] {
  const o = d.order;
  const isRejected = o.estado === "rechazada";
  const isPending = o.estado === "pendiente_aprobacion";
  const isRetenida = o.estado === "retenida";
  const inProduction = o.estado === "en_produccion";
  const isDespachada = o.estado === "despachada";
  const isPaidFull = d.card.balanceCents <= 0;
  const isCobrada = isPaidFull && isDespachada;

  // 1. Comercial / Cotización
  const step1: LifecycleStep = {
    key: "comercial",
    stageNumber: 1,
    stageName: "1. Comercial",
    title: isRejected ? "Rechazado" : isPending ? "Por Confirmar" : "Confirmado",
    status: isRejected ? "alert" : isPending ? "current" : "completed",
    badgeLabel: isRejected ? "Rechazada" : isPending ? "Borrador" : "Confirmada",
    badgeTone: isRejected ? "bad" : isPending ? "warn" : "ok",
    subtitle: d.seller ? `Cotizado por ${d.seller}` : "Captura WhatsApp / Catálogo",
    date: o.issuedOn,
    actor: d.seller ?? "Comercial Corpotex",
    icon: <NotePencil size={18} weight="bold" />,
  };

  // 2. Gatekeeper Financiero
  let step2Status: LifecycleStep["status"] = "pending";
  let step2Badge = "En espera";
  let step2Tone: Tone = "neutral";
  let step2Sub = "Validación de anticipo y crédito";

  if (isRetenida) {
    step2Status = "alert";
    step2Badge = "Retenida";
    step2Tone = "warn";
    step2Sub = `Anticipo pendiente: ${formatMoney(d.card.anticipoPendienteCents)}`;
  } else if (inProduction || isDespachada || isCobrada || d.gatekeeper) {
    step2Status = "completed";
    step2Badge = "Liberada";
    step2Tone = "ok";
    step2Sub =
      d.anticipoRequeridoCents > 0
        ? `Anticipo de ${formatMoney(d.anticipoRequeridoCents)} verificado`
        : o.condicionPago?.tipo === "credito"
          ? `Crédito aprobado (${o.condicionPago.plazoDias}d)`
          : "Condición autorizada";
  } else if (isPending) {
    step2Status = "pending";
    step2Badge = "Pendiente";
    step2Tone = "neutral";
    step2Sub = "Por definir condición de pago";
  }

  const step2: LifecycleStep = {
    key: "gatekeeper",
    stageNumber: 2,
    stageName: "2. Gatekeeper",
    title: isRetenida ? "Retenida" : step2Status === "completed" ? "Liberada" : "Gatekeeper",
    status: step2Status,
    badgeLabel: step2Badge,
    badgeTone: step2Tone,
    subtitle: step2Sub,
    date: o.credito?.at ?? null,
    actor: o.credito?.by ?? (isRetenida ? "Falta anticipo" : "Riesgos Corpotex"),
    icon: isRetenida ? <Hourglass size={18} weight="bold" /> : <ShieldCheck size={18} weight="bold" />,
  };

  // 3. Taller / Confección
  let step3Status: LifecycleStep["status"] = "pending";
  let step3Badge = "En espera";
  let step3Tone: Tone = "neutral";
  let step3Sub = "Corte y confección textil";

  if (inProduction) {
    step3Status = "current";
    step3Badge = "En corte";
    step3Tone = "info";
    step3Sub = `Confección ${o.modality === "tercerizada" ? "externa" : "propia Corpotex"}`;
  } else if (isDespachada || isCobrada) {
    step3Status = "completed";
    step3Badge = "Finalizado";
    step3Tone = "ok";
    step3Sub = "Prendas confeccionadas al 100%";
  } else if (isRetenida) {
    step3Status = "pending";
    step3Badge = "Bloqueado";
    step3Tone = "warn";
    step3Sub = "Taller detenido por anticipo";
  }

  const step3: LifecycleStep = {
    key: "taller",
    stageNumber: 3,
    stageName: "3. Taller",
    title: inProduction ? "En Confección" : step3Status === "completed" ? "Producido" : "Taller",
    status: step3Status,
    badgeLabel: step3Badge,
    badgeTone: step3Tone,
    subtitle: step3Sub,
    date: o.inicioProduccion ?? null,
    actor: o.modality === "tercerizada" ? "Taller Tercero" : "Planta Corpotex",
    icon: <Factory size={18} weight="bold" />,
  };

  // 4. Despacho / Entrega
  let step4Status: LifecycleStep["status"] = "pending";
  let step4Badge = "Pendiente";
  let step4Tone: Tone = "neutral";
  let step4Sub = "Salida física y acta de entrega";

  if (o.despacho || isDespachada || isCobrada) {
    step4Status = "completed";
    step4Badge = "Entregado";
    step4Tone = "ok";
    step4Sub = o.despacho ? `Acta: ${o.despacho.acta}` : "Despachado al cliente";
  } else if (inProduction) {
    step4Status = "pending";
    step4Badge = "En cola";
    step4Tone = "neutral";
    step4Sub = o.fechaEntregaSolicitada ? `Meta: ${formatDate(o.fechaEntregaSolicitada)}` : "En espera de taller";
  }

  const step4: LifecycleStep = {
    key: "despacho",
    stageNumber: 4,
    stageName: "4. Despacho",
    title: step4Status === "completed" ? "Despachado" : "Despacho",
    status: step4Status,
    badgeLabel: step4Badge,
    badgeTone: step4Tone,
    subtitle: step4Sub,
    date: o.despacho?.fecha ?? o.fechaEntregaSolicitada ?? null,
    actor: o.despacho?.by ?? "Jefe de Taller / Logística",
    icon: <Truck size={18} weight="bold" />,
  };

  // 5. Cobranza & Liquidación
  let step5Status: LifecycleStep["status"] = "pending";
  let step5Badge = "Pendiente";
  let step5Tone: Tone = "neutral";
  let step5Sub = "Conciliación del saldo en caja";

  if (isPaidFull) {
    step5Status = "completed";
    step5Badge = "100% Cobrado";
    step5Tone = "ok";
    step5Sub = "Caja conciliada y liquidada";
  } else if (d.card.finance === "vencido") {
    step5Status = "alert";
    step5Badge = "Mora";
    step5Tone = "bad";
    step5Sub = `Vencido · Saldo ${formatMoney(d.card.balanceCents)}`;
  } else if (isDespachada || d.paidCents > 0) {
    step5Status = "current";
    step5Badge = "En cobro";
    step5Tone = "info";
    step5Sub = `Saldo pendiente: ${formatMoney(d.card.balanceCents)}`;
  }

  const step5: LifecycleStep = {
    key: "cobranza",
    stageNumber: 5,
    stageName: "5. Cobranza",
    title: isPaidFull ? "Liquidado" : d.card.finance === "vencido" ? "Vencido" : "Cobranza",
    status: step5Status,
    badgeLabel: step5Badge,
    badgeTone: step5Tone,
    subtitle: step5Sub,
    date: d.card.dueDate ?? null,
    actor: d.card.dueDate ? `Vence ${formatDate(d.card.dueDate)}` : "Administración / Caja",
    icon: <HandCoins size={18} weight="bold" />,
  };

  return [step1, step2, step3, step4, step5];
}

/** Stepper visual e interactivo de 5 etapas para el ciclo de vida de la orden */
export function OrderLifecycleBar({
  steps,
  currentStepKey,
  onStepClick,
  className,
}: OrderLifecycleBarProps) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressPct =
    steps.length > 1
      ? Math.min(100, Math.round((completedCount / (steps.length - 1)) * 100))
      : 0;

  return (
    <div
      className={cx(
        "rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-soft transition-all",
        className
      )}
      role="region"
      aria-label="Trazabilidad del ciclo de vida del pedido"
    >
      {/* Cabecera de Trazabilidad */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Trazabilidad por Etapas (Order-to-Cash)
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            5 compuertas operativas: Comercial · Gatekeeper financiero · Taller · Despacho · Cobranza
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-muted tabular">
            {completedCount} de {steps.length} etapas completadas
          </span>
          <div className="w-24 h-2 bg-line rounded-full overflow-hidden">
            <div
              className={cx(
                "h-full rounded-full transition-all duration-500",
                progressPct === 100 ? "bg-ok" : "bg-brand-blue"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Indicador de progreso segmentado para pantallas medianas/grandes */}
      <div className="hidden xl:grid grid-cols-5 gap-2 mb-3" aria-hidden="true">
        {steps.map((st) => {
          const isDone = st.status === "completed";
          const isAct = st.status === "current" || st.key === currentStepKey;
          const isAlert = st.status === "alert";
          return (
            <div
              key={`seg-${st.key}`}
              className={cx(
                "h-1.5 rounded-full transition-all duration-300",
                isDone
                  ? "bg-ok"
                  : isAct
                    ? "bg-brand-blue animate-pulse"
                    : isAlert
                      ? "bg-warn"
                      : "bg-line"
              )}
            />
          );
        })}
      </div>

      <div>
        {/* Lista de etapas con tarjetas tipo Stepper limpias */}
        <ol
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 relative list-none p-0 m-0"
          aria-label="Etapas del pedido"
        >
          {steps.map((step) => {
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current" || step.key === currentStepKey;
            const isAlert = step.status === "alert";
            const isClickable = Boolean(onStepClick);
            const cleanStageName = step.stageName.replace(/^\d+\.\s*/, "");

            return (
              <li key={step.key} className="flex">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => onStepClick?.(step.key)}
                  className={cx(
                    "flex flex-col text-left w-full rounded-xl border p-3.5 transition-all outline-none",
                    isClickable
                      ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-blue hover:shadow-sm"
                      : "cursor-default",
                    isCurrent
                      ? "border-brand-blue/70 bg-brand-blue/[0.04] shadow-sm ring-1 ring-brand-blue/30"
                      : isAlert
                        ? "border-warn/60 bg-warn/[0.04] ring-1 ring-warn/30"
                        : isCompleted
                          ? "border-ok/40 bg-ok/[0.02] hover:border-ok/60"
                          : "border-line bg-panel/50 opacity-80 hover:opacity-100"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {/* Fila superior: Icono de etapa y Chip de estado alineados */}
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={cx(
                        "relative size-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-transform",
                        isCompleted
                          ? "bg-ok text-inverse shadow-xs"
                          : isCurrent
                            ? "bg-brand-blue text-inverse shadow-sm ring-2 ring-brand-blue/30"
                            : isAlert
                              ? "bg-warn text-inverse shadow-xs ring-2 ring-warn-tint"
                              : "bg-panel text-muted border border-line"
                      )}
                      aria-hidden="true"
                    >
                      {step.icon}
                      {isCompleted && (
                        <span
                          className="absolute -bottom-1 -right-1 size-3 rounded-full bg-ok text-inverse flex items-center justify-center ring-2 ring-card"
                          title="Completado"
                        >
                          <Check size={8} weight="bold" />
                        </span>
                      )}
                    </div>

                    {step.badgeLabel && (
                      <Chip
                        tone={step.badgeTone ?? (isCompleted ? "ok" : isAlert ? "warn" : isCurrent ? "info" : "neutral")}
                        className="text-[10px] px-1.5 py-0.5 shrink-0 font-bold"
                      >
                        {step.badgeLabel}
                      </Chip>
                    )}
                  </div>

                  {/* Etiqueta de compuerta y título */}
                  <div className="mt-2.5 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block truncate">
                      Paso {step.stageNumber} · {cleanStageName}
                    </span>

                    <h3
                      className={cx(
                        "text-sm font-extrabold truncate mt-0.5",
                        isCurrent
                          ? "text-brand-blue"
                          : isAlert
                            ? "text-warn"
                            : isCompleted
                              ? "text-ink"
                              : "text-muted"
                      )}
                    >
                      {step.title}
                    </h3>

                    {step.subtitle && (
                      <p className="text-xs text-muted mt-1 leading-snug line-clamp-2">
                        {step.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Metadatos inferiores: actor y fecha */}
                  {(step.actor || step.date) && (
                    <div className="mt-auto pt-2.5 flex items-center justify-between text-[11px] text-faint tabular border-t border-line-soft">
                      {step.actor && <span className="truncate pr-1">{step.actor}</span>}
                      {step.date && <span className="shrink-0">{formatDate(step.date)}</span>}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export interface OrderExecutiveStripProps {
  d: OrderDetailDTO;
  className?: string;
  onNavigateTab?: (tab: "pedido" | "pagos" | "mensajes") => void;
}

/** Banda Ejecutiva a un solo vistazo (3 tarjetas clave: Caja & Cobro, Semáforo Taller, Rentabilidad & Plazos) */
export function OrderExecutiveStrip({ d, className, onNavigateTab }: OrderExecutiveStripProps) {
  const o = d.order;
  const isPaidFull = d.card.balanceCents <= 0;
  const paidPct = o.saleCents > 0 ? Math.min(100, Math.round((d.paidCents / o.saleCents) * 100)) : 0;

  // Semáforo Taller
  let semaforo = {
    color: "bg-ok text-inverse",
    ring: "ring-ok-tint",
    badgeTone: "ok" as Tone,
    badgeText: "Habilitado",
    title: "Luz Verde: Taller Autorizado",
    desc: "Sin bloqueos de caja. Insumos y tela autorizados para corte.",
    icon: <Factory size={18} weight="bold" />,
  };

  if (o.estado === "retenida") {
    semaforo = {
      color: "bg-warn text-inverse",
      ring: "ring-warn-tint",
      badgeTone: "warn" as Tone,
      badgeText: "Retenido",
      title: "Luz Ámbar: Falta Anticipo",
      desc: "Producción detenida hasta registrar y conciliar el anticipo requerido.",
      icon: <Hourglass size={18} weight="bold" />,
    };
  } else if (o.estado === "rechazada") {
    semaforo = {
      color: "bg-bad text-inverse",
      ring: "ring-bad-tint",
      badgeTone: "bad" as Tone,
      badgeText: "Rechazado",
      title: "Luz Roja: Pedido Rechazado",
      desc: "Crédito desaprobado o condiciones no cumplidas. Taller bloqueado.",
      icon: <WarningCircle size={18} weight="bold" />,
    };
  }

  return (
    <div className={cx("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {/* Tarjeta 1: Caja & Cobranza */}
      <div className="rounded-xl border border-line bg-card p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Caja & Cobranza</span>
          <Chip tone={isPaidFull ? "ok" : d.card.finance === "vencido" ? "bad" : "info"} className="text-xs">
            {isPaidFull ? "100% Pagado" : `${paidPct}% Pagado`}
          </Chip>
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xl font-black tabular text-ink">{formatMoney(d.paidCents)}</span>
            <span className="text-xs text-muted tabular">de {formatMoney(o.saleCents)}</span>
          </div>
          <div className="w-full h-2 bg-line rounded-full overflow-hidden mb-2">
            <div
              className={cx("h-full rounded-full transition-all duration-500", isPaidFull ? "bg-ok" : "bg-brand-blue")}
              style={{ width: `${paidPct}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            Saldo pendiente: <strong className="text-ink tabular">{formatMoney(d.card.balanceCents)}</strong>
          </p>
        </div>
        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab("pagos")}
            className="mt-3 text-xs font-bold text-brand-blue hover:underline text-left inline-flex items-center gap-1"
          >
            Ver comprobantes y aplicaciones &rarr;
          </button>
        )}
      </div>

      {/* Tarjeta 2: Semáforo de Taller */}
      <div className="rounded-xl border border-line bg-card p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Gatekeeper Taller</span>
          <Chip tone={semaforo.badgeTone} className="text-xs">
            {semaforo.badgeText}
          </Chip>
        </div>
        <div className="flex items-start gap-3 my-1">
          <div className={cx("p-2 rounded-lg shrink-0", semaforo.color)}>
            {semaforo.icon}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-ink">{semaforo.title}</h4>
            <p className="text-xs text-muted mt-0.5 leading-snug">{semaforo.desc}</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-line-soft text-[11px] text-faint">
          Modalidad: <span className="font-semibold text-ink">{o.modality === "tercerizada" ? "Taller Externo" : "Planta Propia Corpotex"}</span>
        </div>
      </div>

      {/* Tarjeta 3: Términos & Plazos */}
      <div className="rounded-xl border border-line bg-card p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Términos Comerciales</span>
          <Chip tone={o.condicionPago?.tipo === "credito" ? "info" : "neutral"} className="text-xs">
            {termsLabel(o.condicionPago)}
          </Chip>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">Fecha Emisión:</span>
            <span className="font-semibold text-ink tabular">{formatDate(o.issuedOn)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Entrega Solicitada:</span>
            <span className="font-bold text-ink tabular">{o.fechaEntregaSolicitada ? formatDate(o.fechaEntregaSolicitada) : "Sin definir"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Vencimiento Cobro:</span>
            <span className={cx("font-bold tabular", d.card.finance === "vencido" ? "text-bad" : "text-ink")}>
              {d.card.dueDate ? formatDate(d.card.dueDate) : "Al despacho / contado"}
            </span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-line-soft text-[11px] text-faint flex items-center justify-between">
          <span>Margen bruto est.:</span>
          <span className="font-bold text-ok tabular">
            {d.marginCents !== null && o.saleCents > 0
              ? `${Math.round((d.marginCents / o.saleCents) * 100)}%`
              : "N/D"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default OrderLifecycleBar;
