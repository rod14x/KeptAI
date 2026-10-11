import type { Role } from "../../api/model";
import { Bell, ChartPieSlice, Factory, Kanban, Receipt, SquaresFour, UploadSimple, UsersThree } from "../ui/icons";
import { can } from "../../lib/permissions";
import type { ModuleKey } from "../../lib/availability";

// Entradas del menú principal y su módulo. Separado de Sidebar para que el inicio y las pruebas no importen la fachada de datos.
export const NAV: Array<{ to: string; label: string; icon: typeof SquaresFour; end: boolean; module: ModuleKey; show?: (r: Role) => boolean }> = [
  { to: "/", label: "Dashboard", icon: SquaresFour, end: true, module: "inicio", show: (r) => can(r, "ver_comercial") },
  { to: "/pedidos", label: "Pedidos", icon: Kanban, end: false, module: "pedidos", show: (r) => can(r, "ver_comercial") },
  { to: "/clientes", label: "Clientes", icon: UsersThree, end: false, module: "clientes", show: (r) => can(r, "ver_comercial") },
  { to: "/conciliacion", label: "Conciliación", icon: Receipt, end: false, module: "conciliacion", show: (r) => can(r, "verificar") || can(r, "ver_pagos") },
  { to: "/cobranza", label: "Cobranza", icon: Bell, end: false, module: "cobranza", show: (r) => can(r, "ver_cobranza") },
  { to: "/taller", label: "Taller", icon: Factory, end: false, module: "taller", show: (r) => can(r, "registrar_despacho") || can(r, "ver_resultado") },
  { to: "/captura", label: "Carga manual", icon: UploadSimple, end: false, module: "captura", show: (r) => can(r, "captura") },
  { to: "/resultado", label: "Resultado", icon: ChartPieSlice, end: false, module: "resultado", show: (r) => can(r, "ver_resultado") },
];
