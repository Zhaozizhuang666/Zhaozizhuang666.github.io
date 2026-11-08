#!/usr/bin/env python3
"""Verify a public deployment against the exact, reviewed local artifact bytes.

Only GET responses with matching byte counts and SHA-256 hashes count as
successful. A release identity is required for CloudBase; branch-published
GitHub Pages may omit release.json, while its complete file set is still checked.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
FORMAT = "zizhuang-public-site-v1"
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_MANIFEST_BYTES = 2 * 1024 * 1024
MAX_FILES = 5000
SHA = re.compile(r"[0-9a-f]{40}")
HASH = re.compile(r"[0-9a-f]{64}")


class VerificationError(ValueError):
    pass


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def safe_name(value: object) -> str:
    if not isinstance(value, str) or not value:
        raise VerificationError("Invalid manifest file path")
    path = PurePosixPath(value)
    if (path.is_absolute() or str(path) != value or ".." in path.parts
            or "\\" in value or any(part.startswith(".") for part in path.parts)
            or any(ord(char) < 32 for char in value)):
        raise VerificationError("Invalid manifest file path")
    return value


def no_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise VerificationError("Duplicate release JSON key")
        result[key] = value
    return result


def parse_manifest(raw: bytes) -> dict[str, object]:
    if len(raw) > MAX_MANIFEST_BYTES:
        raise VerificationError("Release manifest exceeds size limit")
    try:
        manifest = json.loads(raw, object_pairs_hook=no_duplicate_keys)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise VerificationError("Invalid release manifest JSON") from exc
    if (not isinstance(manifest, dict) or manifest.get("format") != FORMAT
            or not isinstance(manifest.get("commit"), str)
            or not SHA.fullmatch(manifest["commit"])
            or not isinstance(manifest.get("sourceDirty"), bool)):
        raise VerificationError("Invalid release format or commit identity")
    entries = manifest.get("files")
    if not isinstance(entries, list) or not 1 <= len(entries) <= MAX_FILES:
        raise VerificationError("Invalid release file list")
    names = set()
    for item in entries:
        if not isinstance(item, dict):
            raise VerificationError("Invalid release file entry")
        name = safe_name(item.get("path"))
        if name == "release.json" or name in names:
            raise VerificationError("Duplicate or recursive release file entry")
        if (type(item.get("bytes")) is not int or not 0 <= item["bytes"] <= MAX_FILE_BYTES
                or not isinstance(item.get("sha256"), str)
                or not HASH.fullmatch(item["sha256"])):
            raise VerificationError("Invalid release file size or hash")
        names.add(name)
    if not {"index.html", "xiaoyi.js"}.issubset(names):
        raise VerificationError("Required public canary files are absent")
    return manifest


def local_artifact(artifact: Path) -> tuple[dict[str, object], bytes]:
    if artifact.is_symlink() or not artifact.is_dir():
        raise VerificationError("Artifact must be a real directory")
    identity = artifact / "release.json"
    if identity.is_symlink() or not identity.is_file() or identity.stat().st_size > MAX_MANIFEST_BYTES:
        raise VerificationError("Missing or invalid local release manifest")
    raw = identity.read_bytes()
    manifest = parse_manifest(raw)
    expected = {item["path"] for item in manifest["files"]} | {"release.json"}
    actual = set()
    for path in artifact.rglob("*"):
        if path.is_symlink():
            raise VerificationError("Artifact contains a symlink")
        if path.is_file():
            actual.add(path.relative_to(artifact).as_posix())
    if actual != expected:
        raise VerificationError("Artifact files differ from its release manifest")
    for item in manifest["files"]:
        path = artifact / item["path"]
        if path.stat().st_size != item["bytes"] or sha256(path.read_bytes()) != item["sha256"]:
            raise VerificationError("Local artifact hash mismatch: " + item["path"])
    return manifest, raw


def normalized_url(value: str, allow_local_http: bool) -> str:
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as exc:
        raise VerificationError("Invalid public site URL") from exc
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if (not parsed.hostname or parsed.username is not None or parsed.password is not None
            or parsed.query or parsed.fragment
            or not (parsed.scheme == "https" or (allow_local_http and local and parsed.scheme == "http"))
            or any(ord(char) < 33 for char in value)):
        raise VerificationError("Site URL must be HTTPS without credentials, query or fragment")
    # Permit a safe subdirectory base, but reject encoded separators and traversal.
    path = parsed.path or "/"
    if ("\\" in path or unquote(path) != path or ".." in PurePosixPath(path).parts
            or not path.startswith("/") or "//" in path):
        raise VerificationError("Invalid public site base path")
    if not path.endswith("/"):
        path += "/"
    # Accessing .port above validates it; preserve the caller's host spelling.
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def origin(url: str) -> tuple[str, str | None, int | None]:
    parsed = urlsplit(url)
    return parsed.scheme.lower(), parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80)


class SameOriginRedirects(HTTPRedirectHandler):
    def __init__(self, base: str):
        self.expected_origin = origin(base)

    def redirect_request(self, request, fp, code, message, headers, new_url):
        target = urljoin(request.full_url, new_url)
        parsed = urlsplit(target)
        if (origin(target) != self.expected_origin or parsed.username is not None
                or parsed.password is not None or parsed.fragment):
            raise VerificationError("Cross-origin or unsafe redirect rejected")
        return super().redirect_request(request, fp, code, message, headers, target)


def fetch(base: str, name: str, expected_bytes: int, expected_hash: str,
          optional_missing: bool = False) -> str | None:
    request_url = urljoin(base, quote(name, safe="/"))
    request = Request(request_url, headers={"Accept-Encoding": "identity", "Cache-Control": "no-cache"})
    try:
        opener = build_opener(SameOriginRedirects(base))
        with opener.open(request, timeout=20) as response:
            if response.status != 200:
                return "unexpected HTTP status"
            if origin(response.url) != origin(base):
                return "cross-origin redirect rejected"
            content_length = response.headers.get("Content-Length")
            if content_length is not None:
                try:
                    if int(content_length) != expected_bytes:
                        return "byte count mismatch"
                except ValueError:
                    return "invalid Content-Length"
            raw = response.read(expected_bytes + 1)
            if len(raw) != expected_bytes:
                return "byte count mismatch"
            if sha256(raw) != expected_hash:
                return "SHA-256 mismatch"
            return None
    except HTTPError as exc:
        if optional_missing and exc.code == 404:
            return None
        return "HTTP " + str(exc.code)
    except VerificationError:
        return "cross-origin or unsafe redirect rejected"
    except (URLError, TimeoutError, OSError, ValueError):
        return "request failed"


def expected_commit(explicit: str | None) -> str:
    value = explicit or os.environ.get("GITHUB_SHA")
    if value is None:
        try:
            value = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"],
                                            stderr=subprocess.PIPE, text=True).strip()
        except (OSError, subprocess.CalledProcessError) as exc:
            raise VerificationError("An expected production commit is required") from exc
    if not SHA.fullmatch(value):
        raise VerificationError("Expected production commit must be a full SHA")
    return value


def verify(artifact: Path, base: str, identity: str, attempts: int, delay: float,
           commit: str | None) -> dict[str, object]:
    manifest, raw = local_artifact(artifact)
    if identity == "required":
        if manifest["sourceDirty"]:
            raise VerificationError("A production release must come from a clean source checkout")
        if manifest["commit"] != expected_commit(commit):
            raise VerificationError("Artifact commit differs from the expected production HEAD")
    elif commit is not None and manifest["commit"] != expected_commit(commit):
        raise VerificationError("Artifact commit differs from the expected production HEAD")
    entries = {item["path"]: item for item in manifest["files"]}
    canaries = [entries["index.html"], entries["xiaoyi.js"]]
    pending = list(entries.values())
    checked = set()
    failures = {}
    full_check_started = False
    used = 0
    for attempt in range(1, attempts + 1):
        used = attempt
        failures = {}
        issue = fetch(base, "release.json", len(raw), sha256(raw), optional_missing=identity == "optional")
        if issue:
            failures["release.json"] = issue
        for item in canaries:
            issue = fetch(base, item["path"], item["bytes"], item["sha256"])
            if issue:
                failures[item["path"]] = issue
        if not failures:
            full_check_started = True
            with ThreadPoolExecutor(max_workers=6) as pool:
                issues = pool.map(lambda item: (item["path"], fetch(base, item["path"], item["bytes"], item["sha256"])), pending)
                for name, issue in issues:
                    if issue:
                        failures[name] = issue
                    else:
                        checked.add(name)
            pending = [entries[name] for name in failures if name in entries]
            if not failures:
                break
        if attempt < attempts:
            time.sleep(delay)
    return {
        "passed": not failures,
        "site": base,
        "commit": manifest["commit"],
        "identity": identity,
        "filesExpected": len(entries),
        "filesVerified": len(checked),
        "attempts": used,
        "fullCheckStarted": full_check_started,
        "failures": [{"path": name, "reason": issue} for name, issue in sorted(failures.items())],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--identity", choices=("required", "optional"), default="required")
    parser.add_argument("--expected-commit", help="Full production SHA; otherwise GITHUB_SHA or checkout HEAD")
    parser.add_argument("--attempts", type=int, default=8)
    parser.add_argument("--delay", type=float, default=15)
    parser.add_argument("--allow-local-http", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        if not 1 <= args.attempts <= 20 or not 0 <= args.delay <= 60:
            raise VerificationError("Attempts must be 1–20 and delay 0–60 seconds")
        base = normalized_url(args.url, args.allow_local_http)
        report = verify(args.artifact, base, args.identity, args.attempts, args.delay, args.expected_commit)
    except (VerificationError, OSError, KeyError, TypeError) as exc:
        message = str(exc) if isinstance(exc, VerificationError) else type(exc).__name__
        print(json.dumps({"passed": False, "error": message}, ensure_ascii=False))
        return 1
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
