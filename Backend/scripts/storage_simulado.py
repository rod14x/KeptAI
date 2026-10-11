#!/usr/bin/env python3
"""Servidor LOCAL que SIMULA la API de objetos de Supabase Storage solo para verificar el adaptador de Spring.

NO es Supabase: guarda en memoria, exige la cabecera apikey con la clave de prueba recibida por entorno y no registra
cuerpos ni claves. Endpoints: POST/DELETE /storage/v1/object/<bucket>/<ruta> y GET /_objetos (lista de rutas, tamaños y
SHA-256 para que el verificador compare). Uso: STORAGE_SIM_KEY=<clave de prueba> storage_simulado.py <puerto>
"""
import hashlib, http.server, json, os, sys

KEY = os.environ["STORAGE_SIM_KEY"]
OBJ = {}


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):  # sin registro de peticiones
        pass

    def _send(self, code, body=b"{}"):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _auth(self):
        return self.headers.get("apikey") == KEY

    def do_GET(self):
        if self.path == "/_objetos":
            self._send(200, json.dumps({p: {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()} for p, (b, _) in OBJ.items()}).encode())
        else:
            self._send(404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", "0"))
        data = self.rfile.read(n)
        if not self._auth():
            return self._send(401)
        prefix = "/storage/v1/object/keptai-vouchers/"
        if not self.path.startswith(prefix) or self.headers.get("x-upsert") != "false":
            return self._send(400)
        path = self.path[len(prefix):]
        if path in OBJ:
            return self._send(409, b'{"statusCode":"409","error":"Duplicate"}')
        OBJ[path] = (data, self.headers.get("Content-Type"))
        self._send(200, b'{"Key":"ok"}')

    def do_DELETE(self):
        if not self._auth():
            return self._send(401)
        prefix = "/storage/v1/object/keptai-vouchers/"
        OBJ.pop(self.path[len(prefix):], None)
        self._send(200)


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
