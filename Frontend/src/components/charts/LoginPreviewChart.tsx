import { CashFlowChart } from "./CashFlowChart";
import { buildWeeks } from "../../api/mock/source";
import { createSeed } from "../../api/mock/seed";

// MOCK: vista previa decorativa del login, calculada con la semilla de demostración (no hay sesión
// todavía, así que no puede leer la API). Vive en su propio módulo para cargarse después del titular.
const PREVIEW_WEEKS = buildWeeks(createSeed(), "consolidado");

export default function LoginPreviewChart() {
  return <CashFlowChart weeks={PREVIEW_WEEKS} compact />;
}
