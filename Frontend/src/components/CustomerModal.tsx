import { useState, type FormEvent } from "react";
import { Modal, inputClass } from "./ui/Modal";
import { Button } from "./ui/Button";
import { WarningCircle, UserPlus } from "./ui/icons";
import { useToast } from "../context/ToastContext";
import { useMe } from "../context/AuthContext";
import { commands, type CustomerInput, type CustomerRow, type CustomerType, type CustomerOriginChannel } from "../api/client";
import { cx } from "../lib/format";

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (customer: { id: string; name: string; rucDni?: string | null }) => void;
  existingCustomers?: CustomerRow[];
}

export function CustomerModal({ open, onClose, onCreated, existingCustomers = [] }: CustomerModalProps) {
  const me = useMe();
  const toast = useToast();

  const [tipoPersona, setTipoPersona] = useState<CustomerType>("EMPRESA");
  const [razonSocial, setRazonSocial] = useState("");
  const [rucDni, setRucDni] = useState("");
  const [telefonoPrincipal, setTelefonoPrincipal] = useState("");
  const [canalOrigen, setCanalOrigen] = useState<CustomerOriginChannel>("TIENDA");
  const [limiteCredito, setLimiteCredito] = useState("");

  const [docWarning, setDocWarning] = useState<string | null>(null);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validación anti-duplicados en tiempo real (onBlur) buscando coincidencias existentes (RG-05)
  const handleDocBlur = () => {
    const doc = rucDni.trim().replace(/\D/g, "");
    if (!doc) {
      setDocWarning(null);
      setIsDuplicate(false);
      return;
    }

    if (tipoPersona === "PERSONA" && doc.length !== 8) {
      setDocWarning("El DNI debe tener 8 dígitos numéricos.");
      setIsDuplicate(true);
      return;
    }

    if (tipoPersona !== "PERSONA" && doc.length !== 11 && doc.length !== 8) {
      setDocWarning("El RUC debe tener 11 dígitos numéricos.");
      setIsDuplicate(true);
      return;
    }

    const match = existingCustomers.find((c) => {
      const existingDoc = (c.rucDni ?? "").replace(/\D/g, "");
      return existingDoc && existingDoc === doc;
    });

    if (match) {
      setDocWarning(`⚠️ Ya existe un cliente registrado con este documento: "${match.name}".`);
      setIsDuplicate(true);
    } else {
      setDocWarning(null);
      setIsDuplicate(false);
    }
  };

  const handlePhoneBlur = () => {
    const raw = telefonoPrincipal.trim().replace(/\D/g, "");
    if (!raw) {
      setPhoneWarning(null);
      return;
    }

    if (raw.length < 7) {
      setPhoneWarning("El teléfono debe tener al menos 7 dígitos.");
      return;
    }

    const match = existingCustomers.find((c) => {
      const existingPhone = ((c as any).telefonoPrincipal ?? (c as any).contactoWhatsapp ?? "").replace(/\D/g, "");
      return existingPhone && existingPhone.length >= 7 && (existingPhone.endsWith(raw) || raw.endsWith(existingPhone));
    });

    if (match) {
      setPhoneWarning(`⚠️ Este teléfono coincide con el cliente "${match.name}".`);
    } else {
      setPhoneWarning(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isDuplicate) {
      setErrorMsg("No se puede registrar: resuelve los duplicados o errores en el documento.");
      return;
    }

    if (!razonSocial.trim()) {
      setErrorMsg("Ingresa la razón social o nombre del cliente.");
      return;
    }

    if (!rucDni.trim()) {
      setErrorMsg("Ingresa el RUC o DNI del cliente.");
      return;
    }

    if (!telefonoPrincipal.trim()) {
      setErrorMsg("Ingresa el teléfono principal.");
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    const creditCents = limiteCredito.trim() ? Math.round(Number(limiteCredito.replace(",", ".")) * 100) : 0;

    const payload: CustomerInput = {
      tipoPersona,
      razonSocial: razonSocial.trim(),
      rucDni: rucDni.trim(),
      telefonoPrincipal: telefonoPrincipal.trim(),
      canalOrigen,
      limiteCreditoCents: creditCents > 0 ? creditCents : undefined,
      brand: me.brand ?? "corpotex",
    };

    const res = await commands.createCustomer(payload, me);
    setBusy(false);

    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }

    toast(true, res.message);
    onCreated?.({
      id: res.id ?? `CUS-${Date.now()}`,
      name: razonSocial.trim(),
      rucDni: rucDni.trim(),
    });

    // Limpiar formulario y cerrar
    setRazonSocial("");
    setRucDni("");
    setTelefonoPrincipal("");
    setLimiteCredito("");
    setDocWarning(null);
    setPhoneWarning(null);
    setIsDuplicate(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo cliente comercial"
      subtitle="Alta inmediata en directorio corporativo con validación anti-duplicados (D-014 / Fase 1)"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Tipo de cliente */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-ink">Tipo de cliente</label>
          <div className="grid grid-cols-3 gap-2">
            {(["EMPRESA", "PERSONA", "COLEGIO"] as CustomerType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTipoPersona(t);
                  setDocWarning(null);
                  setIsDuplicate(false);
                }}
                className={cx(
                  "flex items-center justify-center rounded-lg border py-2 text-xs font-bold transition-all",
                  tipoPersona === t
                    ? "border-brand-blue bg-brand-blue/10 text-brand-blue shadow-xs"
                    : "border-line bg-panel text-muted hover:text-ink hover:bg-card"
                )}
              >
                {t === "EMPRESA" ? "🏢 Empresa" : t === "PERSONA" ? "👤 Persona" : "🏫 Colegio"}
              </button>
            ))}
          </div>
        </div>

        {/* Razón Social */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-razon" className="text-[13px] font-semibold text-ink">
            {tipoPersona === "PERSONA" ? "Nombre completo del cliente" : "Razón social o Institución"}
          </label>
          <input
            id="c-razon"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            placeholder={tipoPersona === "PERSONA" ? "Ej. Juan Pérez Quispe" : "Ej. Corpotex Textil S.A.C."}
            className={inputClass}
          />
        </div>

        {/* RUC / DNI con validación onBlur */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="c-doc" className="text-[13px] font-semibold text-ink">
              {tipoPersona === "PERSONA" ? "DNI (8 dígitos)" : "RUC (11 dígitos)"}
            </label>
            <span className="text-[11px] text-muted">Validación anti-duplicados</span>
          </div>
          <input
            id="c-doc"
            value={rucDni}
            onChange={(e) => {
              setRucDni(e.target.value);
              if (docWarning) setDocWarning(null);
              if (isDuplicate) setIsDuplicate(false);
            }}
            onBlur={handleDocBlur}
            placeholder={tipoPersona === "PERSONA" ? "74581234" : "20601234567"}
            className={cx(inputClass, docWarning && "border-bad focus:border-bad focus:ring-bad")}
          />
          {docWarning && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-bad">
              <WarningCircle size={14} weight="bold" /> {docWarning}
            </p>
          )}
        </div>

        {/* Teléfono principal y Canal de origen */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="c-tel" className="text-[13px] font-semibold text-ink">
              Teléfono / WhatsApp principal
            </label>
            <input
              id="c-tel"
              value={telefonoPrincipal}
              onChange={(e) => {
                setTelefonoPrincipal(e.target.value);
                if (phoneWarning) setPhoneWarning(null);
              }}
              onBlur={handlePhoneBlur}
              placeholder="+51 987 654 321"
              className={cx(inputClass, phoneWarning && "border-warn focus:border-warn")}
            />
            {phoneWarning && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
                <WarningCircle size={14} weight="bold" /> {phoneWarning}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="c-canal" className="text-[13px] font-semibold text-ink">
              Canal de origen
            </label>
            <select
              id="c-canal"
              value={canalOrigen}
              onChange={(e) => setCanalOrigen(e.target.value as CustomerOriginChannel)}
              className={inputClass}
            >
              <option value="TIENDA">Tienda presencial / Mostrador</option>
              <option value="WHATSAPP">WhatsApp comercial</option>
              <option value="REDES">Redes sociales (Instagram/FB)</option>
              <option value="MANUAL">Carga administrativa manual</option>
            </select>
          </div>
        </div>

        {/* Límite de crédito opcional */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-credito" className="text-[13px] font-semibold text-ink">
            Límite de crédito sugerido (S/) <span className="text-xs font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="c-credito"
            inputMode="decimal"
            value={limiteCredito}
            onChange={(e) => setLimiteCredito(e.target.value)}
            placeholder="0.00"
            className={cx(inputClass, "tabular")}
          />
          <p className="text-[11px] text-muted">
            Administración evalúa y autoriza la línea comercial según D-014.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-bad-tint p-3 text-xs font-medium text-bad">
            {errorMsg}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={isDuplicate}
            icon={<UserPlus size={16} weight="bold" />}
          >
            Guardar cliente
          </Button>
        </div>
      </form>
    </Modal>
  );
}
