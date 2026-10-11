import type { ReactNode } from "react";
import { CheckCircle, CircleHalf, Clock, CopySimple, Factory, Flag, Hourglass, LinkBreak, NotePencil, PaperPlaneTilt, Prohibit, Scales, Truck, WarningCircle, XCircle } from "./icons";
import type { OrderState, OutgoingMessage } from "../../api/model";
import type { CreditStatus, MatchKind, OrderFinance } from "../../api/model";
import { cx } from "../../lib/format";

export type Tone = "ok" | "warn" | "bad" | "violet" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok-tint text-ok",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  violet: "bg-violet-tint text-violet-ink",
  info: "bg-info-tint text-info",
  neutral: "bg-line-soft text-muted",
};

export function Chip({ tone, icon, children, className }: { tone: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 text-xs font-medium leading-snug", TONE_CLASS[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const I = { size: 14, weight: "bold" as const };

export const MATCH_META: Record<MatchKind, { label: string; tone: Tone; icon: ReactNode }> = {
  pendiente: { label: "Por conciliar", tone: "neutral", icon: <Hourglass {...I} /> },
  total: { label: "Cubre el saldo", tone: "ok", icon: <CheckCircle {...I} /> },
  parcial: { label: "Parcial", tone: "info", icon: <CircleHalf {...I} /> },
  duplicado: { label: "Duplicado", tone: "bad", icon: <CopySimple {...I} /> },
  sin_orden: { label: "Sin orden", tone: "warn", icon: <LinkBreak {...I} /> },
  no_cuadra: { label: "No cuadra", tone: "warn", icon: <Scales {...I} /> },
  excede: { label: "Excede saldo", tone: "bad", icon: <Scales {...I} /> },
  incompleto: { label: "Faltan datos", tone: "warn", icon: <NotePencil {...I} /> },
};

export function MatchChip({ match }: { match: MatchKind }) {
  const m = MATCH_META[match];
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {m.label}
    </Chip>
  );
}

export function ActivityChip({ status }: { status: "completado" | "pendiente" | "fallido" | "entregado" }) {
  if (status === "completado") return <Chip tone="ok" icon={<CheckCircle {...I} />}>Completado</Chip>;
  if (status === "fallido") return <Chip tone="bad" icon={<XCircle {...I} />}>Fallido</Chip>;
  if (status === "entregado") return <Chip tone="neutral" icon={<Truck {...I} />}>Entregado</Chip>;
  return <Chip tone="warn" icon={<Clock {...I} />}>Pendiente</Chip>;
}

export function PriorityTag({ priority }: { priority: "urgente" | "normal" }) {
  return priority === "urgente" ? (
    <Chip tone="bad" icon={<Flag size={12} weight="fill" />} className="rounded-sm px-1.5 py-0.5">
      Urgente
    </Chip>
  ) : (
    <Chip tone="violet" icon={<Flag size={12} weight="fill" />} className="rounded-sm px-1.5 py-0.5">
      Normal
    </Chip>
  );
}

export function DueTag({ daysToDue }: { daysToDue: number }) {
  if (daysToDue < 0) return <Chip tone="bad" icon={<WarningCircle {...I} />}>Vencido hace {-daysToDue} d</Chip>;
  if (daysToDue === 0) return <Chip tone="warn" icon={<Clock {...I} />}>Vence hoy</Chip>;
  if (daysToDue <= 3) return <Chip tone="warn" icon={<Clock {...I} />}>Vence en {daysToDue} d</Chip>;
  return <Chip tone="neutral" icon={<Clock {...I} />}>Vence en {daysToDue} d</Chip>;
}

const FINANCE_META: Record<OrderFinance, { label: string; tone: Tone; icon: ReactNode }> = {
  cobrado: { label: "Cobrado", tone: "ok", icon: <CheckCircle {...I} /> },
  vencido: { label: "Vencido", tone: "bad", icon: <WarningCircle {...I} /> },
  vence_hoy: { label: "Vence hoy", tone: "warn", icon: <Clock {...I} /> },
  por_vencer: { label: "Por vencer", tone: "warn", icon: <Clock {...I} /> },
  al_dia: { label: "Al día", tone: "neutral", icon: <Clock {...I} /> },
  sin_vencimiento: { label: "Sin despacho", tone: "neutral", icon: <Hourglass {...I} /> },
};

export function FinanceChip({ finance, daysToDue }: { finance: OrderFinance; daysToDue?: number }) {
  const m = FINANCE_META[finance];
  const label =
    finance === "vencido" && daysToDue != null ? `Vencido hace ${-daysToDue} d` : finance === "por_vencer" && daysToDue != null ? `Vence en ${daysToDue} d` : m.label;
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {label}
    </Chip>
  );
}

export const CREDIT_META: Record<CreditStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  al_dia: { label: "Al día", tone: "ok", icon: <CheckCircle {...I} /> },
  por_vencer: { label: "Por vencer", tone: "warn", icon: <Clock {...I} /> },
  en_mora: { label: "En mora", tone: "bad", icon: <WarningCircle {...I} /> },
  sobre_linea: { label: "Sobre la línea", tone: "bad", icon: <WarningCircle {...I} /> },
};

export function CreditChip({ status }: { status: CreditStatus }) {
  const m = CREDIT_META[status];
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {m.label}
    </Chip>
  );
}

const ORDER_META: Record<OrderState, { label: string; tone: Tone; icon: ReactNode }> = {
  pendiente_aprobacion: { label: "Por confirmar", tone: "violet", icon: <NotePencil {...I} /> },
  retenida: { label: "Retenida", tone: "warn", icon: <Hourglass {...I} /> },
  en_produccion: { label: "En producción", tone: "info", icon: <Factory {...I} /> },
  despachada: { label: "Despachada", tone: "ok", icon: <Truck {...I} /> },
  rechazada: { label: "Rechazada", tone: "bad", icon: <Prohibit {...I} /> },
};

export function OrderStateChip({ estado }: { estado: OrderState }) {
  const m = ORDER_META[estado];
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {m.label}
    </Chip>
  );
}

const MESSAGE_META: Record<OutgoingMessage["estado"], { label: string; tone: Tone; icon: ReactNode }> = {
  enviado: { label: "Enviado", tone: "ok", icon: <PaperPlaneTilt {...I} /> },
  pendiente: { label: "Programado", tone: "neutral", icon: <Clock {...I} /> },
  error: { label: "Error", tone: "bad", icon: <XCircle {...I} /> },
  cancelado: { label: "Cancelado", tone: "neutral", icon: <Prohibit {...I} /> },
};

export function MessageStateChip({ estado }: { estado: OutgoingMessage["estado"] }) {
  const m = MESSAGE_META[estado];
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {m.label}
    </Chip>
  );
}
