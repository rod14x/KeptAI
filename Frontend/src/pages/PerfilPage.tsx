import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Stagger, itemVariants, listVariants, spring } from "../components/motion/primitives";
import { Segmented } from "../components/ui/Segmented";
import { Link, useSearchParams } from "react-router";
import { CalendarBlank, Check, EnvelopeSimple, Lock, Minus, FloppyDisk, Storefront } from "../components/ui/icons";
import { capabilities, commands, getProfile, type ProfileDTO } from "../api/client";
import type { Scope, Settings } from "../api/model";
import { useApi } from "../hooks/useApi";
import { useMe } from "../context/AuthContext";
import { SCOPE_LABEL, useScope } from "../context/ScopeContext";
import { useToast } from "../context/ToastContext";
import { ALL_PERMISSIONS, PERMISSION_LABEL, ROLE_LABEL, ROLE_SUMMARY, can } from "../lib/permissions";
import { readPrefs, writePrefs, type Preferences } from "../lib/preferences";
import { Card, EmptyState, ErrorState, Money, Skeleton } from "../components/ui/States";
import { ActivityChip, Chip } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { inputClass } from "../components/ui/Modal";
import { cx, formatDate, formatDateTime, formatMoney } from "../lib/format";

const TABS = [
  { id: "datos", label: "Datos y rol" },
  { id: "actividad", label: "Mi actividad" },
  { id: "preferencias", label: "Preferencias" },
  { id: "configuracion", label: "Configuración" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function PerfilPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "datos") as TabId;
  const { data, loading, error, reload } = useApi(() => getProfile(me), [me.id, me.role]);

  return (
    <Stagger className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={me.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{me.name}</h1>
            <Chip tone="violet">{ROLE_LABEL[me.role]}</Chip>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <span>{me.title}</span>
            <span className="inline-flex items-center gap-1">
              <EnvelopeSimple size={14} /> {me.email}
            </span>
            <span className="inline-flex items-center gap-1">
              <Storefront size={14} /> {me.brand ? (me.brand === "corpotex" ? "Corpotex" : "Unicrack") : "Corpotex y Unicrack"}
            </span>
            {me.since && (
              <span className="inline-flex items-center gap-1">
                <CalendarBlank size={14} /> En el equipo desde {formatDate(me.since)}
              </span>
            )}
          </p>
        </div>
      </Card>

      <motion.div variants={itemVariants} className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <Segmented kind="tab" label="Secciones del perfil" value={tab} onChange={(t) => setParams({ tab: t })} options={TABS.map((t) => ({ value: t.id, label: t.label }))} />
      </motion.div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton className="h-[360px] rounded-[var(--radius-card)]" />
      ) : (
        // La clave reinicia el escalonado al cambiar de pestaña: el contenido nuevo entra en orden.
        <Stagger key={tab} className="flex flex-col gap-6">
          {tab === "datos" ? <RoleTab d={data} /> : tab === "actividad" ? <ActivityTab d={data} /> : tab === "preferencias" ? <PreferencesTab /> : <SettingsTab d={data} />}
        </Stagger>
      )}
    </Stagger>
  );
}

