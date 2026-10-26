# Site handbook

This is the short operating guide for Zizhuang Zhao’s personal site. The public site is an English-first profile with Chinese context, a local Xiaoyi knowledge assistant, and a curated Library.

## 1. Usage

- **Home** presents the profile, current robotics end-to-end evaluation work, projects, learning, research and IP, community work, and selected public reports. Learning and Community link to four public documents: three business materials and a 6G course paper.
- **Library** provides searchable competition and journal directories and a **Learning** category for the local VLA Guide and AI Network Learning copies.
- **Xiaoyi** gives a first explanation and points to sources. Open the source before relying on an important detail.

The site is a curated personal workspace. It is not a complete directory, live deadline tracker, or replacement for an official announcement.

## 2. Language, theme and layout

The compact header control offers EN/中文 alongside Auto, Light, and Dark. The site starts in English; choosing 中文 translates the site copy locally and is remembered across Home, Library, Guide, and reloads. Original source titles, proper names, and Xiaoyi conversation messages remain unchanged. This switch does not call or repair Chrome/Google Translate.

The theme button cycles through Auto, Light, and Dark. Auto follows the operating system. Explicit Light or Dark is stored locally and persists between Home, Library, Guide, local learning-resource pages, and reloads; Auto clears the explicit override. Xiaoyi follows the selected appearance, and reduced motion keeps content visible without entrance animation. External sites control their own themes; the learning copies retain their original content language.

On desktop, the page scales into the space beside the Xiaoyi drawer. The drawer can be on either edge. A new visit defaults to the right; dragging changes the side and height for the current visit. On mobile, the drawer is a modal with focus management.

## 3. Xiaoyi — website knowledge entry

The default local mode reads the checked-in files in `data/` through `xiaoyi-engine.js`. It can explain indexed competitions, journals, and technical topics and attach available sources. It does not browse the web in real time, train itself, or guarantee current deadlines, rules, model capabilities, or results.

Good prompts are focused and explicit:

1. Ask one subject: “What is VLN?”
2. Ask for the source or a comparison: “好的，把链接给我” or “How do SR and SPL differ?”
3. Change topic explicitly: “Now leave VLN and explain VLA.”
4. Select **New chat** when the previous context should not carry over. Saved records remain available in Memory.

Example path: **VLN → open the cited paper → ask about SR and SPL → compare the definitions with the evaluation protocol**. The link is evidence to inspect, not a substitute for the protocol.

### Memory stream

With Memory on, the active conversation is restored after a reload or when moving between Home, Library, and Guide in the same tab and site origin. Open **Memory · N** to review recent completed exchanges. **New chat** starts with a fresh active context and keeps the older stream in that tab. Choose **Continue** on a record to restore that entire conversation session explicitly; older sessions do not enter a new conversation automatically.

The memory view offers **Memory on/off**, **Delete** for one record, and **Clear all**. Turning Memory off preserves existing records but stops future saves; the current chat remains in memory until reload or New chat, and reload does not restore it while off. **Delete** removes one saved turn and rebuilds the active transcript if it belongs to that session. **Clear all** deletes the stored stream and clears active messages. It keeps at most the latest 24 completed exchanges, with additional limits of 6,000 characters per message field, 24,000 combined content characters, and 60,000 serialized UTF-8 bytes. Older records are trimmed when needed. Session storage can be cleared by the visitor or browser; if unavailable, the stream remains in page memory only until navigation or reload.

Memory uses the current tab’s `sessionStorage`, not browser-wide `localStorage`; older localStorage records are not read or migrated. Independent browser sessions and ordinary new tabs have separate streams. Duplicating a tab, using an opener, or restoring a browser session can copy or restore session storage. The static site has no user login and cannot identify different people sharing the same open tab. Use **Clear all** before handing that tab to another person; **New chat** alone leaves the older stream visible. Closing a tab normally ends its session, but shared-device privacy should not depend on browser cleanup. This provides tab-session isolation, without model training, account-based memory, or cross-device synchronization.

Past questions and answers are records rather than verified facts or curated knowledge. You can ask what was discussed before; the recalled user-authored questions remain unverified conversation records. To use an older session as context, select **Continue**. Avoid recording sensitive information.

The current site uses local knowledge mode only and does not send conversations to an online model. Opening an external AI website does not transfer your Xiaoyi conversation or memory.

## 4. Library

