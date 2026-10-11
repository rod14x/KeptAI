#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Archivo: cronometro.py
# Versión: 1.1.0
# Fecha: 2026-10-08
# Autora: Isabelita
# Cambios 1.1.0: suma los videos ("video N segundos" dentro de una acotación);
#   las marcas [WOW] y [F1] van entre corchetes y no cuentan como palabras.
# Descripción: estima la duración hablada de un guion de pitch en Markdown.
#   - Los bloques empiezan con una línea "## Título".
#   - Se descartan las acotaciones entre paréntesis, corchetes y cursivas.
#   - Las pausas se convierten en segundos: pausa = 2 s, pausa larga = 4 s,
#     silencio = 3 s, "espera N segundos" = N s, "video N segundos" = N s.
#   - Se detiene en una línea que empiece con "---" (las notas no se hablan).
#
# Uso:
#   python3 cronometro.py guion.md
#   python3 cronometro.py guion.md --wpm 150 --limite 180

import argparse
import re
import sys
from pathlib import Path

PALABRAS_POR_MINUTO = 140
LIMITE_SEGUNDOS = 180

RE_PAUSA_LARGA = re.compile(r"pausa\s+larga", re.IGNORECASE)
RE_PAUSA = re.compile(r"pausa(?!\s+larga)", re.IGNORECASE)
RE_SILENCIO = re.compile(r"silencio", re.IGNORECASE)
RE_ESPERA = re.compile(r"espera\s+(\d+)\s+segundos?", re.IGNORECASE)
RE_VIDEO = re.compile(r"video\s+(\d+)\s+segundos?", re.IGNORECASE)
RE_ACOTACION = re.compile(r"\*\([^)]*\)\*|\([^)]*\)|\[[^\]]*\]")
RE_MARCAS = re.compile(r"[>#*_`]")
RE_PALABRA = re.compile(r"\w+(?:[-'’]\w+)*", re.UNICODE)


def segundos_de_pausas(texto: str) -> int:
    """Suma los segundos de pausa que marcan las acotaciones.

    Solo se leen las acotaciones (paréntesis, corchetes y cursivas), para no
    contar como pausa una palabra hablada como "silencio" dentro de una frase.
    """
    acotaciones = " ".join(RE_ACOTACION.findall(texto))
    total = 0
    total += 4 * len(RE_PAUSA_LARGA.findall(acotaciones))
    total += 2 * len(RE_PAUSA.findall(acotaciones))
    total += 3 * len(RE_SILENCIO.findall(acotaciones))
    total += sum(int(n) for n in RE_ESPERA.findall(acotaciones))
    total += sum(int(n) for n in RE_VIDEO.findall(acotaciones))
    return total


def contar_palabras(texto: str) -> int:
    """Cuenta solo las palabras que se dicen en voz alta."""
    sin_acotaciones = RE_ACOTACION.sub(" ", texto)
    sin_marcas = RE_MARCAS.sub(" ", sin_acotaciones)
    return len(RE_PALABRA.findall(sin_marcas))


def separar_bloques(contenido: str):
    """Devuelve una lista de (titulo, texto).

    Ignora todo lo anterior al primer '## ' (encabezado del documento) y corta
    en la primera línea '---' (las notas no se hablan).
    """
    bloques = []
    titulo, buffer = None, []
    for linea in contenido.splitlines():
        if linea.strip().startswith("---"):
            break
        if linea.startswith("## "):
            if titulo is not None and buffer:
                bloques.append((titulo, "\n".join(buffer)))
            titulo, buffer = linea[3:].strip(), []
        elif titulo is not None:
            buffer.append(linea)
    if titulo is not None and buffer:
        bloques.append((titulo, "\n".join(buffer)))
    return [(t, x) for t, x in bloques if x.strip()]


def formato(segundos: float) -> str:
    segundos = int(round(segundos))
    return f"{segundos // 60}:{segundos % 60:02d}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Estima la duración de un guion de pitch.")
    parser.add_argument("archivo", help="Guion en Markdown (ver assets/plantilla-guion.md)")
    parser.add_argument("--wpm", type=int, default=PALABRAS_POR_MINUTO,
                        help="Palabras por minuto al hablar (por defecto 140)")
    parser.add_argument("--limite", type=int, default=LIMITE_SEGUNDOS,
                        help="Límite en segundos (por defecto 180)")
    args = parser.parse_args()

    ruta = Path(args.archivo)
    if not ruta.is_file():
        print(f"No encuentro el archivo: {ruta}", file=sys.stderr)
        return 1

    bloques = separar_bloques(ruta.read_text(encoding="utf-8"))
    if not bloques:
        print("No encontré bloques. Usa líneas '## Título' para separarlos.", file=sys.stderr)
        return 1

    print(f"{'Bloque':<42}{'Palabras':>9}{'Habla':>8}{'Pausas':>8}{'Total':>8}")
    total_palabras = total_habla = total_pausas = 0
    for titulo, texto in bloques:
        palabras = contar_palabras(texto)
        habla = palabras / args.wpm * 60
        pausas = segundos_de_pausas(texto)
        total_palabras += palabras
        total_habla += habla
        total_pausas += pausas
        print(f"{titulo[:41]:<42}{palabras:>9}{formato(habla):>8}{formato(pausas):>8}{formato(habla + pausas):>8}")

    total = total_habla + total_pausas
    print("-" * 75)
    print(f"{'TOTAL':<42}{total_palabras:>9}{formato(total_habla):>8}{formato(total_pausas):>8}{formato(total):>8}")
    print(f"\nLímite: {formato(args.limite)} a {args.wpm} palabras por minuto.")

    diferencia = total - args.limite
    if diferencia > 0:
        palabras_sobran = int(diferencia / 60 * args.wpm)
        print(f"Te pasas por {formato(diferencia)}: recorta unas {palabras_sobran} palabras "
              "(primero la cifra secundaria, luego el detalle de negocio; nunca la apertura ni el cierre).")
    elif diferencia < -20:
        print(f"Te sobran {formato(-diferencia)}: puedes ampliar una pausa o una frase del cierre.")
    else:
        print("Dentro del tiempo. Confírmalo con cronómetro real y ajusta las pausas, no las palabras.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
