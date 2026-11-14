# Toxen Extension API

Extensions let you add custom visualizers and themes to Toxen without modifying the core application. Extensions are loaded from the user's data directory and are desktop-only (Electron).

---

## Table of Contents

1. [Extension location](#extension-location)
2. [File structure](#file-structure)
3. [Manifest (`extension.json`)](#manifest-extensionjson)
4. [Entry point (`index.js`)](#entry-point-indexjs)
5. [Registering a visualizer](#registering-a-visualizer)
6. [Visualizer render context reference](#visualizer-render-context-reference)
7. [Visualizer options (per-style settings)](#visualizer-options-per-style-settings)
8. [Bundling themes](#bundling-themes)
9. [Theme style keys reference](#theme-style-keys-reference)
10. [Full example](#full-example)

---

## Extension location

Extensions are stored in the Toxen data directory under the `extensions/` folder:

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\.toxenData3\extensions\` |
| macOS    | `~/Library/Preferences/.toxenData3/extensions/` |
| Linux    | `~/.config/.toxenData3/extensions/` |

Each extension lives in its own subdirectory:

```
extensions/
  my-extension/
    extension.json
    index.js
```

Extensions are discovered automatically on startup. New extensions are **enabled by default**. You can toggle extensions in Toxen via **Settings → Extensions**.

---

## File structure

A minimal extension only needs two files:

```
my-extension/
  extension.json   ← manifest (required)
  index.js         ← entry point (required when using code / visualizers)
```

You may add additional `.js` files, assets, or sub-directories as needed and `require()` them from `index.js`.

---

## Manifest (`extension.json`)

The manifest describes the extension and declares any visualizers or themes it provides.

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A short description of what this extension does.",
  "main": "index.js",
  "visualizers": [
    {
      "id": "myVisualizer",
      "name": "My Visualizer",
      "options": []
    }
  ],
  "themes": []
}
```

### Manifest fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier for the extension. Use lowercase letters, numbers, and hyphens only. |
| `name` | `string` | ✅ | Human-readable display name. |
| `version` | `string` | ✅ | Semantic version string (e.g. `"1.0.0"`). |
| `author` | `string` | ✅ | Author name. |
| `authorId` | `number` | ❌ | Optional numeric author ID. |
| `description` | `string` | ✅ | Short description shown in the Extensions panel. |
| `main` | `string` | ❌ | Entry point file. Defaults to `"index.js"`. Omit for theme-only extensions. |
| `visualizers` | `array` | ❌ | Declares visualizers exposed by this extension (see [Registering a visualizer](#registering-a-visualizer)). |
| `themes` | `array` | ❌ | Inline theme definitions (see [Bundling themes](#bundling-themes)). |

### Visualizer manifest entry

Each object in the `visualizers` array declares one visualizer:

```json
{
  "id": "myVisualizer",
  "name": "My Visualizer",
  "options": [
    {
      "key": "speed",
      "name": "Speed",
      "type": "range",
      "defaultValue": 1,
      "min": 0.1,
      "max": 5,
      "step": 0.1
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Local identifier matching the one passed to `api.registerVisualizer()`. |
| `name` | `string` | Display name shown in the visualizer picker. |
| `options` | `array` | Per-style user-configurable settings (see [Visualizer options](#visualizer-options-per-style-settings)). |

---

## Entry point (`index.js`)

Your entry point must export an `activate` function. Optionally, it can export a `deactivate` function for cleanup.

```js
// index.js

exports.activate = function (api) {
  // Called when the extension is loaded.
  // Use `api` to register visualizers, etc.
};

exports.deactivate = function () {
  // Called when the extension is disabled or Toxen is closing.
  // Release any resources you allocated.
};
```

The `api` object has the following shape:

```ts
interface ToxenExtensionAPI {
  /** Current API version (currently 1). */
  apiVersion: number;

  /**
   * Register a custom visualizer.
   * @param localId Short identifier unique within this extension.
   *   The full style ID becomes `ext:<extensionId>:<localId>`.
   * @param renderFn Called every animation frame to draw the visualizer.
   */
  registerVisualizer(localId: string, renderFn: (rc: VisualizerRenderContext) => void): void;
}
```

---

## Registering a visualizer

Call `api.registerVisualizer(localId, renderFn)` inside `activate`. The `localId` must match the `id` you declared in the manifest's `visualizers` array.

```js
exports.activate = function (api) {
  api.registerVisualizer("myVisualizer", function (rc) {
    const { ctx, dataArray, len, vWidth, vHeight, storedColor } = rc;

    ctx.fillStyle = storedColor;

    const barWidth = vWidth / len;
    for (let i = 0; i < len; i++) {
      const barHeight = (dataArray[i] / rc.dataSize) * rc.getMaxHeight(0.5);
      ctx.fillRect(i * barWidth, vHeight - barHeight, barWidth - 1, barHeight);
    }
  });
};
```

The registered visualizer will appear in the visualizer dropdown as **"My Visualizer"** (using the `name` from the manifest). Internally its full style ID is `ext:my-extension:myVisualizer`.

---

## Visualizer render context reference

The `rc` object passed to your render function every frame:

### Canvas & dimensions

| Property | Type | Description |
|----------|------|-------------|
| `ctx` | `CanvasRenderingContext2D` | The 2D rendering context. Draw here. |
| `vWidth` | `number` | Canvas width in pixels. |
| `vHeight` | `number` | Canvas height in pixels. |
| `vLeft` | `number` | Canvas left offset (usually `0`). |
| `vTop` | `number` | Canvas top offset (usually `0`). |

### Audio data

| Property | Type | Description |
|----------|------|-------------|
| `dataArray` | `Uint8Array` | Frequency bin data. Each value is `0–255`. |
| `len` | `number` | Number of frequency bins available. |
| `dataSize` | `number` | Maximum bin value (typically `256`). |
| `dynLight` | `number` | Overall audio intensity (`0–1+`). Useful for pulse or glow effects. |

### Playback

| Property | Type | Description |
|----------|------|-------------|
| `time` | `number` | Current playback position in **milliseconds**. |

### Visual settings

| Property | Type | Description |
|----------|------|-------------|
| `storedColor` | `string` | Current visualizer color as a CSS color string (e.g. `"#b6ffba"`). |
| `opacity` | `number` | Current opacity (`0–1`). |
| `intensityMultiplier` | `number` | User-configured intensity multiplier (default `1`). |
| `isRainbow` | `boolean` | `true` when rainbow mode is active. |
| `isGlow` | `boolean` | `true` when glow mode is active. |
| `pulseEnabled` | `boolean` | `true` when background pulse is enabled. |

### Helper methods

```ts
// Returns a fraction of the canvas height.
// Pass a value 0–1 to limit the max (e.g. 0.5 = 50% of canvas height).
rc.getMaxHeight(mult?: number): number;

// Returns a fraction of the canvas width.
rc.getMaxWidth(mult?: number): number;

// Set ctx.shadowBlur for glow rendering.
rc.setBarShadowBlur(val: number): void;

// If rainbow mode is on, sets ctx.fillStyle/strokeStyle to a rainbow color
// based on the frequency bin index `i`.
rc.setRainbowIfEnabled(x: number, y: number, w: number, h: number, i: number): void;

// Read a per-style option value (configured by the user in settings).
// Returns null when the user has not overridden the default.
rc.getOption(key: string): any;
```

---

## Visualizer options (per-style settings)

You can expose user-configurable settings for your visualizer. Declare them in `extension.json` under the `options` array of a visualizer entry. Values are retrieved at render time with `rc.getOption(key)`.

### Option types

| `type` | Description | Extra fields |
|--------|-------------|--------------|
| `"range"` | A numeric slider. | `min`, `max`, `step` |
| `"boolean"` | A checkbox. | — |
| `"select"` | A dropdown with predefined choices. | `options: [{ label, value }]` |
| `"songImage"` | An image path chosen from the current song's files. | — |

### Example

```json
"options": [
  {
    "key": "speed",
    "name": "Animation Speed",
    "type": "range",
    "defaultValue": 1,
    "min": 0.1,
    "max": 5,
    "step": 0.1
  },
  {
    "key": "mirror",
    "name": "Mirror Effect",
    "type": "boolean",
    "defaultValue": false
  },
  {
    "key": "shape",
    "name": "Bar Shape",
    "type": "select",
    "defaultValue": "rect",
    "options": [
      { "label": "Rectangle", "value": "rect" },
      { "label": "Circle", "value": "circle" }
    ]
  }
]
```

Reading option values in the render function:

```js
exports.activate = function (api) {
  api.registerVisualizer("myVisualizer", function (rc) {
    const speed  = rc.getOption("speed")  ?? 1;
    const mirror = rc.getOption("mirror") ?? false;
    const shape  = rc.getOption("shape")  ?? "rect";
    // ...
  });
};
```

---

## Bundling themes

Themes can be declared directly in `extension.json` under the `themes` array. Theme-only extensions do not need a `main` entry or an `index.js` file.

```json
{
  "id": "my-dark-theme",
  "name": "My Dark Theme Extension",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A collection of dark color themes.",
  "themes": [
    {
      "name": "midnight",
      "displayName": "Midnight",
      "description": "Deep dark blue theme.",
      "styles": {
        "primaryBg":   { "value": [10,  10,  30]  },
        "secondaryBg": { "value": [15,  15,  45]  },
        "accentColor": { "value": [100, 180, 255] }
      },
      "customCSS": ""
    }
  ]
}
```

Each theme in the array has the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Short identifier. Full theme ID becomes `ext:<extensionId>:<name>`. |
| `displayName` | `string` | ❌ | Human-readable name shown in the theme picker. Defaults to `name`. |
| `description` | `string` | ❌ | Short description. |
| `styles` | `object` | ✅ | Map of style keys to `{ "value": ... }` objects (see reference below). |
| `customCSS` | `string` | ❌ | Raw CSS injected after the theme's generated CSS variables. |

Color values are `[R, G, B]` arrays with values `0–255`.

---

## Theme style keys reference

The following keys are available in the `styles` object. All values are RGB color arrays unless noted otherwise.

### Core Colors

| Key | CSS Variable | Description | Default |
|-----|-------------|-------------|---------|
| `primaryBg` | `--primary-bg` | Main background color | `[32, 33, 36]` |
| `secondaryBg` | `--secondary-bg` | Panel/section backgrounds | `[42, 42, 42]` |
| `tertiaryBg` | `--tertiary-bg` | Subtle element backgrounds | `[53, 53, 53]` |
| `accentColor` | `--accent-color` | Primary accent color | `[182, 255, 186]` |
| `accentColorRgb` | `--accent-color-rgb` | Accent color for transparency | `[182, 255, 186]` |

### Text Colors

| Key | CSS Variable | Description | Default |
|-----|-------------|-------------|---------|
| `textPrimary` | `--text-primary` | Primary text | `[255, 255, 255]` |
| `textSecondary` | `--text-secondary` | Secondary/less important text | `[225, 225, 225]` |
| `textMuted` | `--text-muted` | Disabled/subtle text | `[167, 167, 167]` |

### Surface Colors

| Key | CSS Variable | Description | Default |
|-----|-------------|-------------|---------|
| `surfaceBg` | `--surface-bg` | Card and input backgrounds | `[255, 255, 255]` |
| `surfaceBgHover` | `--surface-bg-hover` | Surface on hover | `[255, 255, 255]` |
| `surfaceBgActive` | `--surface-bg-active` | Active surface | `[255, 255, 255]` |

### Border Colors

| Key | CSS Variable | Description | Default |
|-----|-------------|-------------|---------|
| `borderPrimary` | `--border-primary` | Primary border | `[182, 255, 186]` |
| `borderSecondary` | `--border-secondary` | Secondary border | `[255, 255, 255]` |
| `borderFocus` | `--border-focus` | Focused element border | `[182, 255, 186]` |

### Status Colors

| Key | CSS Variable | Description | Default |
|-----|-------------|-------------|---------|
| `successColor` | `--success-color` | Success state | `[74, 222, 128]` |
| `warningColor` | `--warning-color` | Warning state | `[251, 191, 36]` |
| `errorColor` | `--error-color` | Error state | `[239, 68, 68]` |
| `infoColor` | `--info-color` | Info state | `[59, 130, 246]` |

### Music Player

| Key | CSS Variable | Description | Default |
|-----|-------------|-------------|---------|
| `playerProgress` | `--player-progress` | Progress bar color | `[0, 255, 0]` |
| `playerSelected` | `--player-selected` | Selected song highlight | `[255, 107, 53]` |
| `playerPlaying` | `--player-playing` | Currently-playing song highlight | — |

---

## Full example

Below is a complete extension that registers a simple circular (singularity-style) visualizer with two user-configurable options.

### Directory layout

```
extensions/
  ring-visualizer/
    extension.json
    index.js
```

### `extension.json`

```json
{
  "id": "ring-visualizer",
  "name": "Ring Visualizer",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A circular frequency ring visualizer.",
  "main": "index.js",
  "visualizers": [
    {
      "id": "ring",
      "name": "Ring",
      "options": [
        {
          "key": "radius",
          "name": "Radius",
          "type": "range",
          "defaultValue": 150,
          "min": 50,
          "max": 400,
          "step": 1
        },
        {
          "key": "filled",
          "name": "Filled Bars",
          "type": "boolean",
          "defaultValue": false
        }
      ]
    }
  ]
}
```

### `index.js`

```js
exports.activate = function (api) {
  api.registerVisualizer("ring", function (rc) {
    const {
      ctx, dataArray, len, vWidth, vHeight,
      storedColor, dynLight, intensityMultiplier,
      isGlow, isRainbow,
    } = rc;

    const baseRadius = rc.getOption("radius") ?? 150;
    const filled     = rc.getOption("filled")  ?? false;

    const cx = vWidth  / 2;
    const cy = vHeight / 2;
    const angleStep = (Math.PI * 2) / len;

    if (isGlow) rc.setBarShadowBlur(10);

    ctx.strokeStyle = storedColor;
    ctx.fillStyle   = storedColor;
    ctx.lineWidth   = 2;

    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const amplitude = (dataArray[i] / rc.dataSize) * rc.getMaxHeight(0.3) * intensityMultiplier;
      const angle     = i * angleStep - Math.PI / 2;
      const r         = baseRadius + amplitude;
      const x         = cx + Math.cos(angle) * r;
      const y         = cy + Math.sin(angle) * r;

      if (isRainbow) rc.setRainbowIfEnabled(x, y, 2, amplitude, i);

      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    }
    ctx.closePath();

    if (filled) ctx.fill();
    else        ctx.stroke();

    // Reset shadow
    if (isGlow) rc.setBarShadowBlur(0);
  });
};

exports.deactivate = function () {
  // Nothing to clean up for this extension.
};
```

After dropping the `ring-visualizer` folder into the extensions directory and restarting Toxen, the **Ring** visualizer will appear in the visualizer picker under **Settings → Visualizer Style**.
