# Zizhuang Zhao · Personal Homepage

English-first personal website for Zizhuang Zhao (赵子状), built with plain HTML, CSS, and JavaScript for GitHub Pages.

The compact EN/中文 header switch translates site copy locally and remembers the choice across Home, Library, Guide, and reloads. Source titles, names, contacts, and Xiaoyi conversation messages stay intact; this does not depend on Chrome/Google Translate.

The header’s Auto / Light / Dark control applies across Home, Library, Guide, the local learning-resource pages, and reloads. With no deliberate saved choice, Auto follows the visitor’s system appearance. Explicit Light or Dark choices are saved under the versioned `zizhuang-theme-choice-v1` key when local storage is available; choosing Auto removes that override. Legacy preferences are ignored. Xiaoyi’s colors follow the active appearance; its normal Auto outfit, happy Light outfit, and sleepy Dark outfit follow the selected mode rather than the system’s resolved color.

## Preview locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Current structure

- About: robotics evaluation, VLA, computer vision, and model deployment.
- Experience: current Robotics End-to-End Evaluation Engineer role at Spirit AI, with concise entries for 清华研究院 and 易点云.
- Learning: AI Agent study at Origin School and Origin Night School, plus a 6G and secure-data-flows training programme and its course paper. The course paper is not presented as a published journal article or completion certificate.
- Research & IP: one paper and four patent records; titles, identifiers, and source links, without author lists or dates.
- Projects: VLA Guide, intelligent parcel robot, steel surface defect detection, and model deployment explorations.
- Community: Chuangxiang Yiyuan, Youyu social practice, volunteering, and event coordination, with proposed embodied-intelligence and AI Agent/Skill directions.
- Media: selected public reports and project stories from 2024–2026, linked to their original pages or a stable official-account search entry.
- Knowledge Library: searchable competition and journal directories, plus a Learning category linking to the local VLA Guide and AI Network Learning copies.
- Xiaoyi: the website knowledge entry, presented as a collapsible assistant with local retrieval and a bounded local memory stream. The published site currently uses local knowledge mode only.
- [Site Handbook](guide.html): visitor guidance for navigation, themes, Xiaoyi, the Library, external AI websites, and release maintenance.
- Contact: GitHub, VLA Guide, email, and WeChat.

## Xiaoyi knowledge and local mode

The default Knowledge mode uses the curated files in `data/` and local retrieval logic. It can explain indexed topics and cite available sources; it is not a trained or fine-tuned language model and does not browse the web in real time. Missing details, such as current competition deadlines, still need the relevant official announcement.

The Library's [Learning category](knowledge.html#learning) provides two public reading resources: [VLA Guide](resources/vla-guide/), with staged chapters, search, local progress, role exploration and original interview exercises; and [AI Network Learning](resources/ai-network-learning.html), an index of GPU-interconnect, RDMA / RoCE, collective-communication and cluster-planning resources. These are static copies. Xiaoyi retrieves curated summaries and source links, without claiming to have absorbed every page or reproduced the experiments. VLA progress and favorites are saved in the current browser and can be exported; the network index has no progress tracking. See [resource scope, licenses and validation](resources/README.md) and the [file manifest](resources/manifest.json).

Xiaoyi’s **Memory stream** keeps a bounded record of completed exchanges in the current tab session and site origin, using `sessionStorage` under `xiaoyi-memory-session-v2`. It never reads or migrates the older browser-wide `localStorage` stream. With Memory on, the active conversation returns after a reload or when moving between Home, Library, and Guide in the same tab. **New chat** starts a fresh context while preserving older records in that tab; use **Memory · N → Continue** to restore an older conversation session explicitly. Past assistant answers remain conversation records, not verified facts or additions to the curated knowledge base.

The memory view provides **Memory on/off**, **Delete** for a record, and **Clear all**. Turning Memory off keeps existing records but stops future local saves; the current in-memory chat continues until reload or New chat, and a reload does not restore it while memory is off. **Clear all** deletes the stored stream and clears the active messages. **Delete** removes one saved turn and rebuilds the active transcript when that turn belongs to the current session. Storage is limited to the latest 24 completed exchanges, at most 6,000 characters per user or assistant field, 24,000 combined content characters, and 60,000 serialized UTF-8 bytes; older records are trimmed as needed. When session storage is unavailable, records remain in page memory only and are lost on navigation or reload. This is local conversation recall, without model training, an account, or cross-device synchronization.

