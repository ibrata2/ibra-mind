# IBRA MIND regression plan

Run `npm ci`, `npm run build`, `npm run test:smoke`, and `npm audit --omit=dev` before preparing a Windows installer. Build the installer on GitHub Actions Windows runner using `npm run dist:win`; verify its artifact, install, launch, update, microphone prompt, and URI callback on a clean Windows 10/11 device.

## Local workspace and maps

- Create, rename, favorite, search, filter, open and delete local projects; confirm all three project types save independently.
- Edit Arabic/English labels, create child/sibling branches, connect nodes, duplicate, cut, copy, paste, delete, undo, redo, collapse/expand, and arrange; reload to confirm IndexedDB restoration.
- Change node shape, color and task state; export/import JSON and confirm metadata persists.
- Toggle outline mode and return; confirm hierarchy and labels remain intact.
- Export full and selected map as SVG, PNG and PDF; confirm Arabic rendering, branch selection, multiple pages for tall/wide maps and page numbering.
- Check project export/print and browser resizing at desktop and narrow viewports.

## Other editors and local data

- Flowchart: add supported shapes, edit labels, connect/rearrange, save, reload, and JSON-export.
- Whiteboard: add text/sticky/shapes/images, resize, select/group/lock/reorder, save, reload, JSON-export.
- Close/reopen each workspace and verify its local document remains available.

## AI and media

- Run provider service smoke test: encrypted-key redaction, zero temperature, request/token counters and transcription segments.
- With user-supplied API credentials, test provider connection, generation, model routing, failures, timeout behavior, and response validation; check credentials never appear in renderer, logs or exports.
- Extract Arabic/English fixtures for text PDF, DOCX, PPTX, XLSX, TXT/Markdown/CSV; test size limits, malformed files, OCR for scanned PDF pages in sequential batches of up to 10 pages, including more than 10 image-only pages, retry without duplicate page requests, text/image mixed PDFs, page references, and chunked AI analysis.
- Test image-to-map with vision model; test audio upload and microphone permission, transcription and transcript-to-map; test pasted/VTT/SRT YouTube captions, confirm cue start times reach the AI prompt and appear in generated branches, and check invalid links.
- Test each template search/category/favorite/use flow.

## Accounts and cloud

- In a test-owned Supabase project, apply the included SQL migration; confirm RLS denies access to another account.
- Test registration, confirmation through `ibramind://auth`, sign-in/out, password reset callback, manual backup, history listing, restore to separate local copy, and empty/missing-table/error handling.
- Confirm local-only mode works with cloud settings empty. Test cloud key is public/publishable, and reject never store a service-role key.
- Verify multi-device manual backup/restore. Background sync, conflict resolution and collaboration are not implemented, so do not test or advertise them as available.

## Verification run in current workspace

- `npm run build` — passed; TypeScript and Vite production build succeeded.
- `npm run test:smoke` — passed; provider service smoke checks succeeded.
- `npm audit --omit=dev` — passed; no production dependency vulnerabilities.\n- YouTube caption smoke test — passed; VTT/SRT cue timestamps retained.
- Browser walkthrough — dashboard, local map load/autosave, Arabic node selection, cloud settings render, PDF export (map tiled across A4 pages), and selected-branch SVG export passed.
- GitHub Actions run 41292649527 built the Windows x64 installer and confirmed the packaged app rendered its dashboard before artifact upload. A clean Windows 10/11 installation, microphone permission, and ibramind:// callback still need manual device verification. Live Supabase auth/RLS also need an owner-configured project.
| Desktop auth session storage | Encrypted at rest, key-bound retrieval, selective removal, corrupt-file recovery | Smoke checks pass with mocked Electron safeStorage; verify real DPAPI persistence on Windows installer |

