# IBRA MIND test plan — v0.3.0

## F01 — Start Windows desktop app

- **F01-H1:** Install the signed-off release on Windows 10/11, launch it, and verify the dashboard renders in the app window.
- **F01-E1:** Upgrade from v0.2.0 and verify the previous local mind map is still available.
- **F01-E2:** Launch without network; dashboard and local editor must render because no remote font is required.
- **F01-E3:** Resize to the minimum supported desktop size; navigation, canvas and controls must remain visible.

## F02 — Create and edit a mind map

- **F02-H1:** Open the mind map, edit a label in Arabic, add a child topic with Tab, connect and move nodes, then verify autosave after reload.
- **F02-H2:** Delete a selected branch and verify its descendants and links disappear; undo and redo the structural change.
- **F02-E1:** Use a 60-character Arabic/English mixed label and verify wrapping and node editing.
- **F02-E2:** Export JSON and verify the exported file includes the current nodes and edges without runtime callbacks.
- **F02-E3:** Use the canvas with keyboard only and verify visible focus indicators.

## Executed in this pass

- Reproduced IM-001 from the user-provided screenshot.
- Ran TypeScript and Vite production build after the path fix.
- Verified the generated HTML uses relative asset paths (`./assets/...`).
- Checked design token contrast: 11 color pairs, 0 AA failures.
- Local browser click-through still required after the light theme is rebuilt; Windows installer verification remains required to close IM-001.

