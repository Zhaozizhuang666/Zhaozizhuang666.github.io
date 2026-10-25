# Zizhuang Zhao · Personal Homepage

English-first personal website for Zizhuang Zhao (赵子状), built with plain HTML, CSS, and JavaScript for GitHub Pages.

The compact EN/中文 header switch translates site copy locally and remembers the choice across Home, Library, Guide, and reloads. Source titles, names, contacts, and Xiaoyi conversation messages stay intact; this does not depend on Chrome/Google Translate.

The header’s Auto / Light / Dark control applies across the homepage, Knowledge Library, and reloads. With no deliberate saved choice, Auto follows the visitor’s system appearance. Explicit Light or Dark choices are saved under the versioned `zizhuang-theme-choice-v1` key when local storage is available; choosing Auto removes that override. Legacy preferences are ignored. Xiaoyi’s colors follow the active appearance; its normal Auto outfit, happy Light outfit, and sleepy Dark outfit follow the selected mode rather than the system’s resolved color.

## Preview locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Current structure

- About: robotics evaluation, VLA, computer vision, and model deployment.
- Experience: current Robotics End-to-End Evaluation Engineer role at Spirit AI, with concise entries for 清华研究院 and 易点云.
- Learning: AI Agent study at Origin School and Origin Night School, with a VLA and embodied-intelligence focus.
- Research & IP: one paper and four patent records; titles, identifiers, and source links, without author lists or dates.
- Projects: VLA Guide, intelligent parcel robot, steel surface defect detection, and model deployment explorations.
- Community: Chuangxiang Yiyuan, Youyu social practice, volunteering, and event coordination.
- Media: selected public reports and project stories from 2024–2026, linked to their original pages or a stable official-account search entry.
- Knowledge Library: searchable competition and journal directories with source notes and links.
- Xiaoyi: the website knowledge entry, presented as a collapsible assistant with local retrieval and an optional server connection for online models.
- [Site Handbook](guide.html): visitor guidance for navigation, themes, Xiaoyi, the Library, model configuration, and release maintenance.
- Contact: GitHub, VLA Guide, email, and WeChat.

## Xiaoyi knowledge and online models

The default Knowledge mode uses the curated files in `data/` and local retrieval logic. It can explain indexed topics and cite available sources; it is not a trained or fine-tuned language model and does not browse the web in real time. Missing details, such as current competition deadlines, still need the relevant official announcement.

Online conversation requires a separately deployed server and provider credentials held in server-side secrets. GitHub Pages serves only the static frontend. The checked-in frontend has no online endpoint configured; this repository does not establish that any live provider is available. See [server/README.md](server/README.md) for deployment, allowed models, and API behavior. Never place API keys in frontend files.

## Verification before publishing

Run the automated contracts with Node.js 22 or later:

```bash
node --test tests/*.test.mjs
```

The latest local run passed **84 of 84 tests**. This covers retrieval and conversation contracts (including VLN source follow-ups, site-guide answers, and natural third-turn preparation questions), API validation and native protocol adapters, language switching, theme persistence, and refresh behavior. Follow the three independent release rounds in [QA.md](QA.md) when changing the site again.

## Public contact details

- GitHub: `https://github.com/Zhaozizhuang666`
- VLA Guide: `https://zhaozizhuang666.github.io/vla-guide/`
- Email: `zizhaung.zhao@spirit-ai.com`
- Phone: `13203434165`
- WeChat: `Z02-Sept13`

The original CV and working DOCX files stay local and are not included in the website files. The page uses the blue, black, white, and light-gray visual system requested by the owner; it does not use the earlier green palette.

## Content sources

Patent titles and publication types are linked to the owner-provided CNKI records. The paper links to its DOI. The community gallery uses photographs from the linked Chuangxiang Yiyuan articles. Original documents, uncompressed logo sources, and personal working files remain local.

Certificate-based honor cards are available in `outputs/honors-cards.md`. Duplicate certificate versions are merged, and competition stages are kept distinct. The original certificate images remain local and unchanged.
