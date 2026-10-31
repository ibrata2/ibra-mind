# IBRA MIND — Phase 1/2 architecture

## Product scope

IBRA MIND is an original visual thinking application based on the supplied master specification. Development is phased; the current vertical slice is a local mind map that can be edited, connected, saved, and exported.

## Stack

- React + TypeScript + Vite: shared web interface and production build.
- `@xyflow/react`: interactive canvas, nodes, connections, zoom, minimap.
- Electron: Windows desktop shell using the same built web UI.
- Browser local storage for the first autosave implementation. IndexedDB migration remains a later storage phase.
- GitHub Actions + electron-builder NSIS: reproducible Windows installer build.

## Current data model

Mind maps are versioned JSON documents. Each node stores an id, position, node type and label. Connections store source and target ids plus edge style. The active map autosaves to browser local storage and can be exported as JSON. No account or cloud services are required for the local vertical slice.

## Security boundaries

The Electron renderer has Node integration disabled, context isolation enabled and sandboxing enabled. No provider keys or cloud credentials are bundled. Provider APIs require a separately designed secure storage/proxy phase.

## Build order

1. Dashboard and shared design foundation — implemented.
2. Mind map editing, node links and canvas controls — current slice.
3. Rich node and edge tools, keyboard editing.
4. Layouts and outline conversion.
5. IndexedDB, autosave recovery and local project library.
6. Export and print formats.
7–15. Flowchart, whiteboard, AI, file analysis, cloud, collaboration, QA and release hardening as listed in README.

## Known limits

Current storage is per-browser profile and limited to one active map. JSON export is available; import, history across restarts, cloud sync, secure AI provider management and signing the Windows installer are not implemented yet.
