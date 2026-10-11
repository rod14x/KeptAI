import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight, Bell, CheckCircle, HandCoins, Receipt, UploadSimple, WarningCircle } from "../components/ui/icons";
import { getCobranza, getOrderBoard, getQueue, queueGroup, type CobranzaDTO, type OrderBoardDTO, type PaymentCard } from "../api/client";
import type { Person } from "../api/model";
import { useApi } from "../hooks/useApi";
import { useScope } from "../context/ScopeContext";
import { useMe } from "../context/AuthContext";
import { can } from "../lib/permissions";
import { MotionLink, Stagger, itemVariants, listVariants, press } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, ErrorState, Money, Skeleton } from "../components/ui/States";
import { cx, formatDate } from "../lib/format";

// Inicio de quien opera (Vendedor y Administración): solo lo que hay que hacer ahora.
// Una tarea destacada con un único botón; el resto, en tarjetas pequeñas. Sin tareas, "Todo al día".
// Se arma con las mismas lecturas que ya usan Pedidos, Pagos y Cobranza: no hay endpoint nuevo.

type TaskItem = { id: string; href: string; title: string; detail: string; amountCents: number | null; flag?: string };
type Task = { id: string; title: string; hint: string; cta: string; icon: ReactNode; items: TaskItem[]; allHref: string };

type Inputs = { board: OrderBoardDTO | null; queue: PaymentCard[] | null; cobranza: CobranzaDTO | null };

/** Si la fuente no trae el vendedor (modo api), la tarea se muestra igual. */
const mine = (seller: string | null, me: Person) => me.role !== "vendedor" || seller == null || seller === me.name;

function buildTasks(me: Person, { board, queue, cobranza }: Inputs): Task[] {
  const tasks: Task[] = [];

  if (can(me.role, "aprobar_credito") && board) {
    const cards = (board.columns.find((c) => c.id === "por_confirmar")?.cards ?? []).filter((c) => mine(c.seller, me));
    tasks.push({
      id: "confirmar",
      title: "Pedidos por confirmar",
      hint: "Revisa la hoja de resumen, elige crédito o anticipo y confirma.",
      cta: "Confirmar el primero",
      icon: <HandCoins size={22} weight="bold" />,
      allHref: "/pedidos",
      items: cards.map((c) => ({
        id: c.id,
        href: `/pedidos/${c.id}`,
        title: `${c.ref} · ${c.customer}`,
        detail: c.description,
        amountCents: c.saleCents,
        flag: c.clienteEnMora ? "Cliente con atraso" : c.faltantes > 0 ? `Faltan ${c.faltantes} datos` : undefined,
      })),
    });
  }

  if (can(me.role, "verificar") && queue) {
    const toCard = (p: PaymentCard): TaskItem => ({
      id: p.id,
      href: `/conciliacion/${p.id}`,
      title: `${p.customer}${p.orderRef ? ` · ${p.orderRef}` : ""}`,
      detail: p.channel ?? (p.origen === "whatsapp" ? "Llegó por WhatsApp" : "Cargado a mano"),
      amountCents: p.amountCents,
    });
    tasks.push({
      id: "pagos",
      title: "Pagos por revisar",
      hint: "Mira el comprobante, confirma que llegó a tu banca y se descuenta de la deuda.",
      cta: "Empezar a revisar",
      icon: <Receipt size={22} weight="bold" />,
      allHref: "/conciliacion?fase=por_revisar",
      items: queue.filter((p) => queueGroup(p) === "recibidos" || queueGroup(p) === "verificados").map(toCard),
    });
    tasks.push({
      id: "problemas",
      title: "Pagos con problema",
      hint: "Duplicados, sin pedido o con monto que no cuadra. No tocan la deuda hasta que decidas.",
      cta: "Resolver el primero",
      icon: <WarningCircle size={22} weight="bold" />,
      allHref: "/conciliacion?fase=problema",
      items: queue.filter((p) => queueGroup(p) === "revision").map((p) => ({ ...toCard(p), href: `/conciliacion/${p.id}?fase=problema` })),
    });
  }

  if (cobranza && can(me.role, "gestionar_cobranza")) {
    tasks.push({
      id: "alertas",
      title: "Clientes por llamar",
      hint: "Alertas de cobranza abiertas: pagos vencidos que el recordatorio automático no resolvió.",
      cta: "Ver alertas",
      icon: <Bell size={22} weight="bold" />,
      allHref: "/cobranza?vista=alertas",
      items: cobranza.alerts
        .filter((a) => a.estado === "abierta")
        .map((a) => ({
          id: a.id,
          href: a.customerId ? `/clientes/${a.customerId}` : "/cobranza?vista=alertas",
          title: `${a.customer} · ${a.orderRef}`,
          detail: a.dueDate ? `Venció el ${formatDate(a.dueDate)}` : a.regla,
          amountCents: a.balanceCents,
        })),
    });
  } else if (cobranza && me.role === "vendedor") {
    tasks.push({
      id: "vencidos",
      title: "Clientes con pago vencido",
      hint: "No bloquea nada: tenlo en cuenta antes de darles más crédito.",
      cta: "Ver al cliente",
      icon: <Bell size={22} weight="bold" />,
      allHref: "/cobranza",
      items: cobranza.receivables
        .filter((r) => r.daysToDue < 0 && mine(r.seller, me))
        .map((r) => ({
          id: r.id,
          href: `/clientes/${r.customerId}`,
          title: `${r.customer} · ${r.orderRef}`,
          detail: `Venció hace ${-r.daysToDue} ${r.daysToDue === -1 ? "día" : "días"}`,
          amountCents: r.balanceCents,
        })),
    });
  }

  return tasks.filter((t) => t.items.length > 0);
}

