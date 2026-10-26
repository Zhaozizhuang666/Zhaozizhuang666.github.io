#!/usr/bin/env python3
"""Synchronize the explicitly approved Chuangxiang Yiyuan documents.

Usage:
  python3 scripts/sync-public-documents.py sync
  python3 scripts/sync-public-documents.py --check

Source files and directories are read-only from this script's perspective.
Only the explicit allowlisted source-to-public mappings below are considered.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN_ROOT = ROOT / "创享艺苑" / "创享艺苑商业计划"
TRAINING_ROOT = Path.home() / "Documents" / "Zhao" / "2026年北京市高级研修班"
PUBLIC_ROOT = ROOT / "assets" / "documents"
MANIFEST = PUBLIC_ROOT / "manifest.json"

# Keep this allowlist explicit. Do not discover or copy other files from the
# source directory (including temporary Office lock files).
ALLOWLIST = (
    (PLAN_ROOT / "创享艺苑商业计划书.docx", "Chuangxiang Yiyuan business plan", "chuangxiang-business-plan.docx"),
    (PLAN_ROOT / "创享艺苑商业模式.pptx", "Chuangxiang Yiyuan business model presentation", "chuangxiang-business-model.pptx"),
    (PLAN_ROOT / "创享艺苑商业模式.pdf", "Chuangxiang Yiyuan business model PDF", "chuangxiang-business-model.pdf"),
    (TRAINING_ROOT / "结业论文 - 6G时代数据要素安全流通赋能具身智能.pdf", "6G data flows and embodied AI course paper", "6g-data-flows-embodied-ai-course-paper.pdf"),
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_modified_at(path: Path) -> str:
    stamp = path.stat().st_mtime_ns
    seconds, nanos = divmod(stamp, 1_000_000_000)
    base = datetime.fromtimestamp(seconds, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    return f"{base}.{nanos:09d}Z"


def read_source(source: Path, source_label: str, public_name: str) -> tuple[bytes, dict[str, object]]:
    if not source.is_file():
        raise FileNotFoundError(f"allowlisted source is missing: {source_label}")
    data = source.read_bytes()
    info = {
        "sourceDocument": source_label,
        "publicFile": public_name,
        "sha256": sha256_bytes(data),
        "bytes": len(data),
        "sourceModifiedAt": source_modified_at(source),
    }
    return data, info


def expected_documents() -> tuple[list[tuple[Path, bytes]], dict[str, object]]:
    outputs: list[tuple[Path, bytes]] = []
    records: list[dict[str, object]] = []
    for source, source_label, public_name in ALLOWLIST:
        data, record = read_source(source, source_label, public_name)
        assert record["publicFile"] == public_name
        outputs.append((PUBLIC_ROOT / public_name, data))
        records.append(record)
    return outputs, {"documents": records}


def atomic_replace(path: Path, data: bytes, mode: int = 0o644) -> bool:
    """Write path atomically only when content differs; return whether changed."""
    if path.is_file() and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
        return True
    finally:
        temporary.unlink(missing_ok=True)


def check(outputs: list[tuple[Path, bytes]], manifest_data: dict[str, object]) -> list[str]:
    differences: list[str] = []
    for output, expected in outputs:
        if not output.is_file():
            differences.append(f"missing public file: {output.name}")
        elif output.read_bytes() != expected:
            differences.append(f"content differs: {output.name}")
    expected_manifest = json.dumps(manifest_data, ensure_ascii=False, indent=2) + "\n"
    if not MANIFEST.is_file():
        differences.append("missing manifest.json")
    elif MANIFEST.read_text(encoding="utf-8") != expected_manifest:
        differences.append("manifest.json differs")
    return differences


def run_check() -> int:
    outputs, manifest_data = expected_documents()
    differences = check(outputs, manifest_data)
    if differences:
        for difference in differences:
            print(f"DIFF: {difference}", file=sys.stderr)
        return 1
    print(f"OK: {len(outputs)} public documents and manifest match the allowlist")
    return 0


def run_sync() -> int:
    outputs, manifest_data = expected_documents()
    changed = 0
    for output, data in outputs:
        if atomic_replace(output, data):
            changed += 1
    manifest_bytes = (json.dumps(manifest_data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if atomic_replace(MANIFEST, manifest_bytes, stat.S_IMODE(0o644)):
        changed += 1
    print(f"SYNC: {changed} file(s) updated; {len(outputs)} documents allowlisted")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", nargs="?", choices=("sync", "check"), default="sync")
    parser.add_argument("--check", action="store_true", help="check only; never write files")
    args = parser.parse_args()
    if args.check and args.command != "sync":
        parser.error("use either 'check' or '--check', not both")
    try:
        return run_check() if args.check or args.command == "check" else run_sync()
    except FileNotFoundError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
