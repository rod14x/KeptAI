import { useState, type FormEvent } from "react";
import { Modal, inputClass } from "./ui/Modal";
import { Button } from "./ui/Button";
import { WarningCircle, CheckCircle, UsersThree } from "./ui/icons";
import { useToast } from "../context/ToastContext";
import { useMe } from "../context/AuthContext";
import { updateCustomer, reassignPortfolio, mergeCustomers, type CustomerView, type UpdateCustomerInput } from "../api/client";
import { cx } from "../lib/format";

export function EditCustomerModal({
  open,
  onClose,
  customer,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  customer: CustomerView;
  onUpdated: () => void;
}) {
  const me = useMe();
  const toast = useToast();
  const isVendedor = me.role === "vendedor";

  const [razonSocial, setRazonSocial] = useState(customer.name);
  const [rucDni, setRucDni] = useState(customer.rucDni ?? "");
  const [telefonoPrincipal, setTelefonoPrincipal] = useState(customer.contactoWhatsapp ?? "");
  const [emailContacto, setEmailContacto] = useState(customer.emailContacto ?? "");
  const [direccion, setDireccion] = useState(customer.direccion ?? "");
  const [limiteCredito, setLimiteCredito] = useState(
    customer.creditLimitCents != null ? (customer.creditLimitCents / 100).toString() : ""
  );
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mergeRequired, setMergeRequired] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMergeRequired(false);

    if (!motivo.trim()) {
      setErrorMsg("Debes ingresar el motivo de la modificación para auditoría de cambios.");
      return;
    }

    setBusy(true);
    const creditCents = limiteCredito.trim() ? Math.round(Number(limiteCredito.replace(",", ".")) * 100) : undefined;

    const payload: UpdateCustomerInput = {
      razonSocial: isVendedor ? undefined : razonSocial.trim(),
      rucDni: isVendedor ? undefined : rucDni.trim(),
      telefonoPrincipal: telefonoPrincipal.trim(),
      emailContacto: emailContacto.trim() || undefined,
      direccion: direccion.trim() || undefined,
      limiteCreditoCents: isVendedor ? undefined : creditCents,
      motivo: motivo.trim(),
    };

    const res = await updateCustomer(customer.id, payload, me);
    setBusy(false);

    if (!res.ok) {
      if (res.message.includes("RUC_HAS_INVOICES_MERGE_REQUIRED")) {
        setMergeRequired(true);
      }
      setErrorMsg(res.message);
      return;
    }

    toast(true, res.message);
    onUpdated();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isVendedor ? "Editar datos de contacto" : "Editar cliente comercial"}
      subtitle={
        isVendedor
          ? "Como vendedor, puedes actualizar teléfono, email y dirección del cliente. RUC y razón social solo los edita Administración."
          : "Modificación de datos maestros de cliente con registro de auditoría."
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Razón Social */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center justify-between text-[13px] font-semibold text-ink">
            <span>Razón social / Nombre</span>
            {isVendedor && <span className="text-[11px] font-normal text-muted">Solo lectura (Administración)</span>}
          </label>
          <input
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            disabled={isVendedor}
            className={cx(inputClass, isVendedor && "bg-panel text-muted cursor-not-allowed opacity-80")}
          />
        </div>

        {/* RUC / DNI */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center justify-between text-[13px] font-semibold text-ink">
            <span>RUC (11 dígitos) o DNI (8 dígitos)</span>
            {isVendedor && <span className="text-[11px] font-normal text-muted">Solo lectura (Administración)</span>}
          </label>
          <input
            value={rucDni}
            onChange={(e) => setRucDni(e.target.value)}
            disabled={isVendedor}
            className={cx(inputClass, isVendedor && "bg-panel text-muted cursor-not-allowed opacity-80")}
          />
        </div>

        {/* Teléfono y Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink">Teléfono / WhatsApp</label>
            <input
              value={telefonoPrincipal}
              onChange={(e) => setTelefonoPrincipal(e.target.value)}
              placeholder="+51 987 654 321"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink">Email de facturación/contacto</label>
            <input
              type="email"
              value={emailContacto}
              onChange={(e) => setEmailContacto(e.target.value)}
              placeholder="contacto@empresa.pe"
              className={inputClass}
            />
          </div>
        </div>

        {/* Dirección */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-ink">Dirección física / fiscal</label>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Av. Los Confeccionistas 123, Piura"
            className={inputClass}
          />
        </div>

        {/* Límite de crédito (solo admin) */}
        {!isVendedor && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink">Límite de crédito comercial (S/)</label>
            <input
              inputMode="decimal"
              value={limiteCredito}
              onChange={(e) => setLimiteCredito(e.target.value)}
              placeholder="0.00"
              className={cx(inputClass, "tabular")}
            />
          </div>
        )}

        {/* Motivo del cambio (obligatorio para auditoría) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-ink">
            Motivo del cambio <span className="text-bad">*</span>
          </label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Actualización de teléfono por cambio de número de contacto"
            className={inputClass}
            required
          />
          <p className="text-[11px] text-muted">Quedará registrado en la auditoría con tu usuario y fecha.</p>
        </div>

        {mergeRequired && (
          <div className="rounded-xl border border-warn/40 bg-warn-tint p-3.5 text-xs text-warn">
            <p className="font-bold flex items-center gap-1.5">
              <WarningCircle size={15} weight="bold" /> Trazabilidad SUNAT: RUC con comprobantes previos
            </p>
            <p className="mt-1 text-ink">
              Este cliente ya tiene facturas, órdenes o comprobantes aplicados. Por consistencia tributaria no se puede
              modificar directamente su RUC. Si se registró un duplicado, utiliza la acción de <strong>Fusión de Clientes</strong>.
            </p>
          </div>
        )}

        {errorMsg && !mergeRequired && (
          <div className="rounded-xl bg-bad-tint p-3 text-xs font-medium text-bad">{errorMsg}</div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy} icon={<CheckCircle size={16} weight="bold" />}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ReassignPortfolioModal({
  open,
  onClose,
  customer,
  onUpdated,
  sellers,
}: {
  open: boolean;
  onClose: () => void;
  customer: CustomerView;
  onUpdated: () => void;
  sellers: Array<{ id: string; name: string }>;
}) {
  const me = useMe();
  const toast = useToast();

  const [nuevoVendedorId, setNuevoVendedorId] = useState(sellers[0]?.id ?? "");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nuevoVendedorId) {
      setErrorMsg("Selecciona el nuevo vendedor responsable de la cartera.");
      return;
    }
    if (!motivo.trim()) {
      setErrorMsg("Ingresa el motivo de la reasignación de cartera.");
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    const res = await reassignPortfolio(customer.id, nuevoVendedorId, motivo.trim(), me);
    setBusy(false);

    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }

    toast(true, res.message);
    onUpdated();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reasignar cartera comercial (B-02)"
      subtitle={`Asigna a un nuevo vendedor responsable de la relación con "${customer.name}". Los pedidos anteriores conservan su vendedor de cierre original.`}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-ink">Nuevo vendedor asignado</label>
          <select
            value={nuevoVendedorId}
            onChange={(e) => setNuevoVendedorId(e.target.value)}
            className={inputClass}
          >
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-ink">
            Motivo de la reasignación <span className="text-bad">*</span>
          </label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Reorganización zonal de cuentas / cambio de asesor"
            className={inputClass}
            required
          />
        </div>

        {errorMsg && <div className="rounded-xl bg-bad-tint p-3 text-xs font-medium text-bad">{errorMsg}</div>}

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy} icon={<UsersThree size={16} weight="bold" />}>
            Reasignar cartera
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function MergeCustomerModal({
  open,
  onClose,
  customer,
  onUpdated,
  allCustomers,
}: {
  open: boolean;
  onClose: () => void;
  customer: CustomerView;
  onUpdated: () => void;
  allCustomers: Array<{ id: string; name: string; rucDni?: string | null }>;
}) {
  const me = useMe();
  const toast = useToast();

  const candidates = allCustomers.filter((c) => c.id !== customer.id);
  const [targetId, setTargetId] = useState(candidates[0]?.id ?? "");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      setErrorMsg("Selecciona el cliente de destino para unificar los datos.");
      return;
    }
    if (!motivo.trim()) {
      setErrorMsg("Ingresa el motivo de la fusión.");
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    const res = await mergeCustomers(customer.id, targetId, motivo.trim(), me);
    setBusy(false);

    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }

    toast(true, res.message);
    onUpdated();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fusión de clientes duplicados (B-01)"
      subtitle={`Consolida "${customer.name}" dentro de otro cliente existente. Sus pedidos, contactos y pagos se reasignarán al cliente destino, y este registro quedará inactivo.`}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="rounded-xl bg-panel p-3 text-xs text-ink-soft ring-1 ring-line">
          <p className="font-semibold text-ink">Cliente a consolidar (se desactivará):</p>
          <p className="mt-0.5">{customer.name} · RUC/DNI {customer.rucDni ?? "s/d"}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-ink">Cliente principal de destino</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputClass}>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.rucDni ? `(RUC/DNI: ${c.rucDni})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-ink">
            Motivo de la fusión <span className="text-bad">*</span>
          </label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Registro duplicado con error de tipeo en razón social"
            className={inputClass}
            required
          />
        </div>

        {errorMsg && <div className="rounded-xl bg-bad-tint p-3 text-xs font-medium text-bad">{errorMsg}</div>}

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Confirmar fusión
          </Button>
        </div>
      </form>
    </Modal>
  );
}
