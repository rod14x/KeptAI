import { Link } from "react-router";
import { EmptyState } from "../components/ui/States";
import { MODULE_LABEL, type ModuleKey } from "../lib/availability";

/** Destino de las rutas de módulos pendientes en modo api: no carga datos ni importa la pantalla de negocio. */
export function ModuloNoDisponiblePage({ module }: { module: ModuleKey }) {
  return (
    <div className="mx-auto max-w-md py-16" data-testid="modulo-no-disponible">
      <EmptyState title={`${MODULE_LABEL[module]} aún no está disponible`}>
        Este módulo depende de endpoints del backend que todavía no están implementados, así que no se consulta ni se muestra información.{" "}
        <Link to="/" className="font-semibold text-violet-ink underline">
          Volver al inicio
        </Link>
      </EmptyState>
    </div>
  );
}
