#!/usr/bin/env python3
"""Empaquetar fuentes completas y comprobar su integridad, sin red ni Git write."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
DEST = SKILL / "references" / "cerebro"
MANIFEST = SKILL / "references" / "manifest.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_files(repo):
    source_root = repo / "cerebro" if (repo / "cerebro" / "conocimientos" / "INDICE.md").is_file() else repo
    result = {}
    for folder, extensions in (("conocimientos", {".md"}),
                               ("diagramas", {".md", ".excalidraw", ".png"})):
        for path in sorted((source_root / folder).rglob("*")):
            if path.is_file() and path.suffix.lower() in extensions:
                if path.is_symlink() or not path.resolve().is_relative_to(repo):
                    raise ValueError(f"Fuente fuera del repo o enlace simbólico: {path}")
                result[path.relative_to(source_root).as_posix()] = path.read_bytes()
    if "conocimientos/INDICE.md" not in result:
        raise ValueError("La ruta no contiene conocimientos/INDICE.md")
    return result


def git_output(repo, args):
    try:
        return subprocess.check_output(["git", "-C", str(repo), *args],
                                       stderr=subprocess.DEVNULL).decode("utf-8").strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def coverage(files):
    ids = set()
    for name, data in files.items():
        if name.startswith("conocimientos/") and name.endswith(".md"):
            ids.update(re.findall(r"^### (A0[12]-Q[0-9]+)",
                                  data.decode("utf-8-sig"), re.MULTILINE))
    expected = {f"A01-Q{i:02d}" for i in range(1, 9)}
    expected |= {f"A02-Q{i:02d}" for i in range(1, 36)}
    if expected - ids:
        raise ValueError(f"Faltan registros de entrevista: {sorted(expected - ids)}")
    return sorted(ids)


def check(repo):
    metadata = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = {entry["path"]: entry["sha256"] for entry in metadata["files"]}
    actual = {p.relative_to(DEST).as_posix(): digest(p.read_bytes())
              for p in DEST.rglob("*") if p.is_file()}
    if actual != expected:
        changed = sorted(set(actual) ^ set(expected) |
                         {p for p in actual.keys() & expected.keys()
                          if actual[p] != expected[p]})
        raise ValueError(f"El paquete no coincide con su manifiesto: {changed}")
    packaged = {p: (DEST / p).read_bytes() for p in expected}
    ids = coverage(packaged)
    if repo is not None:
        originals = {p: digest(data) for p, data in source_files(repo).items()}
        changed = sorted(set(originals) ^ set(expected) |
                         {p for p in originals.keys() & expected.keys()
                          if originals[p] != expected[p]})
        business_changes = [p for p in changed if p.startswith("conocimientos/")]
        if business_changes:
            raise ValueError(f"Regenerar: las fuentes y la copia difieren: {business_changes}")
        diagram_changes = [p for p in changed if p.startswith("diagramas/")]
        if diagram_changes:
            print(f"AVISO: los diagramas locales difieren de la instantánea incluida: {diagram_changes}. Revisar antes de regenerar; el paquete conserva los antecedentes revisados.")
    mode = "integridad y equivalencia de documentos de negocio con el repo" if repo else "integridad local; remoto no consultado"
    print(f"OK: {len(expected)} archivos; {len(ids)} registros; {mode}.")


def sync(repo, preserve_historical_diagrams=False):
    files = source_files(repo)
    ids = coverage(files)
    # No borrar fuentes retiradas automáticamente: requieren revisión del equipo.
    extras = {p.relative_to(DEST).as_posix() for p in DEST.rglob("*") if p.is_file()} - files.keys()
    if extras:
        if not preserve_historical_diagrams or any(not p.startswith("diagramas/") for p in extras):
            raise ValueError(f"Hay copias sin fuente. Revisar antes de retirar: {sorted(extras)}")
        prior = json.loads(MANIFEST.read_text(encoding="utf-8"))
        known = {entry["path"]: entry["sha256"] for entry in prior["files"]}
        for relative in extras:
            data = (DEST / relative).read_bytes()
            if digest(data) != known.get(relative):
                raise ValueError(f"Diagrama histórico sin hash previo válido: {relative}")
            files[relative] = data
        print(f"AVISO: conservadas instantáneas históricas verificadas: {sorted(extras)}")
    for relative, data in files.items():
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.is_symlink() or not target.resolve().is_relative_to(DEST.resolve()):
            raise ValueError(f"Destino fuera del paquete: {target}")
        target.write_bytes(data)
    source_prefix = "cerebro/" if (repo / "cerebro/conocimientos/INDICE.md").is_file() else ""
    uncommitted = git_output(repo, ["status", "--porcelain", "--", source_prefix + "conocimientos", source_prefix + "diagramas"])
    metadata = {
        "schema_version": 1,
        "source_repository": "https://github.com/rod14x/KeptAI",
        "source_head_at_generation": git_output(repo, ["rev-parse", "HEAD"]),
        "source_basis": "working_tree_plus_preserved_diagrams" if extras else "working_tree",
        "preserved_historical_diagrams": sorted(extras),
        "source_changes_at_generation": uncommitted.splitlines() if uncommitted else [],
        "note": "Hashes describen los archivos empaquetados. HEAD es procedencia anterior a publicar, no el commit de publicación ni prueba de frescura del remoto.",
        "interview_ids": ids,
        "files": [{"path": p, "bytes": len(data), "sha256": digest(data)}
                  for p, data in sorted(files.items())],
    }
    MANIFEST.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    check(repo)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, help="Raíz local del repo KeptAI")
    parser.add_argument("--check", action="store_true", help="Solo verificar, sin modificar")
    parser.add_argument("--preserve-historical-diagrams", action="store_true",
                        help="Conservar diagramas sin fuente solo si su hash coincide con el manifiesto previo")
    args = parser.parse_args()
    repo = args.repo.resolve() if args.repo else SKILL.parents[2]
    if not ((repo / "conocimientos" / "INDICE.md").is_file() or (repo / "cerebro/conocimientos/INDICE.md").is_file()):
        if args.repo or not args.check:
            parser.error("Indicar --repo con la raíz del cerebro; no se encontró conocimientos/INDICE.md")
        repo = None
    try:
        check(repo) if args.check else sync(repo, args.preserve_historical_diagrams)
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        parser.exit(1, f"ERROR: {error}\n")


if __name__ == "__main__":
    main()
