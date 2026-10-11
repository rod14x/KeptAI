import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { useNavigate, useSearchParams } from "react-router";
import { Image, Info, Receipt, UploadSimple, NotePencil } from "../components/ui/icons";
import { capabilities, commands, getCaptureOptions } from "../api/client";
import type { Brand } from "../api/model";
import { useApi } from "../hooks/useApi";
import { IS_MOCK } from "../config";
import { useMe } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Stagger, itemVariants } from "../components/motion/primitives";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Card, DemoBadge } from "../components/ui/States";
import { Button } from "../components/ui/Button";
import { inputClass } from "../components/ui/Modal";
import { cx } from "../lib/format";

// Respaldo de la entrada por WhatsApp (D-005): la extracción automática corre en n8n.
// - mock: una persona tipea los datos del voucher o del pedido (origen "manual").
// - api: se sube la imagen (POST /evidences/files) y se pide la extracción; el borrador se revisa antes de confirmar.
//   El alta manual de pedidos no existe en el contrato (createTextEvidence está fuera del MVP).

type Tab = "comprobante" | "orden";
const CHANNELS = ["Yape", "Plin", "Transferencia BCP", "Transferencia BBVA", "Transferencia Interbank", "Depósito en cuenta"];

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function CapturaPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tipo") === "orden" && capabilities.manualOrderCapture ? "orden" : "comprobante";
  return (
    <Stagger className="mx-auto flex max-w-[860px] flex-col gap-6">
      <PageHeader title="Subir comprobante" subtitle="Respaldo cuando WhatsApp no trae el dato. Lo que cargues aquí pasa por la misma revisión que lo que lee la IA." actions={IS_MOCK ? <DemoBadge /> : undefined} />
      <motion.p variants={itemVariants} className="flex items-start gap-2 rounded-2xl bg-info-tint px-4 py-3 text-[13px] text-info">
        <Info size={18} weight="bold" className="mt-px shrink-0" />
        En la operación normal, el vendedor escribe /cerrar y n8n arma la hoja de resumen; el cliente envía su voucher y n8n lo lee.{" "}
        {capabilities.voucherNeedsFile ? "Aquí subes la imagen del voucher y la IA propone los datos para revisar." : "Esta pantalla no usa IA: tú escribes los datos."}
      </motion.p>
      {capabilities.manualOrderCapture && (
      <motion.div variants={itemVariants}>
        <Segmented
          kind="tab"
          label="Qué vas a cargar"
          value={tab}
          onChange={(t) => setParams(t === "orden" ? { tipo: "orden" } : {})}
          options={[
            { value: "comprobante", label: "Comprobante de pago" },
            { value: "orden", label: "Pedido" },
          ]}
        />
      </motion.div>
      )}
      <Stagger key={tab}>{tab === "comprobante" ? <VoucherForm /> : <OrderForm />}</Stagger>
    </Stagger>
  );
}

function useBrands(): { brands: Brand[]; locked: boolean } {
  const me = useMe();
  return me.role === "vendedor" && me.brand ? { brands: [me.brand], locked: true } : { brands: ["corpotex", "unicrack"], locked: false };
}