The current Library has three categories:

- **86 competitions**, with the supplied school directory’s A, B1, and B2 labels.
- **6,430 journals**, organized as first- and second-batch directory lists.
- **Learning**, with [VLA Guide](../resources/vla-guide/) and [AI Network Learning](../resources/ai-network-learning.html).

Search by title, organizer, or keyword, use the filter, and open the source or search entry on a result card. Competition labels are from the supplied Shanxi Institute of Technology directory and are not universal national rankings. Journal batches are directory classifications and do not judge article quality. The technical collection is curated and can grow; avoid hardcoding a total in user-facing copy.

In [Learning](../knowledge.html#learning), search by a title or topic such as VLA or RDMA, filter by VLA or AI Network, and open the local reading copy. VLA Guide includes chapter search, browser-local progress, role exploration and original interview exercises with favorites; use its exports for a portable backup. AI Network Learning links to courses, papers and code about GPU interconnects, RDMA / RoCE, collective communication and cluster planning; it has no progress tracking.

These are static learning resources, not validated deployment results. Xiaoyi indexes curated summaries and entry points, without claiming to have read every page or reproduced every experiment. VLA code is MIT, and original tutorial content is CC BY 4.0 with attribution. The network index has no explicit license declaration; linked materials keep their own rights. See the [resource notes](../resources/README.md) and [snapshot manifest](../resources/manifest.json).

### Public documents and naming

The four published documents are:

- [Business plan · DOCX](../assets/documents/chuangxiang-business-plan.docx), [business model · PPTX](../assets/documents/chuangxiang-business-model.pptx) and [business model · PDF](../assets/documents/chuangxiang-business-model.pdf).
- [6G course paper · PDF](../assets/documents/6g-data-flows-embodied-ai-course-paper.pdf), **《6G时代数据要素安全流通赋能具身智能》**. It records advanced-training study and a proposed research framework; it is not a published journal article, completion certificate, or evidence of validated deployment. The published journal article remains a separate Research & IP record linked to its DOI.

## 5. External AI websites

Xiaoyi exposes only **Knowledge / 知识模式**. The **AI Websites** section in its drawer is collapsed by default and opens these separate services in the current page:

- [DeepSeek](https://chat.deepseek.com/)
- [Tongyi Qianwen](https://www.tongyi.com/)
- [Kimi](https://www.kimi.com/)
- [Doubao](https://www.doubao.com/chat/)
- [Zhipu Qingyan](https://chatglm.cn/)
- [Tencent Yuanbao](https://yuanbao.tencent.com/)

These are external links, not model connections inside Xiaoyi. Conversations and memory are not transferred. Each service manages its own account, privacy settings, and availability.

The server adapters under `server/` remain as a future extension point. No online endpoint or Worker is enabled in the current site. GitHub Pages serves only the static frontend; a future online integration would need a separately deployed backend and server-side credentials. Keep keys out of `xiaoyi-config.js`, HTML, and Git. See [`server/README.md`](../server/README.md) for the optional protocol and deployment details.

## 6. Maintenance and release

Preview locally from the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`, then run:

```sh
node --test tests/*.test.mjs
```

Use the three independent rounds in [`QA.md`](../QA.md): behavior and content contracts; browser layout, themes, drawer, library, and motion; then publishing verification. Check links, assets, focus behavior, no horizontal overflow, and the public pages after Pages deployment. Local tests do not prove a deployment or an online provider.

For the four public documents, run `python3 scripts/sync-public-documents.py sync` and `python3 scripts/sync-public-documents.py --check` from the repository root before publishing. The allowlist includes the three business files and one 6G course-paper PDF. Original files stay unchanged; the [public manifest](../assets/documents/manifest.json) records file hashes and source modification times. Pages cannot read a local Mac folder, so source edits require another sync and deployment.

Refresh learning-resource copies separately with `scripts/sync-learning-resources.py`, using the source arguments in [resources/README.md](../resources/README.md), and run `scripts/check-learning-resources.py`. Review the scope and licensing before publishing a new copy; the source directories remain read-only inputs.

The free Pages hostname follows the GitHub account/repository, currently `https://zhaozizhuang666.github.io/`. `zizhuang.zhao` is a display name; changing the public hostname requires a separately owned custom domain and DNS configuration. Do not claim a public deployment until the branch, Pages status, HTTPS response, and fresh-browser content have all been checked.
