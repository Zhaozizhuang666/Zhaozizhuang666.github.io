#!/usr/bin/env python3
"""Build a deterministic, allowlisted static site without publishing source folders.

The Git index selects reviewed files; untracked files are never copied. A release
manifest records the current commit and the exact bytes being deployed. Existing
output is replaceable only when it is a complete artifact made by this builder.
"""

from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
FORMAT = "zizhuang-public-site-v1"
ROOT_FILES = frozenset({
    "index.html", "knowledge.html", "guide.html", "favicon.ico", "QA.md",
    "disclosures.js", "entrance.js", "gallery.css", "gallery.js",
    "knowledge.css", "knowledge.js", "language-copy.js", "language-init.js",
    "language.js", "research.js", "scroll-init.js", "style.css",
    "theme-init.js", "theme.js", "xiaoyi-config.js", "xiaoyi-engine.js",
    "xiaoyi.css", "xiaoyi.js",
})
PDF_FILES = frozenset({
    "assets/documents/chuangxiang-business-model.pdf",
    "assets/documents/6g-data-flows-embodied-ai-course-paper.pdf",
})
NOTICES = frozenset({
    "assets/fonts/OFL-Outfit.txt", "assets/fonts/SOURCES.md",
    "assets/research/SOURCES.md", "resources/README.md",
    "resources/vla-guide/LICENSE", "resources/vla-guide/CONTENT_LICENSE.md",
    "resources/vla-guide/THIRD_PARTY_NOTICES.md",
})
EXTENSIONS = {
    "assets": {".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif", ".mp4", ".webm", ".ico", ".json", ".woff", ".woff2"},
    "data": {".json"},
    "resources": {".html", ".css", ".js", ".json", ".svg", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".ico", ".woff", ".woff2"},
}
TEXT_EXTENSIONS = {".html", ".css", ".js", ".json", ".svg", ".md"}
# Tabs and the assistant drawer are created/selected by the shipped controllers.
DYNAMIC_FRAGMENTS = {
    "index.html": {"xiaoyi-panel"},
    "knowledge.html": {"competitions", "journals", "learning", "xiaoyi-panel"},
    "guide.html": {"xiaoyi-panel"},
}
PRIVATE_PATTERNS = {
    "local filesystem reference": r"file://|/Users/|/home/|[A-Z]:\\(?:Users|Documents)\\",
    "private key": r"-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----",
    "credential shape": r"\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|ark-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-[a-f0-9]{4,})\b",
}


class BuildError(ValueError):
    pass


def git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(root), *args], stderr=subprocess.PIPE)


def safe_name(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or ".." in path.parts or "\\" in name
            or any(ord(char) < 32 for char in name)
            or any(part.startswith(".") for part in path.parts)):
        raise BuildError("Unsafe publication path")
    return path


def checked_file(root: Path, name: str) -> Path:
    path = root
    for part in safe_name(name).parts:
        path /= part
        if path.is_symlink():
            raise BuildError(f"Symlink rejected: {name}")
    if not path.is_file():
        raise BuildError(f"Missing tracked publication file: {name}")
    return path


def selected_files(root: Path) -> list[str]:
    tracked = git(root, "ls-files", "-z").decode("utf-8").rstrip("\0").split("\0")
    selected = set()
    for name in tracked:
        parts = PurePosixPath(name).parts
        if name not in ROOT_FILES and (not parts or parts[0] not in EXTENSIONS):
            continue
        path = safe_name(name)
        checked_file(root, name)
        if name in ROOT_FILES or name in NOTICES or name in PDF_FILES:
            selected.add(name)
        elif path.suffix.lower() in EXTENSIONS[path.parts[0]]:
            selected.add(name)
        else:
            raise BuildError(f"Unapproved public file type: {name}")
    missing = ROOT_FILES - selected
    if missing:
        raise BuildError("Required runtime files are not tracked: " + ", ".join(sorted(missing)))
    return sorted(selected)


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def scan_text(name: str, raw: bytes) -> None:
    if PurePosixPath(name).suffix.lower() not in TEXT_EXTENSIONS and name not in NOTICES:
        return
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise BuildError(f"Non-UTF-8 text file: {name}") from exc
    for label, pattern in PRIVATE_PATTERNS.items():
        if re.search(pattern, text):
            # Never include the matched credential or private path in logs.
            raise BuildError(f"Rejected {label} in {name}")