function RoleTab({ d }: { d: ProfileDTO }) {
  const me = useMe();
  const stats = d.counts.map((c) => ({ label: c.label, v: c.value }));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Card className="p-5 sm:p-6">
        <h2 className="text-section font-bold">Lo que puede hacer tu rol</h2>
        <p className="mt-1 text-sm text-muted">{ROLE_SUMMARY[me.role]}</p>
        <motion.ul variants={listVariants} className="mt-4 grid gap-2 sm:grid-cols-2">
          {ALL_PERMISSIONS.map((p) => {
            const yes = can(me.role, p);
            return (
              <motion.li variants={itemVariants} key={p} className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px]", yes ? "bg-ok-tint/60 font-semibold text-ink" : "bg-panel text-muted")}>
                <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full", yes ? "bg-ok text-white" : "bg-line text-muted")}>
                  {yes ? <Check size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
                </span>
                {PERMISSION_LABEL[p]}
              </motion.li>
            );
          })}
        </motion.ul>
        <p className="mt-4 text-xs text-muted">El servidor valida cada permiso. Si algo no te corresponde, la app lo explica en lugar de ocultarlo sin aviso.</p>
      </Card>
      <Card className="p-5 sm:p-6">
        <h2 className="text-section font-bold">Tu trabajo registrado</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-panel p-3.5 ring-1 ring-line/70">
              <dt className="text-xs font-semibold text-muted">{s.label}</dt>
              <dd className="tabular mt-1 text-2xl font-extrabold">{s.v}</dd>
            </div>
          ))}
        </dl>
        <Link to="?tab=actividad" className="mt-4 inline-block text-[13px] font-semibold text-violet-ink hover:underline">
          Ver el detalle con fechas
        </Link>
      </Card>
    </div>
  );
}

