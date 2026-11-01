# IBRA MIND product map

## Main areas

1. Dashboard: workspace navigation, project search/filtering, recent and favorite projects, create/open/rename/delete.
2. Mind map editor: canvas, node hierarchy, direct text edit, connection creation, arrangement, outline mode, persistence, undo/redo, import/export/print.
3. Flowchart editor: process shapes and directed flow.
4. Whiteboard: free canvas objects, connectors, grouping, locking, ordering and image insertion.
5. AI settings: Windows-secured provider credentials, provider checks, task routing and usage counters.
6. AI map generation: prompt to validated structured hierarchy and a new local project.
7. Settings/About: product and developer information.

## Core user flows

- Start at dashboard -> create/open local project -> edit -> autosave -> return to dashboard -> reopen.
- Mind map -> select node -> add/duplicate/paste/remove branch -> undo/redo -> export/import JSON or export Markdown.
- Mind map -> select node -> change shape/color or task completion -> collapse/reopen branch -> reload persisted document.
- Create flowchart -> edit and connect shapes -> auto arrange -> autosave -> reopen.
- Create whiteboard -> add object/image -> resize/connect/group/order/lock -> autosave -> reopen.
- Windows AI settings -> save encrypted provider -> test provider -> generate structured map -> save as new local project.

## Data model

- Project metadata: localStorage key `ibra-mind-projects-v1` (IDs, names, kind, timestamps, favorites).
- Canvas documents: IndexedDB database `ibra-mind-local`, object store `documents`; each record contains serialized React Flow nodes and edges.
- AI provider settings: encrypted JSON under Electron `userData`, accessed only by main-process IPC. Task routing preferences are local UI settings.

## Explicit product boundary

Document/PDF processing, OCR, audio transcription, YouTube transcript processing, cloud accounts and sync, version history, live collaboration, template library, and usage cost calculation need real providers/services and are not currently available as completed flows.
