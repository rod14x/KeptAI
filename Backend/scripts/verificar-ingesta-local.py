#!/usr/bin/env python3
"""Comprobación HTTP LOCAL de POST /api/v1/ordenes/ingesta (MIG-03-D3) contra una instancia PROPIA de Spring.

- Lee las claves X-Api-Key desde ARCHIVOS (nunca por argumento); no las imprime ni registra cuerpos: solo estado HTTP y PASA/FALLA.
- Usa datos FICTICIOS (ejemplo N8nIngestaParseFailure del OpenAPI con un marcador de transcript) y valida la petición y la
  respuesta 200 contra los esquemas de Backend/docs/openapi.yaml.
- La respuesta honesta de hoy es 200 VALIDADO_SIN_PERSISTIR (persistido=false, procesado=false); no hay 201 ni orden.
Uso (con el intérprete de Backend/docs/tools/.venv, que trae PyYAML y jsonschema):
  verificar-ingesta-local.py --base-url http://127.0.0.1:8082 --instancia isabel --key-ingesta F --key-scheduler F --key-otra F
  verificar-ingesta-local.py --base-url ... --instancia isabel --solo-estado F --esperar 200|401
"""
import argparse, copy, http.client, json, os, re, sys, urllib.parse, uuid

import jsonschema, yaml

SENTINEL = "TRANSCRIPT_FICTICIO_D3_NO_DEBE_APARECER"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def read_key(path):
    st = os.stat(path)
    if st.st_mode & 0o077:
        sys.exit("El archivo de clave debe tener permisos 600.")
    return open(path, "rb").read().rstrip(b"\r\n").decode("ascii")


