# IBRA MIND

**AI Mind Mapping & Visual Thinking Studio**

Programmed & Developed by **Ibrahim Al-Khazraji** · Copyright © 2026 Ibrahim Al-Khazraji. All Rights Reserved.

IBRA MIND is being developed in phases. The current release includes an Arabic RTL dashboard and a working local mind map editor with editable topics, connections, zoom, minimap, keyboard shortcuts, autosave, undo/redo for structural edits, and JSON export. The Windows build loads assets from relative paths so the packaged `file://` app renders correctly. Flowcharts, AI, cloud services and other areas remain planned phases.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+

## Install and run

```bash
npm install
npm run dev
```

Create a production web build:

```bash
npm run build
npm run preview
```

Run the desktop app during development:

```bash
npm run desktop:dev
```

Build a Windows x64 installer (NSIS):

```bash
npm run dist:win
```

The installer is written to `release/`. GitHub Actions builds it on pushes to `main` and publishes it to the repository's GitHub Releases page. The installer is unsigned, so Windows may show its standard publisher verification prompt.

## Development roadmap

1. Project setup, design system, dashboard (implemented)
2. Mind map engine and canvas (initial slice implemented)
3. Rich node and edge tools
4. Automatic layout and outline mode
5. Local storage and autosave
6. Export and printing
7. Flowchart editor
8. Whiteboard
9. AI provider manager
10. AI mind map generation
11. Document, PDF, and image analysis
12. Audio and YouTube integration
13. Accounts and cloud sync
14. Collaboration
15. Quality assurance, optimization, Windows packaging (unsigned installer published)

## Security and configuration

No API credentials are bundled. AI providers will be added with secure key storage and backend mediation in the relevant phases. Never commit secrets; `.env.example` documents safe non-secret configuration only.

## Project identity

- Application: IBRA MIND – AI Mind Mapping & Visual Thinking Studio
- Developer: Ibrahim Al-Khazraji
- Telegram: https://t.me/ibraprogram
- TikTok: @ibraprogram
- Copyright © 2026 Ibrahim Al-Khazraji. All Rights Reserved.

