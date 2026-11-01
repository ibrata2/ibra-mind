# Changelog

## 0.4.0 — Local project suite, AI, media, export and cloud accounts
- Applied the supplied IBRA MIND icon to the Windows app and installer, Electron window, web favicon, dashboard, and About screen.
- Preserve VTT/SRT cue start times while extracting YouTube subtitles, so the AI receives timestamped content for key ideas and chapter branches.
- Added optional Supabase account setup, email/password registration and login, Google OAuth entry point, editable name/avatar profile, encrypted desktop auth sessions, password recovery, manual backup/restore, project history, and owner-only database RLS migration.
- Registered the `ibramind://auth` Windows deep link so confirmation and password-reset links return to the desktop app.
- Added YouTube transcript import from VTT/SRT/TXT, Arabic-aware SVG and high-resolution PNG exports, tiled multi-page PDF, selected-branch exports, and individual-node PNG/SVG/PDF exports.
- Added OpenAI-compatible presets for DeepSeek, OpenRouter, Groq and Mistral; provider model-list retrieval and encrypted custom HTTP headers.
- Added lazy-loaded editors and analysis tools; separated large reader and canvas bundles for faster startup.
- Changed Windows installer workflow so pushes build reviewable artifacts, while only version tags publish GitHub Releases.
- Preserved node type, color, and task state in map JSON exports.

- Added per-project IndexedDB autosave with migration of earlier local mind maps.
- Added project search, favorites, recent view, list/grid layouts, and project management.
- Added functional flowchart and whiteboard editors with local persistence.
- Expanded mind maps with branch operations, outline view, auto layout, import/export/print, node styles, task state, and branch collapse/expand.
- Added Windows-secured AI provider setup and validated AI mind map generation.
- Added local extraction for PDF, DOCX, PPTX, XLSX, TXT, Markdown and CSV, followed by chunked provider analysis.
- Added vision-provider image analysis for PNG, JPEG, WEBP and GIF with a 10 MB upload limit.
- Added a searchable, category-filtered template library with local favorites and 12 starter maps.
- Updated Electron to a security-patched release and restricted microphone permission requests to a one-shot, user-initiated request from the local application.
- Replaced the vulnerable SheetJS package with `read-excel-file` for XLSX extraction.
- Updated implementation records to clearly mark product areas that still need real integrations.

## 0.3.0 — Windows blank-screen fix and light visual system
- Fixed packaged Electron asset URLs by using relati