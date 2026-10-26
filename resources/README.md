# Learning resources

Public static copies for the personal website:

- [AI Network Learning](ai-network-learning.html): AI 算力中心网络学习导航，覆盖 GPU 互联、RDMA / RoCE、集合通信与容量规划。
- [VLA Guide](vla-guide/): VLA 与具身智能学习知识库，包含基础、模型实践、评测部署、学习路线、岗位探索与原创面试练习。

The snapshot contains 80 HTML pages: one AI networking index and 79 VLA pages. VLA includes 11 modules, 63 chapters, 24 role profiles and 80 interview practice questions. [manifest.json](manifest.json) lists the 90 distributed files with byte sizes and SHA-256 hashes.

## Integration

All pages use the personal site's shared `theme-init.js` and `theme.js`. A manual Light or Dark choice persists when navigating between the main site and these resources; Auto follows the operating system. Source content remains independent from Xiaoyi's visitor memories.

The VLA search, chapter progress, role filtering and interview favorites remain available. Progress and favorites stay in the current browser; use the built-in exports for a portable backup. This copy includes no account or cloud synchronization.

Source directories are read-only inputs. The publishing script copies the deployable `site/` output and records source hashes before and after. Development folders, Git history, the optional Bento editor/presentation runtime, stale link-audit data and root-specific sitemap/robots files are excluded. The roadmap uses ordinary chapter links. Navigation, deployment paths, shared themes and snapshot-scope descriptions are adjusted in the published copies.

## Rights and limits

VLA code is MIT; original tutorial content is CC BY 4.0, attributed to 创享艺苑（VLA Guide）. See the exact upstream [code license](vla-guide/LICENSE), [content license](vla-guide/CONTENT_LICENSE.md) and [third-party notices](vla-guide/THIRD_PARTY_NOTICES.md). The original project is [VLA Guide on GitHub](https://github.com/Zhaozizhuang666/vla-guide). The published pages retain attribution and state the integration changes.

The user-provided AI networking index has no explicit license declaration; it is not relabeled MIT or CC. Linked courses, papers, videos and repositories retain their original rights. Third-party availability and technical claims have not been exhaustively verified. These resources are a static snapshot, not an automatically updated mirror.

## Refresh and verify

From the website root, using the chosen local source paths:

```sh
python3 scripts/sync-learning-resources.py --network-source '<network-index.html>' --vla-source '<vla-guide-repository>'
python3 scripts/check-learning-resources.py --vla-source '<vla-guide-repository>'
```

Optional HTTP verification against a running local preview:

```sh
python3 scripts/check-learning-resources.py --url http://127.0.0.1:8013 --vla-source '<vla-guide-repository>'
```

The checker validates manifest hashes, local links and anchors, data dependencies, theme script paths/order, license preservation, common private-path/credential patterns, and optional HTTP byte equality. It does not execute third-party scripts or validate all external content.

## Validation

Three complementary passes completed on this snapshot:

1. Static and independent read-only review: all 90 file hashes, 7,737 local references, 763 anchors, license bytes and theme script paths passed. No symlinks, remote active resources, local user paths or common secret patterns were found.
2. Browser checks: full-text search, chapter completion and reload persistence, role filtering and details, interview filters/expanded answers/favorites and reload persistence passed. Manual Light/Dark remained consistent across resource pages, reloads and return to the main site. Mobile checks at 390 px had no document overflow; the chapter menu opened correctly. Checked chapter console logs contained no warnings or errors.
3. HTTP and shared-theme regression: all 90 manifest files returned HTTP 200 with exact file bytes; both resource JavaScript syntax checks passed; all 14 shared-theme tests passed. An independent VM check also covered six system-theme/preference combinations.

Browser verification sampled representative interactive pages; it is not a claim that every external link or every possible browser has been tested.
