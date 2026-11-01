# IBRA MIND

**AI Mind Mapping & Visual Thinking Studio**

Programmed & Developed by **Ibrahim Al-Khazraji** · Copyright © 2026 Ibrahim Al-Khazraji. All Rights Reserved.

IBRA MIND is an Arabic-first desktop and web visual thinking application. It currently provides persistent local projects, a mind map editor, flowchart editor, whiteboard, and a Windows-secured AI provider manager with mind-map generation. The full product specification also calls for document, media, cloud, collaboration, and account features; these are not represented as complete until their real processing and storage paths are implemented.

## Install and run from source

- Node.js 20.19+ or 22.12+
- npm 10+

```bash
npm install
npm run dev
```

Build the web app with `npm run build`, preview it with `npm run preview`, or run the Windows desktop development shell with `npm run desktop:dev`.

Build a Windows x64 NSIS installer with `npm run dist:win`. The installer is unsigned and Windows may show its publisher warning. GitHub Actions publishes installer assets under **Releases** when a release build is triggered; Actions artifacts are temporary build outputs, not the public download location.

The supplied IBRA MIND artwork is installed as the multi-size Windows application and installer icon, the Electron window icon, the web favicon, and the dashboard/About logo.

Run `npm run test:smoke` for provider and encrypted-session checks. Windows CI additionally launches the packaged app and checks that the Arabic dashboard rendered before saving the installer artifact.

## Current working capabilities

- Local dashboard with project creation, recent/favorite filters, search, grid/list views, and delete/rename.
- Mind map: editable and connectable nodes, child/sibling creation, copy/cut/paste/duplicate, undo/redo, keyboard shortcuts, drag placement, auto layout, outline mode, collapse/expand, node shapes/colors/task completion, IndexedDB autosave, JSON import/export, Markdown export, and print.
- Flowcharts: connected shapes, text editing, connect, auto layout, delete, JSON export, and IndexedDB autosave.
- Whiteboards: text, notes, shapes, image insertion, connectors, multi-select, resize, group/ungroup, lock, layer order, JSON export, and IndexedDB autosave.
- AI provider configuration in the Windows app: encrypted API key and custom-header storage through Windows safe storage; OpenAI-compatible protocol presets for OpenAI, DeepSeek, OpenRouter, Groq, Mistral and Ollama plus native Gemini/Anthropic protocols; model discovery where the provider exposes it, connection tests, usage/error counts, task routing, and validated AI mind map generation.
- Document-to-map extraction for PDFs, DOCX, PPTX, XLSX, TXT, Markdown and CSV; text is extracted locally, size-limited, chunked for AI analysis, and the final map is schema-validated. Up to 10 image-only PDF pages are rendered locally and OCR-read by the selected vision model; their images are sent to the user's provider and count toward its usage.
- Image-to-map requests for PNG, JPEG, WEBP and GIF through a configured vision-capable provider; images are size-limited and sent only after the user starts analysis.
- Audio file upload and microphone recording with OpenAI-compatible transcription, timestamps when returned by the provider, and transcript-to-map conversion. It needs an enabled transcription endpoint/model and a separate map-generation model if the speech model does not support chat completion.
- Twelve editable mind-map templates across education, business, marketing, programming, project planning, personal planning, medical education, engineering, science, history, brainstorming and organization; users can filter, search and favorite them locally.
- Mind map export to Arabic-aware SVG, high-resolution PNG, tiled multi-page PDF, selected-branch SVG/PNG/PDF, JSON and Markdown, plus browser printing. Large raster maps are capped to keep memory use bounded.
- YouTube transcript-to-map flow validates video links and accepts pasted captions or VTT/SRT/TXT subtitle files. It cannot fetch a transcript that YouTube has not made accessible to the user.
- English/Arabic interface foundations, Arabic RTL, application identity, and an Electron Windows installer workflow.
- Optional Supabase accounts: email/password sign-up and sign-in, password recovery, Google OAuth (after provider setup), editable display name/avatar URL, manual cloud backup and restore, and project restore points. Cloud access requires the owner's Supabase project and the supplied row-security migration. The app must only receive a public/publishable key; never use a service-role key in the app.

## Security notes

Provider credentials are kept by the Electron main process and encrypted through Electron `safeStorage`; they are not returned to the React renderer. The web build deliberately cannot save provider secrets without a backend. Requests to external APIs require the user's own provider key and send the selected prompt, document text, or image to that provider. No API credentials are included in 