#!/usr/bin/env python3
"""Comprobación HTTP LOCAL de POST /api/v1/ordenes/ingesta y POST /api/v1/pagos/voucher contra una instancia PROPIA de Spring.

- Lee las claves X-Api-Key desde ARCHIVOS (nunca por argumento); no las imprime ni registra cuerpos: solo estado HTTP y PASA/FALLA.
- Usa datos y archivos FICTICIOS (ejemplo del OpenAPI y Backend/docs/ejemplos/wf2-voucher-ficticio.json, PNG sintético completo) y
  valida peticiones y respuestas contra los esquemas de Backend/docs/openapi.yaml.
- Comportamiento verificado (MIG-04/05): ingesta -> 201 BORRADOR con idempotencia (replay 201 + Idempotency-Replayed, 409 si cambia
  el contenido); voucher -> 201 pago RECIBIDO con comprobante en el Storage (SIMULADO por storage_simulado.py, no Supabase real).
Uso (intérprete de Backend/docs/tools/.venv, con PyYAML y jsonschema):
  verificar-ingesta-local.py --base-url http://127.0.0.1:8082 --instancia isabel --key-ingesta F --key-scheduler F --key-otra F --storage-url http://127.0.0.1:8083
  verificar-ingesta-local.py --base-url ... --instancia isabel --fase storage-caido --key-ingesta F
  verificar-ingesta-local.py --base-url ... --instancia isabel --solo-estado F --esperar 201|401
"""
import argparse, base64, copy, hashlib, http.client, json, os, sys, urllib.parse, uuid

import jsonschema, yaml

SENT_TRANSCRIPT = "TRANSCRIPT_FICTICIO_D3_NO_DEBE_APARECER"
SENT_HOJA = "HOJA_ENTRANTE_FICTICIA_NO_DEBE_APARECER"
SENT_CRUDO = "CRUDO_FICTICIO_NO_DEBE_APARECER"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ING, VOU = "/api/v1/ordenes/ingesta", "/api/v1/pagos/voucher"


def read_key(path):
    if os.stat(path).st_mode & 0o077:
        sys.exit("El archivo de clave debe tener permisos 600.")
    return open(path, "rb").read().rstrip(b"\r\n").decode("ascii")