def check_manifests(files: dict[str, bytes]) -> None:
    documents = json.loads(files["assets/documents/manifest.json"])["documents"]
    documented = {"assets/documents/" + item["publicFile"] for item in documents}
    actual = {name for name in files if PurePosixPath(name).suffix.lower() == ".pdf"}
    if documented != PDF_FILES or actual != PDF_FILES or len(documents) != len(PDF_FILES):
        raise BuildError("The public PDF set differs from the two approved documents")
    for item in documents:
        name = "assets/documents/" + item["publicFile"]
        raw = files[name]
        if len(raw) != item["bytes"] or digest(raw) != item["sha256"]:
            raise BuildError(f"Document manifest mismatch: {name}")
    resources = json.loads(files["resources/manifest.json"])["files"]
    listed = set()
    for item in resources:
        name = str(safe_name(item["path"]))
        if not name.startswith("resources/") or name in listed or name not in files:
            raise BuildError("Invalid learning-resource manifest path")
        raw = files[name]
        if len(raw) != item["bytes"] or digest(raw) != item["sha256"]:
            raise BuildError(f"Learning-resource manifest mismatch: {name}")
        listed.add(name)
    expected = {name for name in files if name.startswith("resources/")}
    expected -= {"resources/README.md", "resources/manifest.json"}
    if listed != expected:
        raise BuildError("Learning-resource manifest does not cover the complete public snapshot")


class Page(HTMLParser):
    def __init__(self, raw: bytes):
        super().__init__()
        self.ids: set[str] = set()
        self.links: list[str] = []
        self.feed(raw.decode("utf-8"))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        for key in (("id", "name") if tag == "a" else ("id",)):
            if attributes.get(key):
                self.ids.add(attributes[key])
        for key in ("href", "src", "poster", "data-gallery-source"):
            if attributes.get(key):
                self.links.append(attributes[key])
        if attributes.get("srcset"):
            self.links.extend(value.strip().split()[0] for value in attributes["srcset"].split(",") if value.strip())


