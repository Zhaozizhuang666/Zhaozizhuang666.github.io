#!/usr/bin/env python3
"""Create public learning-resource copies. Source files are always read-only."""

import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "resources"
VLA = PUBLIC / "vla-guide"
LEGACY_INIT = "<script>try{document.documentElement.dataset.theme=localStorage.getItem('vla-guide-theme')||'dark'}catch{}</script>"
LICENSES = ("LICENSE", "CONTENT_LICENSE.md", "THIRD_PARTY_NOTICES.md")
STATIC = {"index.html", "404.html", "search-index.json", "roles.json", "questions.json",
          "assets/app.js", "assets/careers.js", "assets/style.css", "assets/favicon.svg",
          "handbook/index.html", "industry/index.html", "interview/index.html"}
SNAPSHOT_REWRITES = {
    '页面结构参考 AIInfraGuide 的知识库导航，另外提供 Bento 路线演示文件。':
        '页面结构参考 AIInfraGuide 的知识库导航；本站副本以静态章节呈现学习路线。',
    '外部资源检查记录在 assets/resource-audit.json，HTTP 成功不保证用户网络、登录或内容正确。':
        '本站副本清单见 resources/manifest.json；该清单不代表第三方链接、用户网络、登录或内容已验证。',
}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def relative(target, page):
    return Path(os.path.relpath(target, page.parent)).as_posix()


def selected(rel):
    return rel in STATIC or bool(re.fullmatch(r"(?:docs|modules)/[a-z0-9-]+/index\.html", rel))


def source_snapshot(vla_source, network_source):
    paths = [network_source, *(vla_source / name for name in LICENSES)]
    paths += [p for p in (vla_source / "site").rglob("*") if p.is_file() and not p.is_symlink()]
    return {str(p): digest(p.read_bytes()) for p in paths}


def integrate_vla(content, target):
    if target.name == "404.html":
        content = content.replace("/vla-guide/", "./")
    if content.count(LEGACY_INIT) != 1:
        raise ValueError(f"Unexpected theme initializer: {target.relative_to(ROOT)}")
    content = content.replace(LEGACY_INIT, "")
    init = html.escape(relative(ROOT / "theme-init.js", target), quote=True)
    theme = html.escape(relative(ROOT / "theme.js", target), quote=True)
    # Run the shared blocking initializer before any stylesheet to avoid a flash.
    content = content.replace('<link rel="stylesheet"', f'<script src="{init}"></script><link rel="stylesheet"', 1)
    content = content.replace("</head>", f'<script src="{theme}" defer></script></head>', 1)
    content = content.replace('　<a href="https://bento.page/">Bento ↗</a>', '')
    content = content.replace('aria-label="切换深色主题" aria-pressed="false">◐',
                              'aria-label="Theme: Auto">Auto')
    home = html.escape(relative(ROOT / "index.html", target), quote=True)
    library = html.escape(relative(ROOT / "knowledge.html", target), quote=True)
    content = content.replace('<header class="topbar">',
        '<nav class="resource-return" aria-label="Personal website">'
        f'<a href="{home}">← Personal site</a><a href="{library}">Library</a></nav><header class="topbar">', 1)
    license_links = ' · '.join(f'<a href="{html.escape(relative(VLA / name, target), quote=True)}">{label}</a>'
                             for name, label in zip(LICENSES, ("Code license", "Content license", "Third-party notices")))
    content = content.replace("</footer>", '<p class="resource-attribution">'
        '原作：创享艺苑（VLA Guide） · '
        '<a href="https://github.com/Zhaozizhuang666/vla-guide" target="_blank" rel="noopener noreferrer">原项目</a>'
        '<br>本站副本仅调整导航、主题与部署路径；路线演示改用静态章节。<br>' + license_links + '</p></footer>', 1)
    if target == VLA / "index.html":
        old = re.compile(r'<div class="card feature" style="background:var\(--warm\)"><div class="eyebrow">A portable learning map / Bento</div>.*?</div></div></section>', re.S)
        content, changed = old.subn(
            '<div class="card feature" style="background:var(--warm)"><div class="eyebrow">A learning roadmap</div>'
            '<h3>按阶段建立你的学习路线。</h3><p>从本科基础、项目实践到研究生科研，按能力选择起点。'
            '这里使用静态章节，阅读不需要额外的演示运行时。</p><div class="actions">'
            '<a class="btn primary" href="docs/m9-01/">查看完整路线 ↗</a>'
            '<a class="btn" href="docs/year-one/">从大一开始 →</a></div></div></div></section>', content)
        if changed != 1:
            raise ValueError("Unexpected roadmap markup")
    if target == VLA / "docs/m8-03/index.html":
        content = content.replace('<p><a href="../../assets/resource-audit.json">查看本次链接检查记录（JSON）</a>：HTTP 成功不代表视频播放成功，时间、网络和页面渲染都有影响。</p>',
            '<p><a href="../../../manifest.json">查看本站资源副本清单（JSON）</a>：清单记录复制范围、文件哈希与限制，不代表第三方链接或视频已通过可达性验证。</p>')
    return content


