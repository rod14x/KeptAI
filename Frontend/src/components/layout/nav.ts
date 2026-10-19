import type { Role } from "../../api/model";
import { NAV_BY_ROLE, type NavItem } from "./Sidebar";

export { NAV_BY_ROLE };

// Fuente unificada con NAV_BY_ROLE en Sidebar.tsx (Fase 0).
export const NAV: Array<NavItem & { show?: (r: Role) => boolean }> = Array.from(
  new Map(
    Object.values(NAV_BY_ROLE)
      .flat()
      .map((item) => [item.to, item])
  ).values()
);