def check_links(files: dict[str, bytes]) -> dict[str, int]:
    pages = {name: Page(raw) for name, raw in files.items() if name.endswith(".html")}
    links = anchors = 0

    def check(source: str, reference: str) -> None:
        nonlocal links, anchors
        parts = urlsplit(reference)
        if parts.scheme in {"javascript", "file"}:
            raise BuildError(f"Unsafe local link scheme in {source}")
        if parts.scheme or parts.netloc:
            return
        if not parts.path and not parts.fragment:
            return
        if parts.path.startswith("/"):
            raise BuildError(f"Root-absolute local link in {source}")
        path = PurePosixPath(source).parent / unquote(parts.path) if parts.path else PurePosixPath(source)
        # Resolve relative '..' segments without ever reading outside the artifact.
        normalized: list[str] = []
        for part in path.parts:
            if part == "..":
                if not normalized:
                    raise BuildError(f"Local link escapes publication in {source}")
                normalized.pop()
            elif part not in {"", "."}:
                normalized.append(part)
        target = "/".join(normalized)
        if target not in files and target.rstrip("/") + "/index.html" in files:
            target = target.rstrip("/") + "/index.html"
        if target not in files:
            raise BuildError(f"Broken local link in {source}: {reference}")
        links += 1
        if parts.fragment and target in pages:
            fragment = unquote(parts.fragment)
            if fragment not in pages[target].ids and fragment not in DYNAMIC_FRAGMENTS.get(target, set()):
                raise BuildError(f"Missing local fragment in {source}: {reference}")
            anchors += 1

    for name, page in pages.items():
        for reference in page.links:
            check(name, reference)
    for name, raw in files.items():
        if name.endswith(".css"):
            for match in re.finditer(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", raw.decode("utf-8")):
                if not match[1].startswith("#"):
                    check(name, match[1].strip())
    for name in ("data/achievements-gallery.json", "data/activity-gallery.json"):
        for item in json.loads(files[name])["items"]:
            for key in ("thumbnail", "full"):
                check("index.html", item[key])
    for entry in json.loads(files["data/technical-knowledge.json"])["entries"]:
        if entry.get("libraryHref"):
            check("index.html", entry["libraryHref"])
    return {"htmlPages": len(pages), "localLinks": links, "localAnchors": anchors}


def check_output(root: Path, output: Path) -> None:
    if output.is_symlink() or any(parent.is_symlink() for parent in output.parents):
        raise BuildError("Output path must not use symlinks")
    if root == output or root.is_relative_to(output):
        raise BuildError("Output cannot replace the source directory or an ancestor")
    if output.is_relative_to(root):
        relative = output.relative_to(root)
        if relative.parts[0] in {*EXTENSIONS, "server", "scripts", "tests", "docs", ".git", ".github"}:
            raise BuildError("Output overlaps a source directory")
    if not output.exists():
        return
    if not output.is_dir():
        raise BuildError("Output exists and is not a directory")
    children = list(output.iterdir())
    if not children:
        return
    try:
        release = json.loads((output / "release.json").read_text())
        if release["format"] != FORMAT:
            raise ValueError("not this builder")
        expected = {str(safe_name(item["path"])) for item in release["files"]} | {"release.json"}
        for item in release["files"]:
            existing = output / str(safe_name(item["path"]))
            if existing.is_symlink():
                raise ValueError("symlink")
            raw = existing.read_bytes()
            if len(raw) != item["bytes"] or digest(raw) != item["sha256"]:
                raise ValueError("modified output")
        actual = set()
        for path in output.rglob("*"):
            if path.is_symlink():
                raise ValueError("symlink")
            if path.is_file():
                actual.add(path.relative_to(output).as_posix())
        if expected != actual:
            raise ValueError("unrelated files")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise BuildError("Refusing to replace a nonempty directory that is not a complete generated artifact") from exc


def build(root: Path, output: Path) -> dict[str, object]:
    root = root.resolve()
    # Do not resolve the final output before checking for symlink traversal.
    output = Path(os.path.abspath(output))
    check_output(root, output)
    names = selected_files(root)
    files = {name: checked_file(root, name).read_bytes() for name in names}
    for name, raw in files.items():
        scan_text(name, raw)
    check_manifests(files)
    checks = check_links(files)
    release = {
        "format": FORMAT,
        "commit": git(root, "rev-parse", "HEAD").decode().strip(),
        "sourceDirty": bool(git(root, "status", "--porcelain", "--untracked-files=no")),
        "checks": checks,
        "files": [{"path": name, "bytes": len(files[name]), "sha256": digest(files[name])} for name in names],
    }
    files["release.json"] = (json.dumps(release, ensure_ascii=False, indent=2) + "\n").encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".public-site-", dir=output.parent))
    backup = None
    try:
        for name, raw in files.items():
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
            target.chmod(0o644)
        if output.exists():
            backup = Path(tempfile.mkdtemp(prefix=".previous-public-site-", dir=output.parent))
            backup.rmdir()
            output.rename(backup)
        try:
            stage.rename(output)
        except BaseException:
            if backup:
                backup.rename(output)
            raise
        if backup:
            shutil.rmtree(backup)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    return {"output": str(output), "files": len(files), "bytes": sum(map(len, files.values())), **checks}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=ROOT, help=argparse.SUPPRESS)
    parser.add_argument("--output", type=Path, help="Artifact directory; default: <source>/dist")
    args = parser.parse_args()
    try:
        print(json.dumps(build(args.source_root, args.output or args.source_root / "dist"), ensure_ascii=False))
    except (BuildError, subprocess.CalledProcessError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        message = str(exc) if isinstance(exc, BuildError) else type(exc).__name__
        print("BUILD ERROR: " + message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
