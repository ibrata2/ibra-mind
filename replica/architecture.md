# IBRA MIND architecture

## Runtime

- React 19, TypeScript, Vite, and React Flow power the shared Arabic/English web UI.
- Electron 45 runs the same UI in a sandboxed Windows shell. Provider credentials stay in the main process, encrypted using Electron `safeStorage`.
- Local project metadata is stored in browser local storage; project documents use IndexedDB with migration from earlier local-storage documents.
- Supabase JS is an optional client integration for accounts and manual cloud backup. The user's public/publishable key is client-side; the included SQL migration enables RLS ownership rules. No service-role key is used.
- GitHub Actions builds a Windows x64 NSIS installer artifact for main pushes. Version tags publish release assets.

## Module map

- `src/app`: dashboard, navigation, settings, local project creation and feature routing.
- `src/features/mindmap`: interactive graph editor, history, import/export and vector/raster export.
- `src/features/flowchart`, `whiteboard`: graph-based visual editors.
- `src/features/ai`, `desktop`: provider protocols, credential IPC, model calls and generation.
- `src/features/documents`, `video`, `templates`: extraction and user-provided media analysis, plus local templates.
- `src/features/cloud`: Supabase client, authentication, manual sync and restore history.
- `src/features/projects`, `storage`: local metadata and IndexedDB document storage.
- `supabase/migrations`: user-owned cloud data schema and row policies.

## Data and security

Project files are JSON documents scoped to local project IDs. AI provider secrets never enter the renderer in the Windows app. Supabase access tokens are handled by the official Supabase client; database policies use `auth.uid()` to restrict project rows to the owner. A user must create their Supabase project and run the included migration. Restoring a remote project creates a distinct local copy.

## Current boundaries

Cloud sync is manual; there is no background sync, merge strategy, live co-editing, invitations, OAuth or profile avatar flow. OCR for scanned files, automatic YouTube transcript retrieval, multi-page PDF, selected-node export, and full runtime verification on Windows still need implementation/verification. A Windows installer has not been built for the current local tree.
