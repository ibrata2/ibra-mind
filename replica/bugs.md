# IBRA MIND bug log — v0.3.0

## IM-001 — S1 — Windows app window is blank

- **Status:** Fixed in v0.3.0; replacement Windows build pending.
- **Reproduction:** Install v0.2.0 on Windows 10/11 and start IBRA MIND.
- **Expected:** Arabic dashboard appears in the Electron window.
- **Actual:** Native title/menu bar appears, but the client area is entirely blank and dark.
- **Evidence:** User-provided Windows screenshot in this task.
- **Cause:** Vite emitted absolute `/assets/...` URLs. Electron loads `dist/index.html` through `file://`, where those URLs resolve outside the installed app directory.
- **Fix:** Set Vite `base: './'`; verify the production HTML references `./assets/...`; use a light Electron window background to avoid a black loading surface.
- **Regression check:** Production build succeeds and contains relative JS/CSS paths. Verify the next packaged Windows installer opens the dashboard before calling this issue closed.

## IM-002 — S3 — Dark dashboard and editor reduce legibility

- **Status:** Fixed in v0.3.0 design pass; verify the Windows build.
- **Expected:** Readable Arabic interface, clear focus states, visible canvas grid.
- **Actual:** Nearly black surfaces, muted labels and dark canvas made the app appear unfinished.
- **Fix:** Light design tokens, higher contrast, light canvas/nodes and a richer starter map.

## To check

- Confirm the installer opens the dashboard on a clean Windows profile and on upgrade from v0.2.0.
- Confirm local storage migrates from the prior map key without losing saved map data.
- Test native Windows window resize and keyboard shortcuts.