Independent browser sessions and ordinary new tabs have separate streams. Browser tab duplication, an opener, or session restoration may copy or restore a tab’s session storage; this is tab-session isolation, not authenticated user isolation. The static site cannot identify different people sharing one open tab. Before handing that tab to another person, use **Clear all**; **New chat** resets context but leaves prior records visible in Memory. Closing a tab normally ends its session, but use Clear all rather than relying on browser session cleanup on a shared device. A future account-based service must enforce user ownership on the server before supporting shared or cross-device memories.

The published Xiaoyi UI exposes only `Knowledge / 知识模式`. It reads the curated files in `data/` through local retrieval and does not send conversations to an online model. The static frontend has no live endpoint configured. The server adapters under `server/` remain as a future extension point; they are not enabled by the checked-in `xiaoyi-config.js` and are not reachable from the current site. Never place API keys in frontend files.

The collapsed **AI Websites** section provides direct links to [DeepSeek](https://chat.deepseek.com/), [Tongyi Qianwen](https://www.tongyi.com/), [Kimi](https://www.kimi.com/), [Doubao](https://www.doubao.com/chat/), [Zhipu Qingyan](https://chatglm.cn/), and [Tencent Yuanbao](https://yuanbao.tencent.com/). These are external websites, not API integrations. Opening a link does not transfer the Xiaoyi conversation or memory; each service manages its own account, privacy settings, and availability.

The optional backend adapters and their setup details remain in [`server/README.md`](server/README.md) and the [Workers AI notes](server/CLOUDFLARE-WORKERS-AI.md). They require a separately deployed backend and server-side credentials or bindings. No Worker or online model is publicly enabled by this frontend. A future integration must preserve request limits and memory isolation. Avoid storing sensitive information in conversation records.

## Verification before publishing

Run the automated contracts with Node.js 22 or later:

```bash
node --test tests/*.test.mjs
```

The latest local run passed **132 of 132 tests**. This covers retrieval and conversation contracts (including VLN source follow-ups, site-guide answers, business-plan answers, the 6G course-paper materials, memory-stream controls, and natural third-turn preparation questions), API validation and adapters for GLM-5.3, Tencent TokenHub Kimi K3, Ark Doubao Responses, and Workers AI's four verified model contracts, language switching, theme persistence, refresh behavior, and the collapsed AI Websites directory. Provider tests use simulated services. The six external AI website entries were also clicked individually in Chrome; each navigated to its corresponding service. See [QA.md](QA.md) for the publication status and the three independent release rounds required for future changes.

## Public contact details

- GitHub: `https://github.com/Zhaozizhuang666`
- VLA Guide: `https://zhaozizhuang666.github.io/vla-guide/`
- Email: `zizhuang.zhao@spirit-ai.com`
- WeChat: `Z02-Sept13` — 合作请备注来意

The original CV and other working documents stay local. Two owner-authorized public PDF documents are available across Learning and Community:

- Business material: [business model · PDF](assets/documents/chuangxiang-business-model.pdf).
- Training material: [6G course paper · PDF](assets/documents/6g-data-flows-embodied-ai-course-paper.pdf), **《6G时代数据要素安全流通赋能具身智能》**. This is a course paper from advanced training, not a published journal article, a completion certificate, or evidence of validated deployment.

The page uses the blue, black, white, and light-gray visual system requested by the owner; it does not use the earlier green palette.

To refresh the attachments, run `python3 scripts/sync-public-documents.py sync`, then `python3 scripts/sync-public-documents.py --check` before committing and publishing. The script copies only two allowlisted PDF files and records hashes in [assets/documents/manifest.json](assets/documents/manifest.json); it never changes the originals. GitHub Pages serves the published copies and cannot watch a folder on this Mac. A source update becomes public after synchronization, commit, and a successful Pages deployment. Refresh the separate learning-resource copies with `scripts/sync-learning-resources.py`, then run `scripts/check-learning-resources.py`; see [resources/README.md](resources/README.md) for the source arguments and checks.

## Content sources

Patent titles and publication types are linked to the owner-provided CNKI records. The published journal article links to its DOI; the separate 6G course paper stays under Learning. The community gallery uses photographs from the linked Chuangxiang Yiyuan articles. Apart from the two allowlisted PDF documents and reviewed learning-resource copies, source documents, uncompressed logo sources, and personal working files remain local. VLA code is MIT and tutorial content is CC BY 4.0 with attribution; the AI networking index has no explicit license declaration. Linked third-party materials retain their own rights.

Certificate-based honor cards are available in `outputs/honors-cards.md`. Duplicate certificate versions are merged, and competition stages are kept distinct. The original certificate images remain local and unchanged.
