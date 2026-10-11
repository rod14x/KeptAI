import { IS_MOCK } from "../config";
import { apiSource } from "./contract/source";
import { mockSource } from "./mock/source";
import type { DataSource } from "./dto";

// Fachada única de datos para las pantallas. VITE_API_MODE elige la fuente:
// "mock" (semilla local, por defecto) o "api" (Spring, contrato Backend/docs/openapi.yaml).

export const source: DataSource = IS_MOCK ? mockSource : apiSource;

export const capabilities = source.capabilities;
export const commands = source.commands;
export const getDashboard: DataSource["getDashboard"] = (...a) => source.getDashboard(...a);
export const getOrderBoard: DataSource["getOrderBoard"] = (...a) => source.getOrderBoard(...a);
export const getOrders: DataSource["getOrders"] = (...a) => source.getOrders(...a);
export const getOrder: DataSource["getOrder"] = (...a) => source.getOrder(...a);
export const getTaller: DataSource["getTaller"] = (...a) => source.getTaller(...a);
export const getQueue: DataSource["getQueue"] = (...a) => source.getQueue(...a);
export const getEvidence: DataSource["getEvidence"] = (...a) => source.getEvidence(...a);
export const getCobranza: DataSource["getCobranza"] = (...a) => source.getCobranza(...a);
export const getCustomers: DataSource["getCustomers"] = (...a) => source.getCustomers(...a);
export const getCustomer: DataSource["getCustomer"] = (...a) => source.getCustomer(...a);
export const getStatement: DataSource["getStatement"] = (...a) => source.getStatement(...a);
export const getResults: DataSource["getResults"] = (...a) => source.getResults(...a);
export const ordersCsv: DataSource["ordersCsv"] = (...a) => source.ordersCsv(...a);
export const getProfile: DataSource["getProfile"] = (...a) => source.getProfile(...a);
export const search: DataSource["search"] = (...a) => source.search(...a);
export const getCaptureOptions: DataSource["getCaptureOptions"] = (...a) => source.getCaptureOptions(...a);

export * from "./dto";
export { IN_REVIEW, PLAZO_MAX, PLAZO_MIN } from "./model";
