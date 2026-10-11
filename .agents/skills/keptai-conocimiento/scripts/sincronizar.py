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
TECH_DEST = SKILL / "references"  # BD/ y Middleware/ reflejan la raíz del repo, para que los enlaces relativos funcionen
MANIFEST = SKILL / "references" / "manifest.json"

# Evidencia técnica de Andrés/Isabel incluida como datos (no ejecutable): carpeta -> extensiones.
TECH_SOURCES = (("BD", {".md", ".sql"}), ("Middleware", {".md", ".json"}), ("Backend/docs", {".md", ".yaml"}))

# Valores de ejemplo con forma de teléfono: se enmascaran de forma determinista al empaquetar.
REDACTIONS = (
    (re.compile(rb"\b51\d{9}\b"), b"51XXXXXXXXX"),
    (re.compile(rb"\b51\d{9}@s\.whatsapp\.net"), b"51XXXXXXXXX@s.whatsapp.net"),
    (re.compile(rb'("numero"\s*:\s*")9\d{8}(")'), rb"\g<1>9XXXXXXXX\g<2>"),
)
# Señales de secretos que NUNCA se copian: si aparecen tras sanear, el empaquetado falla.
SECRET_PATTERNS = (
    re.compile(rb"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    re.compile(rb"\bsk-[A-Za-z0-9]{20,}"),
    re.compile(rb"\bAIza[0-9A-Za-z_-]{30,}"),
    re.compile(rb"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(rb"postgres(?:ql)?://[^\s:/@]+:[^\s@]+@"),
    re.compile(rb"\b51\d{9}\b"),
)
SECRET_FIELDS = {"evoKey", "apiKey", "llmKey", "sharedSecret"}


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


def sanitize(data):
    for pattern, replacement in REDACTIONS:
        data = pattern.sub(replacement, data)
    return data


def _json_secrets(node, found):
    if isinstance(node, dict):
        if node.get("name") in SECRET_FIELDS and isinstance(node.get("value"), str) \
                and not node["value"].startswith("CAMBIAR_"):
            found.append(node["name"])
        for value in node.values():
            _json_secrets(value, found)
    elif isinstance(node, list):
        for value in node:
            _json_secrets(value, found)


def assert_safe(relative, data):
    for pattern in SECRET_PATTERNS:
        if pattern.search(data):
            raise ValueError(f"Posible secreto o teléfono real en {relative}; no se empaqueta")
    if relative.endswith(".json"):
        found = []
        _json_secrets(json.loads(data.decode("utf-8")), found)
        if found:
            raise ValueError(f"Valor no marcador en campos secretos {sorted(set(found))} de {relative}")


def technical_files(repo):
    """Evidencia técnica sanada: {ruta relativa a references/: (bytes_empaquetados, sha_fuente)}."""
    result = {}
    if repo is None:
        return result
    for folder, extensions in TECH_SOURCES:
        base = repo / folder
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if folder == "Backend/docs" and "tools" in path.relative_to(base).parts:
                continue  # solo contrato/documentacion, no venv ni dependencias
            if path.is_file() and path.suffix.lower() in extensions:
                if path.is_symlink() or not path.resolve().is_relative_to(repo):
                    raise ValueError(f"Fuente fuera del repo o enlace simbólico: {path}")
                raw = path.read_bytes()
                clean = sanitize(raw)
                relative = path.relative_to(repo).as_posix()
                assert_safe(relative, clean)
                result[relative] = (clean, digest(raw))
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
    tech_expected = {e["path"]: e for e in metadata.get("technical_files", [])}
    tech_actual = {p.relative_to(TECH_DEST).as_posix(): p
                   for folder, _ in TECH_SOURCES if (TECH_DEST / folder).is_dir()
                   for p in (TECH_DEST / folder).rglob("*") if p.is_file()}
    if set(tech_actual) != set(tech_expected):
        raise ValueError(f"Evidencia técnica no coincide con el manifiesto: {sorted(set(tech_actual) ^ set(tech_expected))}")
    for relative, path in tech_actual.items():
        data = path.read_bytes()
        if digest(data) != tech_expected[relative]["sha256"]:
            raise ValueError(f"Evidencia técnica modificada: {relative}")
        assert_safe(relative, data)
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
        tech_sources = {p: sha for p, (_, sha) in technical_files(repo).items()}
        tech_diff = sorted(set(tech_sources) ^ set(tech_expected) |
                           {p for p in tech_sources.keys() & tech_expected.keys()
                            if tech_sources[p] != tech_expected[p]["source_sha256"]})
        if tech_diff:
            raise ValueError(f"Regenerar: la evidencia técnica y la copia difieren: {tech_diff}")
    mode = "integridad y equivalencia de documentos de negocio y evidencia técnica con el repo" if repo else "integridad local; remoto no consultado"
    print(f"OK: {len(expected)} archivos; {len(tech_expected)} de evidencia técnica; {len(ids)} registros; {mode}.")


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
    tech = technical_files(repo)
    stale = {p.relative_to(TECH_DEST).as_posix()
             for folder, _ in TECH_SOURCES if (TECH_DEST / folder).is_dir()
             for p in (TECH_DEST / folder).rglob("*") if p.is_file()} - tech.keys()
    if stale:
        raise ValueError(f"Hay copias técnicas sin fuente. Revisar antes de retirar: {sorted(stale)}")
    for relative, (data, _) in tech.items():
        target = TECH_DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
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
        "technical_note": "BD/ y Middleware/ se incluyen como datos sanados (rutas relativas a references/); su copia puede diferir de la fuente solo por el enmascarado de REDACTIONS. No acreditan ejecución en Supabase, n8n ni Evolution.",
        "technical_files": [{"path": p, "bytes": len(data), "sha256": digest(data),
                             "source_sha256": sha, "sanitized": digest(data) != sha}
                            for p, (data, sha) in sorted(tech.items())],
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