VLA_CSS = """
/* Personal-site integration; original course layout is retained. */
.resource-return{display:flex;gap:24px;max-width:1440px;margin:auto;padding:8px 40px;font-size:11px;color:var(--sub)}
.resource-return a:hover,.resource-attribution a{text-decoration:underline;text-underline-offset:3px}
#theme-toggle{min-width:48px;padding-inline:8px;font-size:11px;font-weight:600}
.resource-attribution{font-size:10px;line-height:1.8;margin:0;color:var(--sub)}
.footer{flex-wrap:wrap;gap:20px}.resource-attribution{flex-basis:100%}
@media(max-width:780px){.resource-return{padding:7px 18px}.resource-attribution{font-size:10px}}
@media print{.resource-return{display:none}}
"""

NETWORK_CSS = """
/* Personal-site integration: shared appearance and neutral resource accents. */
:root{--primary:#555581;--primary-soft:#efeff7;--accent:#535583;--doc:#635b83;--doc-bg:#f2eff8}
:root[data-theme=dark]{--bg:#0d1118;--panel:#171d27;--text:#e6e8ef;--muted:#abb3c2;--border:#303a4a;--primary:#b6b4e5;--primary-soft:#25293d;--accent:#b8c0ef;--video:#f2a8ae;--video-bg:#35252c;--repo:#d5dae5;--repo-bg:#252d3b;--paper:#c9b6ed;--paper-bg:#302741;--doc:#c9b9e5;--doc-bg:#2c263d;--blog:#e8c18d;--blog-bg:#372d24}
.hero{background:linear-gradient(135deg,#4a4a68 0%,#626081 100%)}
:root[data-theme=dark] .hero{background:linear-gradient(135deg,#1b2032,#34334e)}
.resource-nav{display:flex;align-items:center;gap:22px;max-width:1100px;margin:auto;padding:12px 24px;font-size:12px}
.resource-nav a{color:var(--text);text-decoration:none}.resource-nav a:hover{text-decoration:underline}
.resource-nav button{margin-left:auto;background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:999px;padding:6px 13px;min-width:54px;font:inherit;cursor:pointer}
.resource-nav a:focus-visible,.resource-nav button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
section .goal{color:var(--text)}.resource-notice{grid-column:1/-1;background:var(--primary-soft);border:1px solid var(--border);color:var(--text);padding:12px 18px;border-radius:10px;font-size:14px}
.resource-caption{max-width:1052px;margin:18px auto 0;padding:0 24px;color:var(--muted);font-size:12px}.resource-caption a{color:var(--accent)}
main{min-width:0}table{display:block;overflow-x:auto}td,th{overflow-wrap:anywhere}
@media(max-width:600px){.hero{padding:32px 20px}.hero h1{font-size:25px}.wrap{padding:22px 16px 48px;gap:20px}section{padding:22px 18px}.res{gap:8px}.badge{padding:2px 7px}.resource-nav{padding:10px 18px}}
@media print{.resource-nav{display:none}:root,:root[data-theme=dark]{--bg:#fff;--panel:#fff;--text:#111;--muted:#444;--border:#ccc;--primary:#333;--accent:#333}.hero{background:#fff!important;color:#111}.wrap{display:block;padding:0}.toc{display:none}section{break-inside:avoid}table{display:table}}
"""