function ActivityTab({ d }: { d: ProfileDTO }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-section font-bold">Mi actividad</h2>
      <p className="mt-1 text-sm text-muted">Todo lo que hiciste en KeptAI, con fecha y hora. Este registro no se puede borrar.</p>
      {d.activity === null ? (
        <div className="mt-4">
          <EmptyState title="Actividad no disponible">Tu rol no tiene acceso a la auditoría (GET /audit-events).</EmptyState>
        </div>
      ) : d.activity.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Aún no registras acciones">Cuando valides, apliques o solicites algo, aparecerá aquí.</EmptyState>
        </div>
      ) : (
        <motion.ul variants={listVariants} className="mt-4 flex flex-col">
          {d.activity.map((a) => {
            const body = (
              <>
                <span className="tabular w-[132px] shrink-0 text-[13px] font-semibold">{formatDateTime(a.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.text}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {a.who}
                    {a.reference && ` · ${a.reference}`}
                  </span>
                </span>
                <span className="tabular hidden w-28 text-right text-sm font-bold sm:block">{a.amountCents != null ? <Money cents={a.amountCents} /> : ""}</span>
                <span className="hidden w-28 justify-end md:flex">
                  <ActivityChip status={a.status} />
                </span>
              </>
            );
            return (
              <motion.li variants={itemVariants} key={a.id} className="border-t border-line-soft first:border-t-0">
                {a.href ? (
                  <Link to={a.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-panel">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3">{body}</div>
                )}
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </Card>
  );
}

const NOTIFY_LABEL: Record<keyof Preferences["notify"], string> = {
  vencimientos: "Vencimientos y mora de mis clientes",
  duplicados: "Comprobantes duplicados",
  credito: "Órdenes por confirmar y retenidas",
  sinPedido: "Pagos en revisión y mensajes con error",
};

function PreferencesTab() {
  const me = useMe();
  const toast = useToast();
  const { locked, setScope } = useScope();
  const [prefs, setPrefs] = useState<Preferences>(() => readPrefs(me.id));

  const save = () => {
    const ok = writePrefs(me.id, prefs);
    if (!locked) setScope(prefs.defaultScope);
    toast(ok, ok ? "Preferencias guardadas en este navegador." : "No se pudieron guardar: el navegador bloquea el almacenamiento.");
  };

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-section font-bold">Preferencias</h2>
      <p className="mt-1 text-sm text-muted">Se guardan solo en este navegador y no cambian datos del negocio.</p>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold">Vista al iniciar sesión</legend>
        {locked ? (
          <p className="mt-2 flex items-center gap-2 text-[13px] text-muted">
            <Lock size={14} /> Como vendedor, siempre ves tu marca.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {(["consolidado", "corpotex", "unicrack"] as Scope[]).map((s) => (
              <label key={s} className={cx("flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet", prefs.defaultScope === s ? "bg-ink text-white ring-ink" : "bg-card ring-line hover:bg-panel")}>
                <input type="radio" name="scope" className="sr-only" checked={prefs.defaultScope === s} onChange={() => setPrefs({ ...prefs, defaultScope: s })} />
                {SCOPE_LABEL[s]}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-bold">Alertas del asistente</legend>
        <p className="mt-1 text-[13px] text-muted">Esto solo filtra el asistente. Los mensajes al cliente salen por WhatsApp (contacto de prueba) según la cobranza programada.</p>
        <div className="mt-3 flex flex-col gap-2">
          {(Object.keys(NOTIFY_LABEL) as Array<keyof Preferences["notify"]>).map((k) => (
            <label key={k} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl bg-panel px-4 py-3 ring-1 ring-line/70 transition-colors hover:bg-line-soft/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet">
              <span className="text-sm font-medium">{NOTIFY_LABEL[k]}</span>
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  role="switch"
                  className="peer sr-only"
                  checked={prefs.notify[k]}
                  onChange={(e) => setPrefs({ ...prefs, notify: { ...prefs.notify, [k]: e.target.checked } })}
                />
                <span className="h-7 w-12 rounded-full bg-line transition-colors duration-200 peer-checked:bg-violet peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet" />
                <motion.span
                  aria-hidden="true"
                  initial={false}
                  animate={{ x: prefs.notify[k] ? 20 : 0 }}
                  transition={spring}
                  className="absolute left-1 top-1 size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(23_23_26/0.25)]"
                />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button className="mt-6" icon={<FloppyDisk size={16} weight="bold" />} onClick={save}>
        Guardar preferencias
      </Button>
    </Card>
  );
}

function SettingsTab({ d }: { d: ProfileDTO }) {
  if (!d.settings || !capabilities.settings)
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-section font-bold">Supuestos de caja y crédito</h2>
        <p className="mt-2 flex items-start gap-2 text-sm text-muted">
          <Lock size={16} className="mt-0.5 shrink-0" />
          Los supuestos de escenario (factor de cobro, plazo por defecto) y el precio de transferencia viven en el backend. El contrato de la API todavía no
          tiene un endpoint para editarlos desde el panel; gerencia ve el factor aplicado en la proyección de caja.
        </p>
      </Card>
    );
  return <SettingsForm d={d} s={d.settings} />;
}

function SettingsForm({ d, s }: { d: ProfileDTO; s: Settings }) {
  const me = useMe();
  const toast = useToast();
  const editable = can(me.role, "configurar");
  const [cobro, setCobro] = useState(String(Math.round(s.factorCobro * 100)));
  const [plazo, setPlazo] = useState(String(s.plazoDefecto));

  useEffect(() => {
    setCobro(String(Math.round(s.factorCobro * 100)));
    setPlazo(String(s.plazoDefecto));
  }, [s.factorCobro, s.plazoDefecto]);

  const save = async () => {
    const n = Number(cobro);
    if (!Number.isFinite(n)) {
      toast(false, "El factor de cobro debe ser un número.");
      return;
    }
    const r = await commands.updateSettings({ factorCobro: n / 100, plazoDefecto: Number(plazo) }, me);
    toast(r.ok, r.message);
  };

  return (
    <div className="flex flex-col gap-6">
      {!editable && (
        <p className="flex items-center gap-2 rounded-2xl bg-panel px-4 py-3 text-sm text-muted ring-1 ring-line">
          <Lock size={16} /> Solo gerencia edita estos supuestos. Los ves para entender de dónde salen las cifras.
        </p>
      )}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-section font-bold">Supuestos de caja y crédito</h2>
            <p className="mt-1 text-sm text-muted">CONFIG_ESCENARIO del modelo. Valores de demostración, no política aprobada por la empresa.</p>
          </div>
          {s.updatedAt && (
            <p className="tabular text-xs text-muted">
              Última modificación: {s.updatedBy}, {formatDateTime(s.updatedAt)}
            </p>
          )}
        </div>
        <fieldset disabled={!editable} className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cobro" className="text-sm font-bold">
              Factor de cobro (escenario)
            </label>
            <div className="relative">
              <input id="cobro" inputMode="numeric" value={cobro} onChange={(e) => setCobro(e.target.value)} className={cx(inputClass, "tabular pr-10 disabled:text-muted")} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
            </div>
            <p className="text-xs text-muted">Parte de los cobros esperados que entra a la proyección de caja. 100% = sin castigo; no se precarga ningún dato de mora de la empresa.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="plazo-def" className="text-sm font-bold">
              Plazo por defecto
            </label>
            <select id="plazo-def" value={plazo} onChange={(e) => setPlazo(e.target.value)} className={inputClass}>
              {[15, 20, 25, 30].map((t) => (
                <option key={t} value={t}>
                  {t} días
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">D-005: de 15 a 30 días por orden, contados desde el despacho. El vendedor lo ajusta en cada orden.</p>
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-sm font-bold">Cobranza automática</span>
            <div className="flex flex-wrap gap-2">
              {s.alertOffsets.map((o) => (
                <Chip key={o} tone="neutral">
                  {o < 0 ? `${-o} días antes` : o === 0 ? "El día" : `${o} días después (escala a administración)`}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted">Los mensajes salen por WhatsApp (n8n WF3) solo al contacto de prueba y se cancelan al aplicar el pago completo.</p>
          </div>
        </fieldset>
        {editable && (
          <Button className="mt-6" icon={<FloppyDisk size={16} weight="bold" />} onClick={save}>
            Guardar supuestos
          </Button>
        )}
      </Card>

      <TransferCard d={d} editable={editable} />
    </div>
  );
}

function TransferCard({ d, editable }: { d: ProfileDTO; editable: boolean }) {
  const me = useMe();
  const toast = useToast();
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-section font-bold">Precio de transferencia del taller</h2>
      <p className="mt-1 text-sm text-muted">Lo que el taller cobra internamente a la marca por cada pedido de producción propia. En el consolidado se elimina.</p>
      <ul className="mt-4 flex flex-col">
        {d.ownOrders.map((o) => (
          <TransferRow
            key={o.id}
            o={o}
            editable={editable}
            onSave={async (cents) => {
              const r = await commands.setInternalCharge(o.id, cents, me);
              toast(r.ok, r.message);
            }}
          />
        ))}
      </ul>
    </Card>
  );
}

function TransferRow({ o, editable, onSave }: { o: ProfileDTO["ownOrders"][number]; editable: boolean; onSave: (cents: number) => void }) {
  const [v, setV] = useState((o.internalChargeCents / 100).toFixed(2));
  useEffect(() => setV((o.internalChargeCents / 100).toFixed(2)), [o.internalChargeCents]);
  const cents = Math.round(Number(v) * 100);
  const result = Number.isFinite(cents) ? cents - o.costCents : 0;
  return (
    <li className="grid grid-cols-2 items-center gap-3 border-t border-line-soft py-3 first:border-t-0 sm:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
      <span className="col-span-2 min-w-0 sm:col-span-1">
        <span className="block font-bold">{o.ref}</span>
        <span className="block truncate text-[13px] text-muted">{o.customer}</span>
      </span>
      <span className="tabular text-[13px]">
        <span className="block text-xs text-muted">Costo</span>
        {formatMoney(o.costCents)}
      </span>
      <label className="flex flex-col text-[13px]">
        <span className="text-xs text-muted">Cargo interno (S/)</span>
        <input
          inputMode="decimal"
          disabled={!editable}
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="tabular h-9 rounded-lg bg-panel px-2.5 font-semibold outline-none ring-1 ring-line focus:ring-2 focus:ring-violet disabled:text-muted"
        />
      </label>
      <span className="tabular text-[13px]">
        <span className="block text-xs text-muted">Resultado taller</span>
        <span className={cx("font-bold", result < 0 ? "text-bad" : "text-ok")}>{formatMoney(result)}</span>
      </span>
      {editable && (
        <Button size="sm" variant="secondary" disabled={!Number.isFinite(cents) || cents === o.internalChargeCents} onClick={() => onSave(cents)}>
          Guardar
        </Button>
      )}
    </li>
  );
}
