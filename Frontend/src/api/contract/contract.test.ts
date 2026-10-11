import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { SCHEMAS_BY_NAME } from "./schemas";

// Valida los esquemas del frontend contra cada ejemplo de respuesta del contrato de Miguel
// (Backend/docs/openapi.yaml). Si el backend cambia un DTO, esta prueba lo detecta.

const yamlPath = fileURLToPath(new URL("../../../../Backend/docs/openapi.yaml", import.meta.url));
const doc = parse(readFileSync(yamlPath, "utf8"));
const examples: Record<string, { value: unknown }> = doc.components.examples;

type Case = { op: string; status: string; schema: string; example: string; value: unknown };
const cases: Case[] = [];
for (const [path, ops] of Object.entries<Record<string, any>>(doc.paths)) {
  for (const [method, op] of Object.entries<any>(ops)) {
    if (!["get", "post", "patch"].includes(method)) continue;
    if (path.includes("/ordenes/") || path.includes("/pagos/") || path.includes("/mensajes/")) continue; // n8n, no panel
    for (const [status, res] of Object.entries<any>(op.responses ?? {})) {
      if (!status.startsWith("2") || res.$ref) continue;
      for (const content of Object.values<any>(res.content ?? {})) {
        const schema = String(content.schema?.$ref ?? "").split("/").pop() ?? "";
        for (const [name, ex] of Object.entries<any>(content.examples ?? {})) {
          const value = ex.$ref ? examples[ex.$ref.split("/").pop()].value : ex.value;
          cases.push({ op: `${method.toUpperCase()} ${path}`, status, schema, example: name, value });
        }
      }
    }
  }
}

describe("contrato del panel (openapi.yaml)", () => {
  it("encuentra ejemplos para validar", () => {
    expect(cases.length).toBeGreaterThan(30);
  });

  it.each(cases.filter((c) => SCHEMAS_BY_NAME[c.schema]))("$op $status $schema · $example", (c) => {
    const result = SCHEMAS_BY_NAME[c.schema].safeParse(c.value);
    if (!result.success) console.error(c.op, c.example, JSON.stringify(result.error.issues, null, 1));
    expect(result.success).toBe(true);
  });

  it("cubre todos los esquemas de respuesta JSON del panel", () => {
    const missing = [...new Set(cases.map((c) => c.schema))].filter((s) => s && !SCHEMAS_BY_NAME[s]);
    expect(missing).toEqual([]);
  });
});
