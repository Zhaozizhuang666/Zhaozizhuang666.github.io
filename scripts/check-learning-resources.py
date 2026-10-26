#!/usr/bin/env python3
"""Validate public learning-resource copies without changing any source files."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit, quote
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "resources"


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.links = []
        self.scripts = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        for attr in ("href", "src"):
            if attrs.get(attr):
                self.links.append((tag, attr, attrs[attr]))
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Optional local preview origin, e.g. http://127.0.0.1:8013")
    parser.add_argument("--vla-source", type=Path, help="Optional read-only upstream root for license checks")
    args = parser.parse_args()
    manifest = json.loads((PUBLIC / "manifest.json").read_text())
    failures = []
    files = [ROOT / item["path"] for item in manifest["files"]]
    pages = {p: Page(p.read_text()) for p in files if p.suffix == ".html"}
    local_links = anchors = http_files = 0

    def fail(path, issue):
        failures.append({"path": str(path.relative_to(ROOT)), "issue": issue})

    for item, path in zip(manifest["files"], files):
        raw = path.read_bytes()
        if len(raw) != item["bytes"] or hashlib.sha256(raw).hexdigest() != item["sha256"]:
            fail(path, "Manifest size/hash mismatch")
        text = raw.decode("utf-8")
        patterns = {
            "Local filesystem path": r"file://|/Users/|/home/|[A-Z]:\\(?:Users|Documents)\\",
            "Private-key marker": r"-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----",
            "Possible credential shape": r"\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b",
        }
        for label, pattern in patterns.items():
            if re.search(pattern, text):
                fail(path, label)  # Do not include the matched value in logs.
        if path.suffix != ".html":
            continue
        if "vla-guide-theme" in text or "vla-roadmap.bento.html" in text or "resource-audit.json" in text:
            fail(path, "Legacy integration reference")
        page = pages[path]
        initializers = [s for s in page.scripts if s.endswith("theme-init.js")]
        controllers = [s for s in page.scripts if s.endswith("theme.js")]
        if len(initializers) != 1 or len(controllers) != 1:
            fail(path, "Shared theme scripts missing or repeated")
        if path.parent != PUBLIC and text.index("theme-init.js") > text.index('<link rel="stylesheet"'):
            fail(path, "Theme initializer runs after stylesheet")
        for script in page.scripts:
            if urlsplit(script).scheme or script.startswith("//"):
                fail(path, "Unexpected remote script")
        for tag, attr, href in page.links:
            parts = urlsplit(href)
            if parts.scheme in {"javascript", "file"}:
                fail(path, "Unsafe URL scheme")
            if parts.scheme or parts.netloc:
                continue
            if parts.path.startswith("/"):
                fail(path, "Root-absolute link breaks project deployment")
                continue
            target = (path.parent / unquote(parts.path)).resolve() if parts.path else path
            if target.is_dir():
                target /= "index.html"
            if not target.is_relative_to(ROOT) or not target.is_file():
                fail(path, "Broken local link: " + href)
                continue
            local_links += 1
            if parts.fragment and target.suffix == ".html":
                if target not in pages:
                    pages[target] = Page(target.read_text())
                if unquote(parts.fragment) not in pages[target].ids:
                    fail(path, "Missing local fragment: " + href)
                anchors += 1
        match = re.search(r"window\.VLA_CONFIG=(\{.*?\});", text)
        if match:
            cfg = json.loads(match.group(1))
            base = (path.parent / cfg["base"]).resolve()
            for name in ("search-index.json", "roles.json", "questions.json"):
                if not (base / name).is_file():
                    fail(path, "Broken data base: " + name)

    vla = PUBLIC / "vla-guide"
    for role in json.loads((vla / "roles.json").read_text()):
        if not (vla / "docs" / role["study"] / "index.html").is_file():
            fail(vla / "roles.json", "Unknown study chapter for role " + role["id"])
    for article in json.loads((vla / "search-index.json").read_text()):
        if not (vla / "docs" / article["id"] / "index.html").is_file():
            fail(vla / "search-index.json", "Unknown search chapter: " + article["id"])
    if args.vla_source:
        for name in ("LICENSE", "CONTENT_LICENSE.md", "THIRD_PARTY_NOTICES.md"):
            if (vla / name).read_bytes() != (args.vla_source / name).read_bytes():
                fail(vla / name, "License differs from upstream")

    if args.url:
        def check_http(path):
            try:
                with urlopen(args.url.rstrip("/") + "/" + quote(path.relative_to(ROOT).as_posix()), timeout=10) as response:
                    if response.status != 200 or response.read() != path.read_bytes():
                        return path, "HTTP content/status mismatch"
            except Exception as exc:
                return path, "HTTP request failed: " + type(exc).__name__
            return None
        with ThreadPoolExecutor(max_workers=8) as pool:
            for result in pool.map(check_http, files):
                if result:
                    fail(*result)
                else:
                    http_files += 1

    print(json.dumps({"passed": not failures, "manifestFiles": len(files),
                      "htmlPages": len([p for p in files if p.suffix == '.html']),
                      "localLinksChecked": local_links, "anchorsChecked": anchors,
                      "httpFilesVerified": http_files, "failures": failures}, ensure_ascii=False, indent=2))
    raise SystemExit(bool(failures))


if __name__ == "__main__":
    main()
