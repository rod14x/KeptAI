import type { ReactNode } from "react";
import {
  Check,
  NotePencil,
  ShieldCheck,
  Hourglass,
  Factory,
  Truck,
  HandCoins,
  Wallet,
  ChartLineUp,
  WarningCircle,
  CalendarBlank,
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Trazabilidad por Etapas (Order-to-Cash)
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            5 compuertas operativas: Comercial · Gatekeeper financiero · Taller · Despacho · Cobranza
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted tabular">
            {completedCount} de {steps.length} etapas completadas
          </span>
          <div className="w-20 h-2 bg-line rounded-full overflow-hidden">
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

      <div className="relative">
        {/* Track horizontal continuo detrás de los nodos en pantallas grandes */}
        <div
          className="absolute top-7 left-8 right-8 h-1 bg-line hidden xl:block -z-0"
          aria-hidden="true"
        >
          <div
            className="h-full bg-ok transition-all duration-500"
            style={{
              width: `${Math.max(
                0,
                Math.min(
                  100,
                  (completedCount / Math.max(1, steps.length - 1)) * 100
                )
              )}%`,
            }}
          />
        </div>

        {/* Lista de etapas con micro-tarjetas */}
        <ol
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 relative z-10 list-none p-0 m-0"
          aria-label="Etapas del pedido"
        >
          {steps.map((step) => {
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current" || step.key === currentStepKey;
            const isAlert = step.status === "alert";

            const isClickable = Boolean(onStepClick);

            return (
              <li key={step.key} className="flex">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => onStepClick?.(step.key)}
                  className={cx(
                    "flex flex-col text-left w-full rounded-xl border p-3.5 transition-all outline-none",
                    isClickable
                      ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-blue"
                      : "cursor-default",
                    isCurrent
                      ? "border-brand-blue/60 bg-brand-blue/[0.04] shadow-sm ring-1 ring-brand-blue/30"
                      : isAlert
                        ? "border-warn/50 bg-warn/[0.04] ring-1 ring-warn/30"
                        : isCompleted
                          ? "border-ok/30 bg-ok/[0.02] hover:border-ok/50"
                          : "border-line bg-panel/60 opacity-80 hover:opacity-100"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {/* Encabezado del paso con icono de etapa */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cx(
                          "relative size-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-transform",
                          isCompleted
                            ? "bg-ok text-inverse shadow-sm"
                            : isCurrent
                              ? "bg-brand-blue text-inverse shadow-md ring-4 ring-brand-blue/20"
                              : isAlert
                                ? "bg-warn text-inverse shadow-sm ring-4 ring-warn-tint"
                                : "bg-panel text-muted border border-line"
                        )}
                        aria-hidden="true"
                      >
                        {step.icon}
                        {isCompleted && (
                          <span
                            className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-ok text-inverse flex items-center justify-center ring-2 ring-card"
                            title="Completado"
                          >
                            <Check size={9} weight="bold" />
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted truncate">
                        {step.stageName}
                      </span>
                    </div>

                    {step.badgeLabel && (
                      <Chip
                        tone={step.badgeTone ?? (isCompleted ? "ok" : isAlert ? "warn" : isCurrent ? "info" : "neutral")}
                        className="text-[11px] px-1.5 py-0.5 shrink-0"
                      >
                        {step.badgeLabel}
                      </Chip>
                    )}
                  </div>

                  {/* Título de la etapa y subtítulo enriquecido */}
                  <div className="mt-3 min-w-0">
                    <h3
                      className={cx(
                        "text-sm font-extrabold truncate",
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
                      {step.actor && <span className="truncate">{step.actor}</span>}
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
      badgeText: "Detenido",
      title: "Luz Ámbar: Taller Detenido",
      desc: `Bloqueado por Gatekeeper: Requiere registrar anticipo de ${formatMoney(d.card.anticipoPendienteCents)} antes de corte.`,
      icon: <Hourglass size={18} weight="bold" />,
    };
  } else if (o.estado === "pendiente_aprobacion") {
    semaforo = {
      color: "bg-brand-blue text-inverse",
      ring: "ring-brand-blue/20",
      badgeTone: "info" as Tone,
      badgeText: "En Validación",
      title: "Luz Amarilla: En Revisión",
      desc: "Esperando confirmación de cotización y condiciones comerciales.",
      icon: <NotePencil size={18} weight="bold" />,
    };
  } else if (o.estado === "despachada") {
    semaforo = {
      color: "bg-brand-blue text-inverse",
      ring: "ring-brand-blue/20",
      badgeTone: "info" as Tone,
      badgeText: "Completado",
      title: "Luz Azul: Confección Lista",
      desc: `Prendas terminadas y despachadas con acta (${o.despacho?.acta ?? "Acta registrada"}).`,
      icon: <Truck size={18} weight="bold" />,
    };
  } else if (o.estado === "rechazada") {
    semaforo = {
      color: "bg-bad text-inverse",
      ring: "ring-bad-tint",
      badgeTone: "bad" as Tone,
      badgeText: "Rechazada",
      title: "Luz Roja: Rechazada",
      desc: "Orden cancelada, no habilitada para compras ni corte.",
      icon: <WarningCircle size={18} weight="bold" />,
    };
  }

  // Margen estimado
  const marginPct =
    d.marginCents != null && o.saleCents > 0
      ? Math.round((d.marginCents / o.saleCents) * 100)
      : null;

  return (
    <div className={cx("grid grid-cols-1 md:grid-cols-3 gap-3.5", className)}>
      {/* Tarjeta 1: Recaudación y Flujo de Cobro */}
      <div
        onClick={() => onNavigateTab?.("pagos")}
        className={cx(
          "rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-soft flex flex-col justify-between transition-all",
          onNavigateTab && "cursor-pointer hover:border-brand-blue/40"
        )}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                <Wallet size={16} weight="bold" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Cobranza & Caja
              </span>
            </div>
            <Chip
              tone={isPaidFull ? "ok" : d.card.finance === "vencido" ? "bad" : d.card.finance === "por_vencer" ? "warn" : "info"}
            >
              {isPaidFull ? "100% Cobrado" : d.card.finance === "vencido" ? "Vencido" : d.card.finance === "por_vencer" ? "Por vencer" : "Al día"}
            </Chip>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-black text-ink tabular">
              {paidPct}% <span className="text-xs font-semibold text-muted">cobrado</span>
            </span>
            <span className="text-xs font-bold text-muted tabular">
              Total {formatMoney(o.saleCents)}
            </span>
          </div>

          {/* Barra de progreso de recaudación */}
          <div className="mt-2.5 h-2.5 w-full bg-line rounded-full overflow-hidden flex">
            <div
              style={{ width: `${paidPct}%` }}
              className="bg-ok h-full transition-all duration-500 rounded-l-full"
            />
            <div
              style={{ width: `${100 - paidPct}%` }}
              className={cx(
                "h-full transition-all duration-500",
                d.card.finance === "vencido" ? "bg-bad/40" : "bg-panel"
              )}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs tabular">
            <span className="text-ok font-bold">
              Cobrado: {formatMoney(d.paidCents)}
            </span>
            <span className={cx("font-bold", d.card.finance === "vencido" ? "text-bad" : "text-ink")}>
              Saldo: {formatMoney(d.card.balanceCents)}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-line-soft flex items-center justify-between text-[11px] text-muted">
          <span>{termsLabel(o.condicionPago)}</span>
          {d.card.dueDate && (
            <span className="font-semibold text-ink">
              Vence: {formatDate(d.card.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Tarjeta 2: Semáforo Operativo para el Taller */}
      <div
        onClick={() => onNavigateTab?.("pedido")}
        className={cx(
          "rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-soft flex flex-col justify-between transition-all",
          onNavigateTab && "cursor-pointer hover:border-brand-blue/40"
        )}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={cx("size-8 rounded-lg flex items-center justify-center", semaforo.color)}>
                {semaforo.icon}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Semáforo Taller
              </span>
            </div>
            <Chip tone={semaforo.badgeTone}>{semaforo.badgeText}</Chip>
          </div>

          <h3 className="text-sm font-extrabold text-ink leading-tight flex items-center gap-2">
            <span className={cx("size-2.5 rounded-full inline-block", semaforo.color)} />
            {semaforo.title}
          </h3>

          <p className="mt-1.5 text-xs text-muted leading-relaxed line-clamp-2">
            {semaforo.desc}
          </p>
        </div>

        <div className="mt-3 pt-2.5 border-t border-line-soft flex items-center justify-between text-[11px] text-muted">
          <span>{o.modality === "tercerizada" ? "Taller Externo" : "Planta Corpotex"}</span>
          <span className="font-semibold text-ink">Línea: {o.line ?? "General"}</span>
        </div>
      </div>

      {/* Tarjeta 3: Rentabilidad & Compromiso de Entrega */}
      <div
        onClick={() => onNavigateTab?.("pagos")}
        className={cx(
          "rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-soft flex flex-col justify-between transition-all",
          onNavigateTab && "cursor-pointer hover:border-brand-blue/40"
        )}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-lg bg-ok/10 text-ok flex items-center justify-center">
                <ChartLineUp size={16} weight="bold" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Margen & Entrega
              </span>
            </div>
            {marginPct != null && (
              <Chip tone={marginPct >= 30 ? "ok" : marginPct > 15 ? "warn" : "bad"}>
                {marginPct}% Margen
              </Chip>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-xl font-black text-ink tabular">
                {d.marginCents != null ? formatMoney(d.marginCents) : "—"}
              </span>
              <span className="block text-[11px] text-muted">
                {d.costCents != null ? `Costo: ${formatMoney(d.costCents)}` : "Costeo en curso"}
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-ink flex items-center gap-1 justify-end">
                <CalendarBlank size={13} weight="bold" />
                {o.fechaEntregaSolicitada ? formatDate(o.fechaEntregaSolicitada) : "Sin fecha"}
              </span>
              <span className="text-[11px] text-muted">Fecha pactada</span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-line-soft flex items-center justify-between text-[11px] text-muted">
          <span>Marca: {d.card.brand === "corpotex" ? "Corpotex" : "Unicrack"}</span>
          <span className="font-semibold text-ok">
            {isPaidFull ? "Margen en caja asegurado" : "Margen proyectado"}
          </span>
        </div>
      </div>
    </div>
  );
}