export function PendientesPage() {
  const me = useMe();
  const { scope } = useScope();
  const { data, loading, error, reload } = useApi<Inputs>(async () => {
    // Cada lectura es opcional: si una falla, el resto de pendientes se muestra igual.
    const [board, queue, cobranza] = await Promise.all([
      can(me.role, "aprobar_credito") ? getOrderBoard(scope).catch(() => null) : null,
      can(me.role, "verificar") ? getQueue(scope).catch(() => null) : null,
      can(me.role, "ver_cobranza") ? getCobranza(scope).catch(() => null) : null,
    ]);
    if (!board && !queue && !cobranza) throw new Error("No se pudieron leer tus pendientes.");
    return { board, queue, cobranza };
  }, [scope, me.role]);

  const tasks = data ? buildTasks(me, data) : [];
  const total = tasks.reduce((n, t) => n + t.items.length, 0);
  const [first, ...rest] = tasks;

  return (
    <Stagger className="mx-auto flex max-w-[960px] flex-col gap-6 lg:gap-8">
      <PageHeader
        title={`Hola, ${me.name.split(" ")[0]}`}
        subtitle={!data ? "Revisando qué hay por hacer…" : total === 0 ? "Todo al día. No tienes nada pendiente." : `Tienes ${total} ${total === 1 ? "cosa" : "cosas"} por hacer. Empieza por la primera.`}
        actions={
          <>
            {can(me.role, "captura") && (
              <MotionLink to="/captura" {...press} className="inline-flex h-11 items-center gap-2 rounded-full bg-card px-4 text-[13px] font-semibold ring-1 ring-line transition-colors hover:bg-panel">
                <UploadSimple size={16} weight="bold" /> Subir comprobante
              </MotionLink>
            )}
            <MotionLink to="/resumen" {...press} className="inline-flex h-11 items-center rounded-full px-4 text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft hover:text-ink">
              Ver números
            </MotionLink>
          </>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[300px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[120px] rounded-[var(--radius-card)]" />
        </div>
      ) : !first ? (
        <AllDone />
      ) : (
        <>
          <MainTask task={first} />
          {rest.length > 0 && (
            <section aria-label="También pendiente" className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted">También pendiente</h2>
              <motion.div variants={listVariants} className="grid gap-3 sm:grid-cols-2">
                {rest.map((t) => (
                  <SmallTask key={t.id} task={t} />
                ))}
              </motion.div>
            </section>
          )}
        </>
      )}
    </Stagger>
  );
}

const PRIMARY_LINK =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgb(23_23_26/0.2),inset_0_1px_0_rgb(255_255_255/0.08)] transition-colors hover:bg-ink-soft";

function MainTask({ task }: { task: Task }) {
  const shown = task.items.slice(0, 4);
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet text-white shadow-[0_6px_16px_-6px_rgb(124_92_219/0.7)]">{task.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-ink">Empieza por aquí</p>
          <h2 className="mt-0.5 text-section font-bold">
            {task.title} <span className="tabular text-muted">({task.items.length})</span>
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{task.hint}</p>
        </div>
      </div>

      <motion.ul variants={listVariants} className="flex flex-col">
        {shown.map((it) => (
          <motion.li key={it.id} variants={itemVariants} className="border-t border-line-soft first:border-t-0">
            <Link to={it.href} className="group -mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-panel">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{it.title}</span>
                <span className="flex items-center gap-2 text-[13px] text-muted">
                  <span className="truncate">{it.detail}</span>
                  {it.flag && <span className="shrink-0 rounded-full bg-warn-tint px-2 py-0.5 text-[11px] font-semibold text-warn">{it.flag}</span>}
                </span>
              </span>
              {it.amountCents != null && <Money cents={it.amountCents} className="text-sm font-bold" />}
              <ArrowRight size={16} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          </motion.li>
        ))}
      </motion.ul>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <MotionLink to={task.items[0].href} {...press} className={cx(PRIMARY_LINK, "sm:min-w-[220px]")}>
          {task.cta} <ArrowRight size={18} weight="bold" />
        </MotionLink>
        {task.items.length > shown.length && (
          <Link to={task.allHref} className="inline-flex min-h-11 items-center justify-center px-3 text-[13px] font-semibold text-muted hover:text-ink">
            Ver los {task.items.length}
          </Link>
        )}
      </div>
    </Card>
  );
}

function SmallTask({ task }: { task: Task }) {
  return (
    <MotionLink
      to={task.items[0].href}
      variants={itemVariants}
      {...press}
      className="group flex items-center gap-3 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line/70"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-panel text-ink-soft ring-1 ring-line/70">{task.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{task.title}</span>
        <span className="block truncate text-[13px] text-muted">{task.items[0].title}</span>
      </span>
      <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">{task.items.length}</span>
    </MotionLink>
  );
}

function AllDone() {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-ok-tint text-ok">
        <CheckCircle size={30} weight="fill" />
      </span>
      <h2 className="text-section font-bold">Todo al día</h2>
      <p className="max-w-[40ch] text-sm text-muted">Cuando llegue un pedido o un pago por WhatsApp, aparecerá aquí. No tienes que buscarlo en otra pantalla.</p>
    </Card>
  );
}