def call(base, method, path, body=None, headers=None, raw_headers=None):
    u = urllib.parse.urlparse(base)
    c = http.client.HTTPConnection(u.hostname, u.port, timeout=60)
    c.putrequest(method, path)
    for k, v in (headers or {}).items():
        c.putheader(k, v)
    for k, v in (raw_headers or []):
        c.putheader(k, v)
    data = body.encode("utf-8") if isinstance(body, str) else body
    if data is not None:
        c.putheader("Content-Length", str(len(data)))
    try:
        c.endheaders(data)
    except (BrokenPipeError, ConnectionResetError):
        pass  # el servidor rechazó antes de leer todo el cuerpo (413 temprano): la respuesta ya está disponible
    r = c.getresponse()
    payload = r.read()
    out = (r.status, dict((k.lower(), v) for k, v in r.getheaders()), payload.decode("utf-8", "replace"))
    c.close()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--instancia", required=True)
    ap.add_argument("--key-ingesta")
    ap.add_argument("--key-scheduler")
    ap.add_argument("--key-otra")
    ap.add_argument("--storage-url")
    ap.add_argument("--fase", default="principal", choices=["principal", "storage-caido"])
    ap.add_argument("--solo-estado")
    ap.add_argument("--esperar", type=int)
    a = ap.parse_args()

    doc = yaml.safe_load(open(os.path.join(ROOT, "docs", "openapi.yaml"), encoding="utf-8"))
    comps = doc["components"]
    sch = lambda name: jsonschema.Draft202012Validator({"$ref": f"#/components/schemas/{name}", "components": comps})
    ing_req, ing_resp = sch("N8nIngestaOrdenRequest"), sch("N8nIngestaOrdenResponse")
    vou_req, vou_resp, err = sch("N8nPagoVoucherRequest"), sch("N8nPagoVoucherResponse"), sch("ApiError")

    orden = copy.deepcopy(comps["examples"]["N8nIngestaCredit"]["value"])
    orden.update({"instancia": a.instancia, "transcript": SENT_TRANSCRIPT, "hojaResumenMd": SENT_HOJA})
    orden["extraccion"]["crudo"] = SENT_CRUDO
    ing_req.validate(orden)
    voucher = json.load(open(os.path.join(ROOT, "docs", "ejemplos", "wf2-voucher-ficticio.json"), encoding="utf-8"))
    voucher["instancia"] = a.instancia
    vou_req.validate(voucher)
    archivo = base64.b64decode(voucher["imagen_base64"], validate=True)
    sha = hashlib.sha256(archivo).hexdigest()
    js = json.dumps

    results, leaks, keys = [], [], []
    check = lambda name, ok, detail="": results.append((name, bool(ok), detail))

    def post(path, key, payload, extra=None, raw=None, ctype="application/json"):
        h = {"Content-Type": ctype} if ctype else {}
        if key is not None:
            h["X-Api-Key"] = key
        h.update(extra or {})
        st, hdr, text = call(a.base_url, "POST", path, payload, h, raw)
        for s in (SENT_TRANSCRIPT, SENT_HOJA, SENT_CRUDO, voucher["imagen_base64"][:40], *keys):
            if s and s in text:
                leaks.append(path)
        return st, hdr, text

    def estado(name, path, esperado, key, payload, **kw):
        st, hdr, text = post(path, key, payload, **kw)
        forma = True
        if esperado >= 400:
            try:
                err.validate(json.loads(text))
            except Exception:
                forma = False
        check(f"{name}: HTTP {esperado}", st == esperado and forma, f"HTTP {st}{'' if forma else ' (cuerpo no es ApiError)'}")
        return st, hdr, text

    if a.solo_estado:
        st, _, _ = post(ING, read_key(a.solo_estado), js(orden))
        print(f"{'PASA' if st == a.esperar else 'FALLA'}  estado de la clave: HTTP {st} (esperado {a.esperar})")
        sys.exit(0 if st == a.esperar else 1)

    if a.fase == "storage-caido":
        k = read_key(a.key_ingesta)
        keys.append(k)
        v = copy.deepcopy(voucher)
        v["mensajeId"] = "3EB0C767D0A5C7F2A9F0"
        st, _, text = post(VOU, k, js(v))
        check("Storage caído: HTTP 503 STORAGE_UNAVAILABLE (reintentable)", st == 503 and json.loads(text).get("code") == "STORAGE_UNAVAILABLE", f"HTTP {st}")
        for name, ok, detail in results:
            print(f"{'PASA' if ok else 'FALLA'}  {name}{'' if ok else '  -> ' + detail}")
        sys.exit(0 if all(r[1] for r in results) else 1)

    ing, sched, otra = read_key(a.key_ingesta), read_key(a.key_scheduler), read_key(a.key_otra)
    keys.extend([ing, sched, otra])

    # ---------------- Ingesta ----------------
    st, hdr, text = post(ING, ing, js(orden))
    resp = json.loads(text) if st == 201 else {}
    try:
        ing_resp.validate(resp)
        conforme = True
    except jsonschema.ValidationError:
        conforme = False
    check("ingesta válida: 201 BORRADOR conforme al contrato", st == 201 and conforme and resp.get("estado") == "BORRADOR" and resp.get("hojaResumenVersion") == 1, f"HTTP {st}")
    check("ingesta: X-Request-Id presente y sin Idempotency-Replayed", bool(hdr.get("x-request-id")) and "idempotency-replayed" not in hdr)
    st2, hdr2, text2 = post(ING, ing, js(orden))
    check("ingesta repetida: 201 con Idempotency-Replayed y el mismo ordenId", st2 == 201 and hdr2.get("idempotency-replayed") == "true" and json.loads(text2).get("ordenId") == resp.get("ordenId"), f"HTTP {st2}")
    cambiado = copy.deepcopy(orden)
    cambiado["extraccion"]["total"] = 12345.67
    estado("ingesta: misma clave con otro contenido", ING, 409, ing, js(cambiado))
    estado("ingesta: sin credencial", ING, 401, None, js(orden))
    estado("ingesta: clave inexistente", ING, 401, uuid.uuid4().hex + uuid.uuid4().hex, js(orden))
    estado("ingesta: clave mal formada", ING, 401, "corta", js(orden))
    estado("ingesta: alcance equivocado (SCHEDULER)", ING, 403, sched, js(orden))
    estado("ingesta: clave de otra instancia", ING, 403, otra, js(orden))
    estado("ingesta: JSON con otra instancia", ING, 403, ing, js({**orden, "instancia": "instancia-no-registrada"}))
    estado("ingesta: X-Api-Key + Authorization", ING, 401, ing, js(orden), extra={"Authorization": "Bearer " + uuid.uuid4().hex})
    estado("ingesta: X-Api-Key repetida", ING, 401, None, js(orden), raw=[("X-Api-Key", ing), ("X-Api-Key", ing)])
    estado("ingesta: JSON truncado", ING, 400, ing, js(orden)[:-5])
    estado("ingesta: contenido final", ING, 400, ing, js(orden) + " {}")
    estado("ingesta: array de items de n8n", ING, 400, ing, "[" + js(orden) + "]")
    estado("ingesta: extraccion vacía", ING, 400, ing, js({**orden, "extraccion": {}}))
    estado("ingesta: organizacion_id forjada", ING, 400, ing, js({**orden, "organizacion_id": str(uuid.uuid4())}))
    estado("ingesta: cuerpo vacío", ING, 400, ing, "")
    estado("ingesta: text/plain", ING, 415, ing, js(orden), ctype="text/plain")
    estado("ingesta: cuerpo sobredimensionado", ING, 413, ing, js({**orden, "transcript": "x" * 700_000}))
    g = call(a.base_url, "GET", ING, None, {"X-Api-Key": ing})[0]
    check("ingesta: método GET denegado por defecto", g == 403, f"HTTP {g}")

    # ---------------- Voucher ----------------
    st, hdr, text = post(VOU, ing, js(voucher))
    resp = json.loads(text) if st == 201 else {}
    try:
        vou_resp.validate(resp)
        conforme = True
    except jsonschema.ValidationError:
        conforme = False
    check("voucher válido: 201 REGISTRADO conforme al contrato", st == 201 and conforme and resp.get("resultado") == "REGISTRADO", f"HTTP {st}")
    check("voucher: fase RECIBIDO, sin fondos verificados ni saldo modificado ni orden asociada",
          resp.get("fase") == "RECIBIDO" and resp.get("fondosVerificados") is False and resp.get("saldoModificado") is False and resp.get("ordenRef") is None and resp.get("estadoConciliacion") == "PENDIENTE")
    if a.storage_url:
        objs = json.loads(call(a.storage_url, "GET", "/_objetos")[2])
        check("voucher: un único objeto en Storage, SHA-256 y tamaño iguales a los bytes decodificados", len(objs) == 1 and next(iter(objs.values())) == {"bytes": len(archivo), "sha256": sha})
    st2, hdr2, text2 = post(VOU, ing, js(voucher))
    check("voucher repetido: 201 con Idempotency-Replayed y el mismo pagoId", st2 == 201 and hdr2.get("idempotency-replayed") == "true" and json.loads(text2).get("pagoId") == resp.get("pagoId"), f"HTTP {st2}")
    if a.storage_url:
        check("voucher repetido: no se vuelve a subir ningún objeto", len(json.loads(call(a.storage_url, "GET", "/_objetos")[2])) == 1)
    import struct, zlib
    extra = b"tEXt" + b"k\x00otro archivo ficticio"
    chunk_extra = struct.pack(">I", len(extra) - 4) + extra + struct.pack(">I", zlib.crc32(extra) & 0xFFFFFFFF)
    otro_archivo = copy.deepcopy(voucher)  # PNG válido y completo, pero distinto del enviado la primera vez
    otro_archivo["imagen_base64"] = base64.b64encode(archivo[:-12] + chunk_extra + archivo[-12:]).decode()
    estado("voucher: mismo mensajeId con otro archivo", VOU, 409, ing, js(otro_archivo))
    otro_monto = copy.deepcopy(voucher)
    otro_monto["extraccion"]["monto"] = 4.0
    estado("voucher: mismo mensajeId con otro importe", VOU, 409, ing, js(otro_monto))
    ok = voucher["imagen_base64"]
    n = [0]

    def v(**cambios):
        n[0] += 1
        d = copy.deepcopy(voucher)
        d["mensajeId"] = f"3EB0C767D0A5C7F2B{n[0]:03d}"
        for k, val in cambios.items():
            if k == "extraccion":
                d["extraccion"].update(val)
            else:
                d[k] = val
        return js(d)

    estado("voucher: prefijo data:", VOU, 400, ing, v(imagen_base64="data:image/png;base64," + ok))
    estado("voucher: Base64 truncado", VOU, 400, ing, v(imagen_base64=ok[:-3]))
    estado("voucher: muestra truncada con '...'", VOU, 400, ing, v(imagen_base64=ok[:20] + "..." + ok[23:]))
    estado("voucher: saltos de línea en el Base64", VOU, 400, ing, v(imagen_base64=ok[:20] + "\n" + ok[20:]))
    estado("voucher: imagen_base64 vacía", VOU, 400, ing, v(imagen_base64=""))
    estado("voucher: URL en lugar de Base64 (no se descarga)", VOU, 400, ing, v(imagen_base64="https://ejemplo.invalid/v.png"))
    estado("voucher: contenido que no es JPEG/PNG/PDF", VOU, 422, ing, v(imagen_base64=base64.b64encode(b"texto que dice ser una imagen").decode()))
    estado("voucher: PNG cortado (sin IEND)", VOU, 422, ing, v(imagen_base64=base64.b64encode(archivo[:-6]).decode()))
    estado("voucher: moneda USD", VOU, 422, ing, v(extraccion={"moneda": "USD"}))
    estado("voucher: monto ausente", VOU, 422, ing, v(extraccion={"monto": None}))
    estado("voucher: fecha ausente", VOU, 422, ing, v(extraccion={"fecha": None}))
    estado("voucher: mensajeId null", VOU, 400, ing, v(mensajeId=None))
    estado("voucher: clienteJid null", VOU, 400, ing, v(clienteJid=None))
    estado("voucher: chatId null", VOU, 400, ing, v(chatId=None))
    estado("voucher: sin credencial", VOU, 401, None, js(voucher))
    estado("voucher: alcance SCHEDULER", VOU, 403, sched, js(voucher))
    estado("voucher: JSON con otra instancia", VOU, 403, ing, v(instancia="instancia-no-registrada"))
    estado("voucher: cuerpo sobredimensionado (Base64 de más de 10 MiB)", VOU, 413, ing, v(imagen_base64="A" * 15_000_000))
    estado("voucher: Content-Type text/plain (no multipart ni otro)", VOU, 415, ing, js(voucher), ctype="text/plain")
    no = js({**voucher, "mensajeId": "3EB0C767D0A5C7F2C001", "extraccion": {"es_voucher": False, "confianza": 0}})
    st, _, text = post(VOU, ing, no)
    check("voucher: imagen que no es voucher -> 200 IGNORADO_NO_VOUCHER", st == 200 and json.loads(text).get("resultado") == "IGNORADO_NO_VOUCHER", f"HTTP {st}")
    if a.storage_url:
        check("ningún rechazo ni la imagen ignorada subió objetos", len(json.loads(call(a.storage_url, "GET", "/_objetos")[2])) == 1)
    check("ninguna respuesta repite el transcript, la hoja, el crudo, el Base64 ni una clave", not leaks, ", ".join(sorted(set(leaks))))

    bad = [r for r in results if not r[1]]
    for name, okk, detail in results:
        print(f"{'PASA' if okk else 'FALLA'}  {name}{'' if okk else '  -> ' + detail}")
    print(f"\n{len(results) - len(bad)}/{len(results)} comprobaciones pasan (datos ficticios; sin registrar cuerpos ni claves).")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
