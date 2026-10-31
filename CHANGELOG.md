# Changelog

## 0.4.0 — Local project suite, AI, media, export and cloud accounts
- Added optional Supabase account setup, email/password registration and login, password recovery, manual backup/restore, project history, and owner-only database RLS migration.
- Registered the `ibramind://auth` Windows deep link so confirmation and password-reset links return to the desktop app.
- Added YouTube transcript import from VTT/SRT/TXT, Arabic-aware SVG and high-resolution PNG exports, tiled multi-page PDF, and selected-branch exports.
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
- Fixed packaged Electron asset URLs by using relative Vite paths, resolving the blank black window on Windows.
- Reworked the dashboard and canvas with a light Arabic RTL design system and a richer starter mind map.
- Removed the default Electron menu bar and added AA contrast tokens and regression notes.

## 0.2.0 — Mind map editor and Windows packaging foundation
- Added a React Flow mind map editor with editable topics, connections, zoom controls and minimap.
- Added keyboard shortcuts, local autosave, structural undo/redo, and JSON export.
- Added an Electron desktop shell and NSIS Windows installer configuration.
- Added GitHub Actions to build and publish a downloadable Windows installer artifact.

## 0.1.0 — Phase 1 foundation
- Set up React, TypeScript, and Vite.
- Added a responsive Arabic RTL dashboard with project cards and phase-aware actions.
- Added project identity and the development roadmap.