def call(base, method, path, body=None, headers=None, raw_headers=None):
    u = urllib.parse.urlparse(base)
    c = http.client.HTTPConnection(u.hostname, u.port, timeout=20)
    c.putrequest(method, path)
    for k, v in (headers or {}).items():
        c.putheader(k, v)
    for k, v in (raw_headers or []):  # permite repetir una cabecera
        c.putheader(k, v)
    data = body.encode("utf-8") if isinstance(body, str) else body
    if data is not None:
        c.putheader("Content-Length", str(len(data)))
    c.endheaders(data)
    r = c.getresponse()
    payload = r.read()
    out = (r.status, dict((k.lower(), v) for k, v in r.getheaders()), payload)
    c.close()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--instancia", required=True)
    ap.add_argument("--key-ingesta")
    ap.add_argument("--key-scheduler")
    ap.add_argument("--key-otra")
    ap.add_argument("--solo-estado")
    ap.add_argument("--esperar", type=int)
    a = ap.parse_args()

    doc = yaml.safe_load(open(os.path.join(ROOT, "docs", "openapi.yaml"), encoding="utf-8"))
    op = doc["paths"]["/api/v1/ordenes/ingesta"]["post"]
    req_schema = {"$ref": "#/components/schemas/N8nIngestaOrdenRequest", "components": doc["components"]}
    ok_schema = {**op["responses"]["200"]["content"]["application/json"]["schema"], "components": doc["components"]}
    err_schema = {"$ref": "#/components/schemas/ApiError", "components": doc["components"]}

    body = copy.deepcopy(doc["components"]["examples"]["N8nIngestaParseFailure"]["value"])
    body["instancia"] = a.instancia
    body["transcript"] = SENTINEL
    jsonschema.Draft202012Validator(req_schema).validate(body)  # la petición de prueba cumple el contrato
    good = json.dumps(body)
    path = "/api/v1/ordenes/ingesta"
    json_h = {"Content-Type": "application/json"}

    results = []
    leaks = []

    def check(name, ok, detail=""):
        results.append((name, bool(ok), detail))

    def post(key, payload=good, extra=None, raw=None, ctype="application/json"):
        h = {"Content-Type": ctype} if ctype else {}
        if key is not None:
            h["X-Api-Key"] = key
        h.update(extra or {})
        status, hdr, resp = call(a.base_url, "POST", path, payload, h, raw)
        text = resp.decode("utf-8", "replace")
        if SENTINEL in text or any(k and k in text for k in keys):
            leaks.append("una respuesta")
        return status, hdr, text

    keys = []
    if a.solo_estado:
        k = read_key(a.solo_estado)
        status, _, _ = post(k)
        print(f"{'PASA' if status == a.esperar else 'FALLA'}  estado de la clave: HTTP {status} (esperado {a.esperar})")
        sys.exit(0 if status == a.esperar else 1)

    ing, sch, otra = read_key(a.key_ingesta), read_key(a.key_scheduler), read_key(a.key_otra)
    keys = [ing, sch, otra]

    # 1) Recepción válida: 200 honesto, conforme al contrato.
    st, hdr, text = post(ing)
    parsed = json.loads(text) if st == 200 else {}
    valid = st == 200
    if valid:
        try:
            jsonschema.Draft202012Validator(ok_schema).validate(parsed)
        except jsonschema.ValidationError:
            valid = False
    check("recepción válida: 200 VALIDADO_SIN_PERSISTIR conforme al contrato", valid and parsed.get("estado") == "VALIDADO_SIN_PERSISTIR", f"HTTP {st}")
    check("persistido=false y procesado=false (no hay 201, ni orden, ni cola)", parsed.get("persistido") is False and parsed.get("procesado") is False and "ordenId" not in parsed)
    check("X-Request-Id coincide con request_id", hdr.get("x-request-id") == parsed.get("request_id") and bool(parsed.get("request_id")))

    def expect(name, st_exp, **kw):
        st, hdr, text = post(**kw)
        shape = True
        if st_exp >= 400:
            try:
                jsonschema.Draft202012Validator(err_schema).validate(json.loads(text))
            except Exception:
                shape = False
        check(f"{name}: HTTP {st_exp}", st == st_exp and shape, f"HTTP {st}{'' if shape else ' (cuerpo no es ApiError)'}")
        return text

    expect("sin credencial", 401, key=None)
    expect("clave inexistente (bien formada)", 401, key=uuid.uuid4().hex + uuid.uuid4().hex)
    expect("clave mal formada (corta)", 401, key="corta")
    expect("alcance equivocado (clave SCHEDULER)", 403, key=sch)
    expect("instancia distinta: clave de otra instancia con el JSON de esta", 403, key=otra)
    other_body = json.dumps({**body, "instancia": "instancia-no-registrada"})
    expect("instancia distinta: JSON con otra instancia y clave válida", 403, key=ing, payload=other_body)
    expect("credenciales simultáneas: X-Api-Key + Authorization", 401, key=ing, extra={"Authorization": "Bearer " + uuid.uuid4().hex})
    expect("X-Api-Key repetida", 401, key=None, raw=[("X-Api-Key", ing), ("X-Api-Key", ing)])
    expect("JSON truncado", 400, key=ing, payload=good[:-5])
    expect("JSON con contenido final", 400, key=ing, payload=good + " {}")
    expect("array de items (vista n8n) en lugar de objeto", 400, key=ing, payload="[" + good + "]")
    expect("extraccion vacía", 400, key=ing, payload=json.dumps({**body, "extraccion": {}}))
    expect("organizacion_id forjada en el cuerpo", 400, key=ing, payload=json.dumps({**body, "organizacion_id": str(uuid.uuid4())}))
    expect("cuerpo vacío", 400, key=ing, payload="")
    expect("Content-Type text/plain", 415, key=ing, ctype="text/plain")
    st, _, _ = call(a.base_url, "GET", path, None, {"X-Api-Key": ing})
    check("método GET no permitido (denegado por defecto)", st == 403, f"HTTP {st}")
    check("ninguna respuesta repite el transcript ni una clave", not leaks, ", ".join(leaks))

    bad = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(f"{'PASA' if ok else 'FALLA'}  {name}{'' if ok else '  -> ' + detail}")
    print(f"\n{len(results) - len(bad)}/{len(results)} comprobaciones pasan (datos ficticios; sin registrar cuerpos ni claves).")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
