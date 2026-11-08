#!/usr/bin/env python3
"""Publish a reviewed artifact without pruning unrelated hosting objects.

The prior release identity remains in place until upload, obsolete-file cleanup,
and content checks pass. This makes an interrupted update retryable. CloudBase
CLI 3.9.1 cannot enumerate its own hidden backups, so this wrapper deliberately
uses neither --safe nor --prune and never creates public backup directories.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("public_release", ROOT / "scripts/verify-public-release.py")
VERIFY = importlib.util.module_from_spec(spec)
spec.loader.exec_module(VERIFY)
ENTRY_FILES = {"index.html", "knowledge.html", "guide.html"}


class DeploymentError(ValueError):
    pass


def event(phase: str) -> None:
    print(json.dumps({"phase": phase}), flush=True)


class CLI:
    def __init__(self, executable: str, environment: str, cwd: Path):
        self.executable = executable
        self.environment = environment
        self.cwd = cwd

    def run(self, *arguments: str) -> object:
        # Capture output so credential-bearing diagnostics cannot enter CI logs.
        # Credentials are inherited from the caller's temporary CLI login only.
        command = [self.executable, *arguments, "-e", self.environment, "--yes", "--json"]
        try:
            process = subprocess.run(command, cwd=self.cwd, capture_output=True, text=True,
                                     timeout=600 if arguments[:2] == ("hosting", "deploy") else 120)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise DeploymentError("CloudBase CLI failed or timed out") from exc
        if process.returncode:
            raise DeploymentError("CloudBase CLI command failed; inspect the provider console")
        try:
            result = json.loads(process.stdout, object_pairs_hook=VERIFY.no_duplicate_keys)
        except (ValueError, TypeError) as exc:
            raise DeploymentError("CloudBase CLI did not return a valid JSON receipt") from exc
        if not isinstance(result, dict) or "error" in result or "data" not in result:
            raise DeploymentError("CloudBase CLI returned an unsuccessful receipt")
        return result

    def inventory(self) -> dict[str, int]:
        result = self.run("hosting", "list")
        entries = result["data"]
        if (not isinstance(entries, list) or len(entries) > 10000
                or not isinstance(result.get("meta"), dict)
                or result["meta"].get("total") != len(entries)):
            raise DeploymentError("Invalid CloudBase file inventory")
        files = {}
        for item in entries:
            if not isinstance(item, dict):
                raise DeploymentError("Invalid CloudBase file inventory entry")
            try:
                name = VERIFY.safe_name(item.get("key"))
            except VERIFY.VerificationError as exc:
                raise DeploymentError("Unrecognized remote file; no mutation is allowed") from exc
            size = item.get("size")
            if isinstance(size, str) and re.fullmatch(r"[0-9]+", size):
                size = int(size)
            if type(size) is not int or size < 0 or name in files:
                raise DeploymentError("Invalid or duplicate CloudBase inventory entry")
            files[name] = size
        return files

    def download(self, name: str, directory: Path, limit: int) -> bytes:
        target = directory / ("download-" + str(len(list(directory.iterdir()))))
        self.run("hosting", "download", name, str(target))
        if target.is_symlink() or not target.is_file() or target.stat().st_size > limit:
            raise DeploymentError("Invalid prior release download")
        return target.read_bytes()


def upload_receipt(result: object, expected: int, directory: bool) -> None:
    data = result.get("data") if isinstance(result, dict) else None
    if (not isinstance(data, dict) or type(data.get("failedCount")) is not int
            or data["failedCount"] != 0 or data.get("successCount") != expected
            # CLI 3.9.1 counts directory files before applying --ignore.
            or data.get("totalFiles") != expected + (1 if directory else 0)
            or (directory and data.get("verified") is not True)
            or data.get("backupPrefix") is not None or data.get("prune") is not None):
        raise DeploymentError("CloudBase upload was incomplete or returned unexpected cleanup state")


def content_matches(base: str, manifest: dict, attempts: int, delay: float) -> None:
    pending = manifest["files"]
    for attempt in range(attempts):
        with ThreadPoolExecutor(max_workers=6) as pool:
            checked = pool.map(lambda item: (item, VERIFY.fetch(base, item["path"], item["bytes"], item["sha256"])), pending)
            pending = [item for item, issue in checked if issue]
        if not pending:
            return
        if attempt + 1 < attempts:
            time.sleep(delay)
    raise DeploymentError("Current public files do not match the reviewed artifact; release identity was not committed")


def remote_absent(base: str, name: str) -> bool:
    request = Request(urljoin(base, quote(name, safe="/")), headers={"Cache-Control": "no-cache"})
    try:
        with build_opener(VERIFY.SameOriginRedirects(base)).open(request, timeout=20):
            return False
    except HTTPError as exc:
        return exc.code == 404
    except (URLError, OSError, ValueError, VERIFY.VerificationError):
        return False


def confirm_absent(base: str, names: set[str], attempts: int, delay: float) -> None:
    pending = names
    for attempt in range(attempts):
        with ThreadPoolExecutor(max_workers=6) as pool:
            checked = pool.map(lambda name: (name, remote_absent(base, name)), pending)
            pending = {name for name, absent in checked if not absent}
        if not pending:
            return
        if attempt + 1 < attempts:
            time.sleep(delay)
    raise DeploymentError("Withdrawn public files are still reachable; release identity was not committed")


def deploy(artifact: Path, base: str, environment: str, executable: str,
           commit: str | None, attempts: int, delay: float) -> dict:
    manifest, raw = VERIFY.local_artifact(artifact)
    production_commit = VERIFY.expected_commit(commit)
    if manifest["sourceDirty"] or manifest["commit"] != production_commit:
        raise DeploymentError("Deployment requires a clean artifact for the expected production commit")
    current = {item["path"]: item for item in manifest["files"]}
    if not ENTRY_FILES.issubset(current) or any(Path(name).name == "release.json" for name in current):
        raise DeploymentError("Required entry files are missing or a nested release manifest is present")
    expected = set(current) | {"release.json"}
    artifact = artifact.resolve()
    with tempfile.TemporaryDirectory(prefix="cloudbase-publish-") as scratch:
        directory = Path(scratch)
        cli = CLI(executable, environment, directory)
        event("checking remote ownership")
        before = cli.inventory()
        prior = {}
        if before:
            if "release.json" not in before:
                raise DeploymentError("Nonempty hosting has no reviewed release identity; no mutation is allowed")
            previous_raw = cli.download("release.json", directory, VERIFY.MAX_MANIFEST_BYTES)
            previous = VERIFY.parse_manifest(previous_raw)
            if previous["sourceDirty"]:
                raise DeploymentError("Prior remote release is not a clean reviewed artifact")
            prior = {item["path"]: item for item in previous["files"]}
            # Old identity plus known current files is an interrupted update.
            # Unknown visible objects are never overwritten or deleted.
            if set(before) - (set(prior) | expected):
                raise DeploymentError("Unrecognized remote files; no mutation is allowed")
            retrying_bootstrap = previous_raw == raw
            # A prior run may have uploaded some current files before stopping.
            # Check every visible object's size before potentially overwriting it;
            # canary hashes below identify the reviewed site without hundreds of
            # slow CLI subprocess downloads. Full HTTPS hashes are checked later.
            for name, size in before.items():
                if name == "release.json":
                    continue
                candidates = [item for item in (prior.get(name), current.get(name)) if item]
                if not candidates or size not in {item["bytes"] for item in candidates}:
                    raise DeploymentError("Remote file differs from its prior and current release; no mutation is allowed")
            for name in ("index.html", "xiaoyi.js"):
                if name not in before:
                    if retrying_bootstrap:
                        continue
                    raise DeploymentError("Prior release canary is missing; no mutation is allowed")
                candidates = [item for item in (prior.get(name), current.get(name)) if item]
                content = cli.download(name, directory, max(item["bytes"] for item in candidates))
                if not any(len(content) == item["bytes"] and VERIFY.sha256(content) == item["sha256"] for item in candidates):
                    raise DeploymentError("Prior release canary has unknown bytes; no mutation is allowed")
        else:
            # A small identity marker makes interrupted first uploads retryable.
            # It is not a success signal: public file verification is still required.
            event("initializing empty dedicated hosting")
            upload_receipt(cli.run("hosting", "deploy", str(artifact / "release.json"), "release.json", "--verify"), 1, False)

        event("uploading current public files")
        upload_receipt(cli.run("hosting", "deploy", str(artifact), "/", "--ignore", "release.json",
                               "--verify", "--entry", "index.html,knowledge.html,guide.html"), len(current), True)
        visible = cli.inventory()
        obsolete = set(prior) - set(current)
        if set(visible) - (expected | obsolete) or not expected.issubset(visible):
            raise DeploymentError("Remote inventory changed unexpectedly; no cleanup is allowed")
        event("verifying current public file bytes")
        content_matches(base, manifest, attempts, delay)

        event("removing only withdrawn release files")
        for name in sorted(obsolete & set(visible)):
            cli.run("hosting", "delete", name)
        if obsolete:
            confirm_absent(base, obsolete, attempts, delay)
        if set(cli.inventory()) != expected:
            raise DeploymentError("Remote file cleanup is incomplete; release identity was not committed")

        event("committing and verifying release identity")
        upload_receipt(cli.run("hosting", "deploy", str(artifact / "release.json"), "release.json", "--verify"), 1, False)
        report = VERIFY.verify(artifact, base, "required", attempts, delay, production_commit)
        if not report["passed"]:
            raise DeploymentError("Final public release identity or file hash verification failed")
        if set(cli.inventory()) != expected:
            raise DeploymentError("Final remote file inventory differs from the reviewed release")
        return {"passed": True, "site": base, "commit": production_commit,
                "filesVerified": report["filesVerified"], "withdrawnFiles": len(obsolete),
                "publicBackupsCreated": False, "visibleInventoryVerified": True}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--env-id", default=os.environ.get("CLOUDBASE_ENV_ID"))
    parser.add_argument("--cli", default="tcb", help="Official CloudBase CLI executable")
    parser.add_argument("--expected-commit")
    parser.add_argument("--attempts", type=int, default=8)
    parser.add_argument("--delay", type=float, default=15)
    args = parser.parse_args()
    try:
        if (not args.env_id or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", args.env_id)
                or not 1 <= args.attempts <= 20 or not 0 <= args.delay <= 60):
            raise DeploymentError("A valid dedicated environment and bounded retry settings are required")
        base = VERIFY.normalized_url(args.url, False)
        report = deploy(args.artifact, base, args.env_id, args.cli, args.expected_commit, args.attempts, args.delay)
    except (DeploymentError, VERIFY.VerificationError, OSError, KeyError, TypeError) as exc:
        message = str(exc) if isinstance(exc, (DeploymentError, VERIFY.VerificationError)) else type(exc).__name__
        print(json.dumps({"passed": False, "error": message}), flush=True)
        return 1
    print(json.dumps(report), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
