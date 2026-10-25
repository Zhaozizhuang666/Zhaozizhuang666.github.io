# Site handbook

This is the short operating guide for Zizhuang Zhao’s personal site. The public site is an English-first profile with Chinese context, a local Xiaoyi knowledge assistant, and a curated Library.

## 1. Usage

- **Home** presents the profile, current robotics end-to-end evaluation work, projects, learning, research and IP, community work, and selected public reports.
- **Library** provides searchable competition and journal directories.
- **Xiaoyi** gives a first explanation and points to sources. Open the source before relying on an important detail.

The site is a curated personal workspace. It is not a complete directory, live deadline tracker, or replacement for an official announcement.

## 2. Language, theme and layout

The compact header control offers EN/中文 alongside Auto, Light, and Dark. The site starts in English; choosing 中文 translates the site copy locally and is remembered across Home, Library, Guide, and reloads. Original source titles, proper names, and Xiaoyi conversation messages remain unchanged. This switch does not call or repair Chrome/Google Translate.

The theme button cycles through Auto, Light, and Dark. Auto follows the operating system. Explicit Light or Dark is stored locally and persists between Home, Library, and reloads; Auto clears the explicit override. Xiaoyi follows the selected appearance, and reduced motion keeps content visible without entrance animation.

On desktop, the page scales into the space beside the Xiaoyi drawer. The drawer can be on either edge. A new visit defaults to the right; dragging changes the side and height for the current visit. On mobile, the drawer is a modal with focus management.

## 3. Xiaoyi — website knowledge entry

The default local mode reads the checked-in files in `data/` through `xiaoyi-engine.js`. It can explain indexed competitions, journals, and technical topics and attach available sources. It does not browse the web in real time, train itself, or guarantee current deadlines, rules, model capabilities, or results.

Good prompts are focused and explicit:

1. Ask one subject: “What is VLN?”
2. Ask for the source or a comparison: “好的，把链接给我” or “How do SR and SPL differ?”
3. Change topic explicitly: “Now leave VLN and explain VLA.”
4. Select **New chat** when the previous context should not carry over.

Example path: **VLN → open the cited paper → ask about SR and SPL → compare the definitions with the evaluation protocol**. The link is evidence to inspect, not a substitute for the protocol.

## 4. Library

The current static directories contain:

- **86 competitions**, with the supplied school directory’s A, B1, and B2 labels.
- **6,430 journals**, organized as first- and second-batch directory lists.

Search by title, organizer, or keyword, use the filter, and open the source or search entry on a result card. Competition labels are from the supplied Shanxi Institute of Technology directory and are not universal national rankings. Journal batches are directory classifications and do not judge article quality. The technical collection is curated and can grow; avoid hardcoding a total in user-facing copy.

## 5. Optional online models

The checked-in frontend has no live model endpoint. Local knowledge mode works without a server. DeepSeek, Qwen, Kimi, GLM, custom OpenAI-compatible providers, and registered Anthropic/Gemini native adapters become selectable only after a separate Cloudflare Worker is deployed and server-side secrets are configured.

GitHub Pages serves only the static frontend. Keep provider keys in Wrangler secrets; never put them in `xiaoyi-config.js`, HTML, or Git. The Worker owns the provider URL, key, system prompt, model allowlist, origin checks, request limits, and error handling. A model listed by `/api/models` indicates configuration, not guaranteed account access, uptime, balance, or answer quality. See [`server/README.md`](../server/README.md) for the protocol and deployment details.

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

The free Pages hostname follows the GitHub account/repository, currently `https://zhaozizhuang666.github.io/`. `zizhuang.zhao` is a display name; changing the public hostname requires a separately owned custom domain and DNS configuration. Do not claim a public deployment until the branch, Pages status, HTTPS response, and fresh-browser content have all been checked.