def integrate_network(content):
    content = content.replace('<title>', '<meta name="theme-color" content="#ffffff">\n'
        '<meta name="description" content="AI 算力网络学习导航：GPU 互联、RDMA、RoCE、NCCL 与集群容量规划。">\n'
        '<script src="../theme-init.js"></script>\n<title>', 1)
    content = content.replace('</style>', NETWORK_CSS + '</style>', 1)
    content = content.replace('</head>', '<script src="../theme.js" defer></script>\n</head>', 1)
    content = content.replace('<body>', '<body>\n<nav class="resource-nav" aria-label="Personal website">'
        '<a href="../index.html">← Personal site</a><a href="../knowledge.html">Library</a>'
        '<button id="theme-toggle" type="button" aria-label="Theme: Auto">Auto</button></nav>', 1)
    content = content.replace('<div style="grid-column:1/-1;background:#fffbeb;border:1px solid #fcd34d;color:#92400e;padding:12px 18px;border-radius:10px;font-size:14px">', '<div class="resource-notice">')
    # External pages opened in a new tab do not retain an opener reference.
    content = content.replace('target="_blank"', 'target="_blank" rel="noopener noreferrer"')
    # Keep the source URL scheme intact; link availability/content is not implied.
    content = content.replace('<div class="wrap">', '<p class="resource-caption">资源导航整理，第三方课程、论文与代码的版权归原权利人。'
        '课程、数值和外链以原始资料为准；本站未对全部外链进行可达性或技术结论认证。</p>\n<div class="wrap">', 1)
    return content


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--network-source", type=Path, required=True)
    parser.add_argument("--vla-source", type=Path, required=True, help="Repository root containing site/ and licenses")
    args = parser.parse_args()
    network_source = args.network_source.resolve(strict=True)
    vla_source = args.vla_source.resolve(strict=True)
    if PUBLIC.is_relative_to(vla_source) or VLA == vla_source:
        raise ValueError("Source and destination must be separate")
    before = source_snapshot(vla_source, network_source)
    PUBLIC.mkdir(exist_ok=True)
    VLA.mkdir(exist_ok=True)
    copied = []
    for source in sorted((vla_source / "site").rglob("*")):
        if source.is_symlink():
            raise ValueError("Source output contains a symlink")
        if not source.is_file():
            continue
        rel = source.relative_to(vla_source / "site").as_posix()
        if not selected(rel):
            continue
        target = VLA / rel
        content = source.read_text()
        if target.suffix in {".html", ".json"}:
            for old, new in SNAPSHOT_REWRITES.items():
                content = content.replace(old, new)
        if target.suffix == ".html":
            content = integrate_vla(content, target)
        elif rel == "assets/app.js":
            content = content.replace("const KEY='vla-guide-v2', THEME='vla-guide-theme';", "const KEY='vla-guide-v2';")
            content, count = re.subn(r"\$\('#theme-toggle'\)\.addEventListener\('click',.*?\n\$\('#theme-toggle'\)\.setAttribute\('aria-pressed'.*?\n", "", content, flags=re.S)
            if count != 1:
                raise ValueError("Unexpected VLA theme handlers")
        elif rel == "assets/style.css":
            content += VLA_CSS
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        copied.append(target)
    for name in LICENSES:
        target = VLA / name
        target.write_bytes((vla_source / name).read_bytes())
        copied.append(target)
    network_target = PUBLIC / "ai-network-learning.html"
    network_target.write_text(integrate_network(network_source.read_text()))
    copied.append(network_target)
    if before != source_snapshot(vla_source, network_source):
        raise RuntimeError("Source files changed while copying")
    manifest = {
        "format": "personal-site-learning-resources", "version": 1,
        "entries": [
            {"id": "ai-network-learning", "title": "AI Network Learning", "href": "resources/ai-network-learning.html",
             "description": "AI 算力中心网络学习导航，覆盖 GPU 互联、RDMA / RoCE、集合通信与容量规划。",
             "source": network_source.name, "sourceSha256": before[str(network_source)],
             "rights": "User-provided resource index; linked materials retain their original rights."},
            {"id": "vla-guide", "title": "VLA Guide", "href": "resources/vla-guide/",
             "description": "VLA 与具身智能学习知识库：基础、模型实践、评测部署、学习路径、岗位与面试。",
             "source": "vla-guide/site", "upstream": "https://github.com/Zhaozizhuang666/vla-guide",
             "attribution": "创享艺苑（VLA Guide）", "codeLicense": "MIT", "contentLicense": "CC-BY-4.0",
             "modules": 11, "chapters": 63, "roles": 24, "interviewQuestions": 80}
        ],
        "integration": ["Shared personal-site theme preference", "Parent website return links",
                        "Deployment-relative paths", "Static chapter roadmap replaces optional Bento presentation"],
        "excluded": [".git", "node_modules", "source drafts and development folders", "robots.txt", "sitemap.xml",
                     "assets/resource-audit.json", "vla-roadmap.bento.html"],
        "limitations": ["Third-party links and technical claims are not exhaustively verified.",
                        "Static snapshot; source updates require a new reviewed copy.",
                        "Progress is saved in the current browser; it is not cloud-synced.",
                        "Optional Bento editor/runtime excluded; original license documents are retained."],
        "sourceFilesUnchanged": True,
        "files": [{"path": p.relative_to(ROOT).as_posix(), "bytes": p.stat().st_size, "sha256": digest(p.read_bytes())}
                  for p in sorted(copied)]
    }
    (PUBLIC / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"copiedFiles": len(copied), "vlaPages": len(list(VLA.rglob('*.html'))),
                      "sourceFilesUnchanged": True, "manifest": "resources/manifest.json"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
