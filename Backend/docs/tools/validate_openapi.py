"""Valida el contrato OpenAPI 3.1 de KeptAI (propuesta MIG-02).

1. Especificacion OpenAPI 3.1 valida y $ref resolubles (openapi-spec-validator).
2. Cada ejemplo (media types y components.examples) valida contra su esquema, con formatos (uuid, date, date-time, uri).
3. Reglas del contrato: operaciones propuestas, Idempotency-Key en POST, paginacion, sin organization_id del cliente, cuerpos cerrados.
4. Casos negativos: instancias que el esquema debe rechazar (importes fuera de rango, estado/valor inconsistente...).
"""
import sys
import yaml
from jsonschema import FormatChecker
from openapi_schema_validator import OAS31Validator
from openapi_spec_validator import validate
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

BASE = "urn:keptai:openapi"
errors = []


def fail(msg):
    errors.append(msg)


def load(path):
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def resolve_local(spec, ref):
    node = spec
    for part in ref.lstrip("#/").split("/"):
        node = node[part]
    return node


def schema_for(spec_registry, schema):
    if "$ref" in schema and len(schema) == 1:
        return {"$ref": BASE + schema["$ref"]}
    return schema


def validator(registry, schema):
    return OAS31Validator(schema, registry=registry, format_checker=FormatChecker())


def check_instance(registry, schema, instance, label):
    for err in sorted(validator(registry, schema).iter_errors(instance), key=lambda e: list(e.path)):
        fail(f"{label}: {'/'.join(map(str, err.path)) or '<raiz>'}: {err.message[:200]}")


