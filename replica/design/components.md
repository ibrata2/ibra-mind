# IBRA MIND design system — v0.3

The Windows screenshot exposed a fully empty Electron window. The production asset paths were absolute, so `file://` could not load the app bundle. This release also changes the product shell from a nearly black palette to a light workspace with high-contrast surfaces.

## Core components

### Workspace navigation
- White sidebar at the right for RTL; active destination uses a pale violet surface and icon.
- Primary create action uses the brand violet and remains available above navigation.
- All navigation entries have a visible hover and keyboard focus state.

### Dashboard hero
- Welcoming introduction inside a light lavender surface, with one clear primary action.
- Responsive layout; decorative circles are non-interactive and hidden from assistive technology.

### Creation cards
- White cards with distinct pastel icon wells, border and hover elevation.
- Mind map creation opens the editor. Flowchart and AI actions identify their current planned state in the app.

### Project cards
- White surface, labeled project type and date, original preview illustration, hover elevation.
- Filter tabs show the selected state.

### Mind map canvas
- Light gray canvas with visible grid; violet root node and white branch nodes.
- Controls remain white with visible borders. Selection has a 3px violet focus ring.
- Labels stay inline editable and support Arabic text.

### Buttons and fields
- Semantic buttons, 40px minimum touch height for primary actions, explicit disabled states.
- Visible 3px keyboard focus outline; labeled node inputs.

## Layout and type

- Arabic RTL, Tahoma/Segoe UI system fallback; no network font dependency.
- Base spacing: 4px; major section gaps: 24–32px.
- Card radius: 14–18px; compact controls: 8–12px.
- Light workspace background, white surfaces, violet accent, green saved-state indicator.