function VoucherForm() {
  const me = useMe();
  const toast = useToast();
  const navigate = useNavigate();
  const { brands, locked } = useBrands();
  const [brand, setBrand] = useState<Brand>(brands[0]);
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [payer, setPayer] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsFile = capabilities.voucherNeedsFile;

  const orders = useApi(() => getCaptureOptions(brand), [brand]).data?.orders ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount.replace(",", "."));
    setBusy(true);
    const r = await commands.captureVoucher(
      {
        brand,
        orderId: orderId || null,
        amountCents: Number.isFinite(n) ? Math.round(n * 100) : 0,
        operationRef: ref,
        payer,
        paidAt: paidAt ? paidAt.split("T").map((p, i) => (i === 0 ? p.split("-").reverse().join("/") : p)).join(" ") : "",
        channel,
        file,
      },
      me,
    );
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    toast(true, r.message);
    // En la API el resultado es una evidencia en extracción, todavía no un pago: se vuelve a la cola.
    navigate(needsFile ? "/conciliacion" : `/conciliacion/${r.id ?? ""}`);
  };

  return (
    <Card className="p-5 sm:p-7">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <h2 className="flex items-center gap-2 text-section font-bold">
          <Receipt size={20} className="text-violet" /> Comprobante de pago
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {!needsFile && (
          <>
          <Field id="v-brand" label="Marca">
            <select id="v-brand" value={brand} disabled={locked} onChange={(e) => setBrand(e.target.value as Brand)} className={inputClass}>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b === "corpotex" ? "Corpotex" : "Unicrack"}
                </option>
              ))}
            </select>
          </Field>
          <Field id="v-order" label="Orden (opcional)" hint="Si no la conoces, Administración la vincula en conciliación.">
            <select id="v-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inputClass}>
              <option value="">Sin orden por ahora</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="v-amount" label="Monto (S/)">
            <input id="v-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={cx(inputClass, "tabular")} />
          </Field>
          <Field id="v-ref" label="N.° de operación">
            <input id="v-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ej. 00927714" className={cx(inputClass, "tabular")} />
          </Field>
          <Field id="v-payer" label="Remitente">
            <input id="v-payer" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Nombre que figura en el voucher" className={inputClass} />
          </Field>
          <Field id="v-channel" label="Banco o billetera">
            <select id="v-channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field id="v-paid" label="Fecha y hora del pago">
            <input id="v-paid" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={cx(inputClass, "tabular")} />
          </Field>
          </>
          )}
          <Field
            id="v-file"
            label={needsFile ? "Imagen del voucher" : "Imagen del voucher (opcional)"}
            hint={needsFile ? "Se guarda en Supabase Storage privado y la IA extrae monto, operación y remitente." : "Solo vista previa en la demo."}
          >
            <label
              htmlFor="v-file"
              className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-block)] border border-dashed border-line bg-panel text-[13px] font-semibold text-muted transition-colors hover:bg-line-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet sm:h-11"
            >
              <Image size={18} /> {preview ? "Cambiar imagen" : "Elegir imagen"}
              <input
                id="v-file"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview(f ? URL.createObjectURL(f) : null);
                }}
              />
            </label>
          </Field>
        </div>
        {preview && <img src={preview} alt="Vista previa del voucher" className="max-h-64 w-fit rounded-2xl object-contain ring-1 ring-line" />}
        {err && (
          <p role="alert" className="rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
            {err}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy} disabled={needsFile && !file} icon={<UploadSimple size={18} weight="bold" />} className="w-full sm:w-auto sm:self-end">
          {needsFile ? "Subir y extraer datos" : "Registrar como recibido"}
        </Button>
      </form>
    </Card>
  );
}

function OrderForm() {
  const me = useMe();
  const toast = useToast();
  const navigate = useNavigate();
  const { brands } = useBrands();
  const customers = useApi(() => getCaptureOptions(brands[0]), [brands[0]]).data?.customers ?? [];
  const [picked, setCustomerId] = useState("");
  const customerId = picked || customers[0]?.id || "";
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [total, setTotal] = useState("");
  const [entrega, setEntrega] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = Number(total.replace(",", "."));
    const r = await commands.captureOrder({ customerId, description, cantidad: Number(qty) || 0, totalCents: Number.isFinite(t) ? Math.round(t * 100) : 0, entrega: entrega || null }, me);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    toast(true, r.message);
    navigate(`/pedidos/${r.id ?? ""}`);
  };

  return (
    <Card className="p-5 sm:p-7">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <h2 className="flex items-center gap-2 text-section font-bold">
          <NotePencil size={20} className="text-violet" /> Pedido
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="o-customer" label="Cliente">
            <select id="o-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="o-entrega" label="Entrega solicitada">
            <input id="o-entrega" type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className={cx(inputClass, "tabular")} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="o-desc" label="Qué pidió">
              <input id="o-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Polos piqué con logo bordado" className={inputClass} />
            </Field>
          </div>
          <Field id="o-qty" label="Cantidad">
            <input id="o-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className={cx(inputClass, "tabular")} />
          </Field>
          <Field id="o-total" label="Total (S/)">
            <input id="o-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" className={cx(inputClass, "tabular")} />
          </Field>
        </div>
        <p className="text-xs text-muted">Se crea como borrador por confirmar. El vendedor define la condición de pago; los costos se registran después.</p>
        {err && (
          <p role="alert" className="rounded-xl bg-bad-tint px-3.5 py-2.5 text-[13px] font-medium text-bad">
            {err}
          </p>
        )}
        <Button type="submit" size="lg" icon={<UploadSimple size={18} weight="bold" />} className="w-full sm:w-auto sm:self-end">
          Crear borrador
        </Button>
      </form>
    </Card>
  );
}