def main(path):
    spec = load(path)
    validate(spec)  # lanza si la especificacion 3.1 o sus $ref son invalidos
    if not str(spec.get("openapi", "")).startswith("3.1"):
        fail("openapi debe ser 3.1.x")
    registry = Registry().with_resource(BASE, Resource.from_contents(spec, default_specification=DRAFT202012))

    used_examples = set()
    op_ids = set()
    n_examples = 0
    all_operations = dict(spec["paths"])
    all_operations.update({"WEBHOOK:"+k:v for k,v in spec.get("webhooks",{}).items()})
    for p, item in all_operations.items():
        for method, op in item.items():
            where = f"{method.upper()} {p}"
            oid = op.get("operationId")
            if not oid or oid in op_ids:
                fail(f"{where}: operationId ausente o repetido")
            op_ids.add(oid)
            for key in ("x-keptai-owner", "x-keptai-task", "x-keptai-proposed-roles"):
                if key not in op:
                    fail(f"{where}: falta {key}")
            if op.get("x-keptai-status") not in ("proposed", "implemented_local"):
                fail(f"{where}: x-keptai-status debe distinguir propuesta e implementación local")
            params = [resolve_local(spec, x["$ref"]) if "$ref" in x else x for x in op.get("parameters", [])]
            names = {x["name"] for x in params}
            if method == "post" and "Idempotency-Key" not in names and not op.get("x-keptai-idempotency") and op.get("x-keptai-direction") != "outbound":
                fail(f"{where}: POST sin Idempotency-Key")
            if ("limit" in names) != ("cursor" in names):
                fail(f"{where}: limit y cursor deben ir juntos")
            if method == "get" and p.rstrip("/").split("/")[-1][-1:] != "}" and "200" in op["responses"]:
                ok = op["responses"]["200"].get("content", {})
                if "application/json" in ok:
                    s = ok["application/json"]["schema"].get("$ref", "")
                    if s.endswith("Page") and "limit" not in names:
                        fail(f"{where}: lista paginada sin limit/cursor")
            if "organization_id" in names:
                fail(f"{where}: organization_id no puede ser parametro")
            body = op.get("requestBody")
            if body:
                for ct, media in body["content"].items():
                    ref = media["schema"].get("$ref")
                    target = resolve_local(spec, ref) if ref else media["schema"]
                    if target.get("additionalProperties") is not False:
                        fail(f"{where}: cuerpo {ref} debe tener additionalProperties:false")
                    if "organization_id" in target.get("properties", {}):
                        fail(f"{where}: cuerpo con organization_id")
            if "security" in op and op["security"] == []:
                fail(f"{where}: no puede ser publico")
            contents = []
            for code, resp in op["responses"].items():
                if "$ref" in resp:
                    resp = resolve_local(spec, resp["$ref"])
                for ct, media in resp.get("content", {}).items():
                    contents.append((f"{where} -> {code} {ct}", media))
            for ct, media in (body or {}).get("content", {}).items():
                contents.append((f"{where} request {ct}", media))
            for label, media in contents:
                for name, ex in media.get("examples", {}).items():
                    if "$ref" in ex:
                        used_examples.add(ex["$ref"].split("/")[-1])
                        ex = resolve_local(spec, ex["$ref"])
                    n_examples += 1
                    check_instance(registry, schema_for(registry, media["schema"]), ex["value"], f"{label} [{name}]")
    for name in spec["components"]["examples"]:
        if name not in used_examples:
            fail(f"components.examples.{name} no esta referenciado por ningun media type (no se validaria)")

    # el cliente nunca envia organization_id en ningun esquema de peticion
    for sname, s in spec["components"]["schemas"].items():
        if sname.endswith("Request") and "organization_id" in s.get("properties", {}):
            fail(f"{sname}: organization_id en peticion")

    # casos negativos: deben ser rechazados por el esquema
    def schema_ref(name):
        return {"$ref": f"{BASE}#/components/schemas/{name}"}

    pen = "PEN"
    negatives = [
        ("PositiveMoney", {"amount_cents": 0, "currency": pen}),
        ("PositiveMoney", {"amount_cents": -100, "currency": pen}),
        ("Money", {"amount_cents": 9007199254740992, "currency": pen}),
        ("Money", {"amount_cents": 10.5, "currency": pen}),
        ("Money", {"amount_cents": "100", "currency": pen}),
        ("Money", {"amount_cents": 100, "currency": "USD"}),
        ("Money", {"amount_cents": 100}),
        ("NonNegativeMoney", {"amount_cents": -1, "currency": pen}),
        ("ExtractedString", {"value": "algo", "status": "missing", "source_fragment": None, "human_corrected": False}),
        ("ExtractedString", {"value": None, "status": "present", "source_fragment": None, "human_corrected": False}),
        ("ConfirmDraftResponse", {"draft": None, "order_id": None, "payment_id": None, "funds_verified": True, "balance_changed": False}),
        ("ApplyPaymentRequest", {"receivable_id": "b0000000-0000-4000-8000-000000000002",
                                 "amount": {"amount_cents": 100, "currency": pen}, "organization_id": "x"}),
        ("CreateTextEvidenceRequest", {"content": ""}),
        ("CorrectDraftRequest", {"expected_revision": 1}),
        ("Order", {"id": "no-es-uuid"}),
        ("MarginRow", {"group_key": "P-9", "group_id": None, "production_mode": "own",
                       "revenue": {"amount_cents": 1, "currency": pen}, "total_cost": None, "margin": {"amount_cents": 0, "currency": pen},
                       "cost_status": "incomplete", "missing_cost_components": ["labor"], "orders_count": 1}),
    ]
    pay = resolve_local(spec, "#/components/examples/PaymentV002Received")["value"]
    negatives += [
        ("Payment", dict(pay, verification=resolve_local(spec, "#/components/examples/PaymentV001")["value"]["verification"])),
        ("Payment", dict(pay, status="duplicate")),
        ("Payment", dict(pay, status="applied")),
        ("ResultsSummary", dict(resolve_local(spec, "#/components/examples/ResultsSummaryDemo")["value"], cost_status="incomplete", missing_cost_components=["labor"])),
        ("CashForecast", dict(resolve_local(spec, "#/components/examples/CashForecastDemo")["value"], opening_cash=None)),
        ("CashForecast", dict(resolve_local(spec, "#/components/examples/CashForecastMissingOpening")["value"], forecast_status="complete")),
    ]
    for name, inst in negatives:
        if validator(registry, schema_ref(name)).is_valid(inst):
            fail(f"negativo aceptado indebidamente por {name}: {inst}")
    # un fecha-hora sin desfase y una fecha mal formada deben rechazarse
    ev = resolve_local(spec, "#/components/examples/EvidenceChat")["value"]
    for field, bad in (("created_at", "2026-10-09T09:30:00"), ("created_at", "09/10/2026")):
        inst = dict(ev, **{field: bad})
        if validator(registry, schema_ref("Evidence")).is_valid(inst):
            fail(f"Evidence acepto {field}={bad}")
    if validator(registry, {"$ref": f"{BASE}#/components/schemas/Order"}).is_valid(
            dict(resolve_local(spec, "#/components/examples/OrderP001")["value"], due_date="2026-13-45")):
        fail("Order acepto due_date invalida")

    print(f"operaciones: {len(op_ids)}; ejemplos validados: {n_examples}; casos negativos: {len(negatives) + 3}")
    if errors:
        print(f"FALLA: {len(errors)} problema(s)")
        for e in errors:
            print(" -", e)
        return 1
    print("OK: OpenAPI 3.1 valida, ejemplos coherentes con sus esquemas, reglas del contrato cumplidas.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "../openapi.yaml"))
