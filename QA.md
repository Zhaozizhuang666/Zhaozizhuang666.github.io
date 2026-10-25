# Release evaluation

Each release needs three independent passes for every module: behavior contracts, browser interaction and appearance, then publishing verification. A repeated command is not a substitute for the other passes. Record the commit or working-tree version, browser and viewport, observed result, and any unresolved issue. After fixing an issue, rerun the affected pass and any behavior that shares the changed code.

## Current evidence — 2026-10-26

- Automated run: `node --test tests/*.test.mjs` — **84 passed, 0 failed, 0 skipped** (2026-10-26). Provider calls use test doubles; no live model availability is demonstrated.
- Browser interaction and visual checks: **passed** locally on the static server at `http://127.0.0.1:8001/` using a real browser. Checked 1440 × 900, 390 × 844, and the library and handbook at 1440 × 900. No horizontal overflow, broken images, or console errors were observed.
- Browser evidence included: homepage → library navigation, competition search and empty results, A-level filtering, journal first/second-batch filtering with forward/back pagination, explicit theme persistence across pages and reload, Auto resolving to the dark system, refresh returning to scroll position 0, mobile Xiaoyi modal layout, desktop drawer scaling, left/right drawer docking, and default-right reset after reload.
- Xiaoyi conversation regression passed in the browser: `计算机设计大赛是什么？` → `怎么报名？` → `需要准备什么？` retained the same record and official link. `什么是VLN` → `好的那把链接给我` retained the original paper and browser verification showed the VLN definition and arXiv source. The test harness must close the drawer before looking for `Xiaoyi preview`; the dock is deliberately hidden while the drawer is open. The hidden dock and preview are inert during the conversation so they do not remain keyboard or accessibility targets. A missing visible dock selector in the open state is expected, not a site runtime error.
- Header/language checks: compact language and theme controls measured 37 × 26px and 42 × 26px at desktop. Actual browser widths 1440px, 1024px and 390px had no document overflow. EN → 中文 → EN, homepage → library → handbook, reload, explicit Light persistence and dynamic competition search labels passed. Chrome viewport scaling was accounted for using the measured `innerWidth`; the IAB viewport override did not apply in this session.
- English source follow-ups and topic-switch boundaries passed in both engines. Browser: `什么是VLN` → `Please give me the link` → `怎么评测它？` returned the VLN original paper then SR/SPL evidence; no browser error logs were recorded.
- Handbook: `guide.html` rendered as a standalone public page with all six anchors (`#usage`, `#theme`, `#xiaoyi-guide`, `#library`, `#models`, `#maintenance`) and links from Home and Library. It explains the local-only model state and the three-round release workflow; it does not claim a live endpoint.
- Mobile article preview: `outputs/wechat-article.html` rendered at 390px with no horizontal overflow; it is a draft artifact and remains ignored by Git.
- Publishing audit, GitHub push, Pages deployment, and public HTTPS checks: **pending until the release commit is pushed**. GitHub’s repository API currently reports Pages disabled (`has_pages: false`), so the Pages setting must be enabled after the push before the public URL can be verified.

## Round 1 — behavior and content contracts

Use source inspection and automated tests before opening the release in a browser.

- Homepage sections: check names, role descriptions, contact details, source links, and the requested omissions. Confirm research records have the intended titles and identifiers, and that media stays separated into Social Impact and Innovation & Research.
- Theme: verify the saved explicit Light/Dark choice is resolved before CSS on both pages, persists across navigation and refresh, and uses only the versioned `zizhuang-theme-choice-v1` key. Without a valid choice, use Auto; choosing Auto clears the saved override. Ignore legacy `theme-preference` values. System changes affect Auto only. Check the shared controller is included once per page.
- Xiaoyi: run the local three-turn conversation tests, source retrieval, topic changes, follow-ups, and reset behavior. Confirm the assistant distinguishes the founder from the wider alliance and does not mistake OPC for a school. Keep unsupported facts and missing deadlines explicit.
- Knowledge Library: inspect competition and journal schemas, source descriptions, filters, pagination boundaries, and search-link labels. Confirm that institutional classifications are not presented as universal rankings or current eligibility rules.
- Optional API: verify input limits, explicit origins, provider/model allowlists, error handling, and absence of secrets in responses. An unconfigured service must remain visibly unavailable while local knowledge works.
- Assets and motion: check local asset references, separate text/image entrance rules, reduced-motion handling, and decorative elements’ accessibility attributes.

