#!/usr/bin/env python3
"""Genera, de forma reproducible, el archivo FICTICIO y el JSON de ejemplo que WF2 envía a POST /api/v1/pagos/voucher.

- La imagen es un PNG sintético de 4x4 píxeles construido a mano (firma, IHDR, IDAT, IEND): no es un comprobante real ni
  contiene datos personales. Es COMPLETA (no truncada) y su Base64 es puro, sin prefijo data:.
- Los identificadores son ficticios (JID 51900000001..., mensajeId de ejemplo).
Uso:  Backend/scripts/generar-ejemplo-voucher.py [--out archivo.json]   (sin --out imprime el JSON)
Salida determinista: ejecutarlo dos veces produce los mismos bytes y el mismo Base64.
"""
import argparse, base64, hashlib, json, struct, sys, zlib


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png_4x4() -> bytes:
    rows = b"".join(b"\x00" + bytes([y * 20, 90, 255]) * 4 for y in range(4))  # 4 filas: filtro 0 + 4 píxeles RGB
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def ejemplo() -> dict:
    png = png_4x4()
    return {
        "instancia": "isabel",
        "chatId": "51900000001@s.whatsapp.net",
        "clienteJid": "51900000001@s.whatsapp.net",
        "mensajeId": "3EB0C767D0A5C7F2A9B1",
        "pushName": "Cliente ficticio",
        "recibidoEn": "2026-10-11T15:04:05Z",
        "extraccion": {
            "es_voucher": True, "tipo": "YAPE", "banco": None, "monto": 3.5, "moneda": "PEN", "fecha": "2026-10-11",
            "hora": "10:04", "codigo_operacion": "DEMO-000001", "remitente": None, "destinatario": None, "confianza": 0.9,
        },
        "imagen_base64": base64.b64encode(png).decode("ascii"),
    }, hashlib.sha256(png).hexdigest()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    a = ap.parse_args()
    doc, sha = ejemplo()
    text = json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
    if a.out:
        open(a.out, "w", encoding="utf-8").write(text)
        print(f"Escrito {a.out}; SHA-256 del archivo decodificado: {sha}", file=sys.stderr)
    else:
        sys.stdout.write(text)
