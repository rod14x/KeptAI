import { CashFlowChart } from "./CashFlowChart";
import { buildWeeks } from "../../api/client";
import { createSeed } from "../../api/seed";

// Vista previa del login. Vive en su propio módulo para cargarse después del titular:
// así Recharts y la semilla no bloquean la primera pintura de la página.
const PREVIEW_WEEKS = buildWeeks(createSeed(), "consolidado");

export default function LoginPreviewChart() {
  return <CashFlowChart weeks={PREVIEW_WEEKS} compact />;
}