Run `node --test tests/*.test.mjs` and record the complete result. Treat any failed test or contradicted content as a release blocker.

## Round 2 — browser interaction, layout, and themes

Test both `index.html` and `knowledge.html` in a real browser. Use desktop (for example, 1440 × 900), a narrower layout (1024 × 768), and mobile (390 × 844). Record actual viewport sizes rather than assuming them.

- Homepage: visit every navigation destination, inspect all sections and images, and follow representative external links. Check line wrapping, paragraph alignment, contact baselines, image crop, logo readability, horizontal overflow, and focus indicators.
- Theme: without a saved deliberate choice, start with a light system, then a dark system; confirm Auto immediately matches it on both pages. Cycle Auto → Light → Dark → Auto. For each explicit choice, navigate main → knowledge and refresh; the choice must persist. Change the system while an override is active; it must stay explicit. Return to Auto, navigate and refresh; Auto must follow the current system. Inspect backgrounds, text, cards, controls, favicon, and browser theme color.
- Xiaoyi entry: verify hover and keyboard focus reveal the mascot; click opens the drawer; close and Escape restore focus to the visible dock toggle or original page link. Drag to both edges and release at different heights; confirm the position stays usable during the visit and resets to the right after reload. Check edge docking near the top and bottom of each viewport.
- Xiaoyi drawer: verify page content remains visible in the available space, long messages wrap, the composer remains reachable, and scrolling works without trapping the page. Check the faint bottom logo before and during a conversation. Send at least one three-turn conversation and reset it; verify Enter, Shift+Enter, empty input, and loading/error behavior.
- Xiaoyi colors: inspect the entry, mascot, bubble, drawer, messages, suggestions, selector, and composer in both light and dark appearances. Colors must follow the active page theme, including while the drawer is already open; text and controls must remain readable. Check the normal outfit in Auto even when the system is dark, happy outfit in explicit Light, and sleepy outfit in explicit Dark.
- Knowledge Library: search, clear the query, change both tabs and filters, navigate forward/backward, and inspect empty results. Use the keyboard to traverse tabs and controls; verify result counts and visible source links agree with the selection.
- Motion: reload at least twice to inspect text and image entrances separately. Confirm movement stays subtle and content settles without overlap; use reduced-motion mode and verify content remains visible and usable.
- Online-model state: with the checked-in configuration, confirm local mode works and online providers are unavailable. If a server is configured later, separately exercise a real allowed model, switch models, and test a failed request without claiming those checks in advance.

Record screenshots or specific observations for each module and theme. A screenshot alone does not prove an interaction works.

## Round 3 — publishing and public-site audit

Use the exact release candidate, then verify what visitors receive after deployment.

- Review the staged diff and file list. Include only intended site assets, code, data, documentation, and server examples; keep original CV/DOCX/PDF files, source photos, certificate directories, outputs, local environment files, and credentials out of the commit. Do not alter the read-only certificate source directory.
- Check relative URLs and filename case on both pages, including theme scripts, Xiaoyi scripts/styles, data JSON, images, and favicon. Confirm the frontend contains only a public server URL if one was intentionally configured.
- Run the automated suite on the release candidate and record its commit. Push that commit to the intended GitHub repository; confirm the Pages deployment reports success before checking the public URL.
- Open the public HTTPS address in a fresh session. Verify the response and certificate, the deployed version of changed files, both pages, local data loading, logo/favicon, theme cycle and refresh behavior, and Xiaoyi open/close with a three-turn local conversation. Check for failed resources and console errors.
- Confirm the public API state matches the release notes. A successful static Pages deployment does not deploy the optional Worker or prove a provider key, account balance, or model permission works.

Release only when all three rounds have recorded evidence and no unresolved blocking issue. Report the actual public URL and any remaining optional setup accurately.
