# Toxen3 Development Guide

## Project Overview

Toxen is a highly customizable music player (v2.4.3) built with **Electron 30 + React 18 + TypeScript**. It targets both **desktop (Electron)** and **web** platforms with platform-specific controllers abstracted through `ToxenController`.

- **Repository**: `LucasionGS/Toxen3` on GitHub
- **License**: MIT
- **Author**: Lucasion

**Key Architecture:**
- Desktop: Electron with Node.js integration (`DesktopController`) and `@electron/remote`
- Web: Browser-only version (`ToxenController` base class)
- Platform abstraction: `toxenapi` global is replaced at build time by `vite_toxen_plugin.ts`
- Dual-mode: Local (file system) and Remote (web server with user authentication)
- Single-instance enforcement: Only one Electron window allowed via `app.requestSingleInstanceLock()`

## Build & Development

### Commands
```bash
npm start           # Run Electron dev server (electron-forge start)
npm run buildweb    # Build web version to buildweb/ (vite build with vite.web.config.ts)
npm run startweb    # Run web dev server (vite with vite.web.config.ts)
npm run package     # Package Electron app (electron-forge package)
npm run make        # Create distributable installers (electron-forge make)
npm run publish     # Publish to GitHub releases (electron-forge publish)
npm run lint        # ESLint with TypeScript rules
```

### Build System
- **Electron**: Uses `@electron-forge/plugin-vite` with multiple Vite configs:
  - `vite.main.config.ts` - Main process (entry: `src/main.ts`)
  - `vite.preload.config.ts` - Preload scripts (entry: `src/preload.ts`)
  - `vite.renderer.config.ts` - Renderer (React app, window name: `main_window`)
- **Web**: Uses `vite.web.config.ts` with custom `toxenApi("web")` plugin
- **Shared**: `vite.base.config.ts` contains common config
- **React**: Uses `@vitejs/plugin-react-swc` (SWC-based compilation)
- **Styling**: SCSS/Sass with custom `ToxenIsWeb()` SCSS function for web builds
- **Packaging**: Electron Forge with makers for Windows (Squirrel), macOS (ZIP), Linux (DEB, RPM)
- **Auto-updates**: `update-electron-app` pointed at `LucasionGS/Toxen3` releases
- **Security**: Electron Fuses enabled (cookie encryption, asar integrity, RunAsNode disabled)

### Platform Detection
```typescript
toxenapi.isDesktop()  // Returns true on Electron, false on web
toxenapi.isLocal(Settings)  // !Settings.isRemote() && isDesktop()
Settings.isRemote()   // Always true on web; configurable on desktop
```

### Path Handling
Always use `toxenapi` for paths - never hardcode `/` or `\`:
```typescript
toxenapi.joinPath(...paths)          // Join and normalize
toxenapi.getBasename(path, ext?)     // Get filename
toxenapi.getFileExtension(path)      // Get extension including dot
```

## Source Structure

```
src/
  main.ts                          # Electron main process entry
  preload.ts                       # Electron preload script
  renderer.ts                      # Renderer process entry (imports app.tsx)
  app.tsx                          # App bootstrap (toxenapi import replaced at build time)

  app/
    ToxenApp.tsx                   # Main React component & global Toxen class (~1300 lines)
    ToxenApp.scss                  # Main app styles
    tx.scss                        # Global utility styles

    toxen/                         # Business logic & data models
      Song.tsx                     # Song entity & ISong interface (largest file)
      Settings.ts                  # Global settings & ISettings interface
      Playlist.tsx                 # Playlist management
      System.tsx                   # File system utilities & import handling
      Theme.ts                     # Theme management & application
      User.ts                      # User auth & remote access
      StoryboardParser.ts          # Timeline event system (~39KB)
      SubtitleParser.ts            # Multi-format subtitle parser
      AudioEffects.ts              # Web Audio API effect chain
      Statistics.ts                # Playback statistics tracking
      Telemetry.ts                 # Anonymous usage analytics
      ImageCache.ts                # Image caching system
      ToxenInteractionMode.ts      # UI mode enum
      JSONX.ts                     # JSON utility helpers
      ArrayX.ts                    # Array utility helpers
      MathX.ts                     # Math utility helpers
      Time.ts                      # Time formatting utilities
      Converter.ts                 # Data conversion utilities
      Remote.ts                    # Remote API communication
      Result.ts                    # Result type helpers
      Asyncifier.ts                # Async utility helpers
      Legacy.ts                    # Legacy migration code
      Debug.ts                     # Debug utilities

      desktop/                     # Desktop-only modules
        Discord.ts                 # Discord Rich Presence
        Ffmpeg.ts                  # FFmpeg media conversion
        Ytdlp.ts                   # yt-dlp video downloading
        TaskbarControls.ts         # OS taskbar integration
        ScreenRecorder.ts          # Screen recording
        CrossPlatform.ts           # Cross-platform desktop utilities

      extensions/                  # Extension system
      philipshue/                  # Philips Hue integration (partial)

    components/                    # React UI components (40+ directories)
      # Player Core
      MusicPlayer.tsx              # Hidden audio/video element wrapper
      MusicControls.tsx            # Bottom bar (play, pause, prev, next, volume)
      ProgressBar.tsx              # Seek bar with waveform display
      Background/                  # Fullscreen background with Visualizer canvas
      Subtitles/                   # Synchronized lyrics overlay

      # Side Panel & Settings
      Sidepanel/                   # Collapsible panel system
        Panels/
          SettingsPanel/           # Global settings UI
          EditSong/                # Per-song metadata editing
          ImportPanel/             # Drag-and-drop song import
          # MigrationPanel/        # (commented out)
      AppBar/                      # Title bar with window controls

      # Library Management
      SongPanel/                   # Song list, search, queue
      PlaylistPanel/               # Playlist CRUD
      PlaylistManager/             # Playlist organization
      PlaylistSelection/           # Playlist picker dialog

      # Editors
      StoryboardEditor/            # Canvas timeline overlay
      StoryboardEditorPanel/       # Storyboard event UI
      SubtitleEditor/              # Subtitle timeline editor
      SubtitleEditorPanel/         # Subtitle editing UI
      ThemeEditorPanel/            # Live theme color editor
      ThemeContainer/              # CSS variable injection

      # Audio & Effects
      EffectsPanel/                # Audio effects controls
      BPMFinder/                   # BPM detection tool

      # UI Primitives
      Button/                      # Custom styled buttons
      Form/                        # Form inputs (color picker, fields)
      Expandable/                  # Collapsible sections
      SelectAsync/                 # Async dropdown with search
      Tooltip.tsx                  # Custom tooltips
      ListInput/                   # Editable list component
      ExternalUrl/                 # Safe external link handler
      MessageCard/                 # Notification cards
      PulsingLogo/                 # Animated Toxen logo
      Reloadable.tsx               # On-demand refresh wrapper

      # Additional
      Miniplayer/                  # Always-on-top mini player
      LoadingScreen.tsx            # App loading splash
      LoginForm/                   # User authentication form
      AboutSection.tsx             # About/credits
      WhatsNewModal.tsx            # Changelog modal
      AdjustPanel/                 # Adjustment controls
      ExtensionPanel/              # Extension management
      BackgroundFileSelector/      # Background image picker
      ScreenPositionSelector/      # XY position picker

    windows/                       # Separate Electron windows
      SubtitleCreator/             # Dedicated subtitle creation window

    sounds/                        # Audio assets

  ToxenControllers/                # Platform abstraction layer
    ToxenController.tsx            # Base controller (web implementation)
    DesktopController.tsx          # Desktop extensions (fs, path, electron APIs)
    toxenapi.ts                    # Default export (replaced at build time)
    toxenapi_desktop.ts            # Desktop: exports new DesktopController()
    toxenapi_web.ts                # Web: exports new ToxenController()

  cli/                             # Command-line interface
  types/                           # TypeScript type definitions
```

### Build Output Directories
- `.vite/build/` - Main process output
- `.vite/renderer/main_window/` - Renderer output
- `buildweb/` - Web build output
- `out/` - Packaged Electron app
- `dist/` - Distribution files

## Core Architecture

### Platform Abstraction Layer
```typescript
// src/app.tsx contains this line (replaced at build time by vite_toxen_plugin.ts):
/*REPLACED_BY_VITE*/import "./ToxenControllers/toxenapi";
// Becomes either:
//   toxenapi_desktop.ts -> window.toxenapi = new DesktopController()
//   toxenapi_web.ts     -> window.toxenapi = new ToxenController()
```

**Always access platform APIs through `toxenapi`:**
```typescript
if (toxenapi.isDesktop()) {
  // Desktop-only code - fs access, Electron APIs
  const files = await toxenapi.fs.promises.readdir(path);
} else {
  // Web fallback
}
```

**Desktop-only guard pattern:**
```typescript
if (!toxenapi.isDesktop()) {
  return toxenapi.throwDesktopOnly("operationName");
  // Shows Mantine notification and throws error
}
```

### Electron Main Process (`src/main.ts`)
- Creates loading window (200x200, transparent, frameless) shown during startup
- Main window: 1280x768, frameless, `nodeIntegration: true`, `contextIsolation: false`
- Uses `@electron/remote` for renderer-to-main IPC
- Registers `file://` protocol with `tx://` and `txs://` URL rewriting
- Single instance lock with focus-on-second-launch behavior
- Squirrel startup handler for Windows install/uninstall

### Core Classes

**`Toxen` (src/app/ToxenApp.tsx)**
- Global static class extending `EventEmitter` for cross-component communication
- Singletons: `songList`, `currentSong`, `playlist`, `songQueue`, `musicPlayer`, `background`, `visualizer`, `audioEffects`, `discord`
- Panel references: `songPanel`, `songQueuePanel`, `playlistPanel`, `settingsPanel`
- UI helpers: `notify()`, `log()`, `error()`, `setTitle()`, `updateSongPanels()`
- Interaction modes: `Player`, `StoryboardEditor`, `SubtitlesEditor`, `ThemeEditor`

**`Song` (src/app/toxen/Song.tsx)**
- Central entity representing a music track (largest source file)
- Stores metadata, paths, visualizer settings, storyboard/subtitle references
- Per-song settings override global Settings via `visualizerColor`, `visualizerStyle`, etc.
- `playlistSettings` map allows playlist-specific overrides
- Uses `ISong` interface for serialization; `SongDiff` for sync comparison
- File tracking via `song.files` map: `{ [relativePath]: datetime }`

**`Settings` (src/app/toxen/Settings.ts)**
- Static class with `Settings.data: ISettings` for global app configuration
- Access: `Settings.get(key)`, `Settings.set(key, value)`
- Persistence: `Settings.load()` / `Settings.save()`
- `Settings.apply(partial, save?, useSpecialCases?)` - applies with optional side effects
- `Settings.isRemote()` / `Settings.isAdvanced()` - mode detection with overload signatures
- Default server: `https://stream.toxen.net/api`

**`Playlist` (src/app/toxen/Playlist.tsx)**
- Manages song collections with `songList: Song[]`
- Supports playlist-specific backgrounds
- Persisted to `playlists.json` in library directory

**`System` (src/app/toxen/System.tsx)**
- File system utilities: `System.recursive()`, `System.handleImportedFiles()`
- Handles drag-and-drop imports of songs, backgrounds, subtitles
- Desktop-only operations - throws on web

**`ToxenController` (src/ToxenControllers/ToxenController.tsx)**
- Base controller with web-compatible implementations
- Provides: `joinPath()`, `getBasename()`, `getFileExtension()`, `throwDesktopOnly()`
- `isDesktop()` returns `false`; `DesktopController` overrides to return `true`
- Exposes `packageJson` for version checking

### ISettings Interface
Key settings groups:
- **General**: `libraryDirectory`, `isRemote`, `volume`, `repeat`, `shuffle`
- **Panel**: `panelDirection` (left/right), `panelVerticalTransition`, `panelWidth`, `exposePanelIcons`
- **Window**: `restoreWindowSize`, `windowWidth`, `windowHeight`
- **Visuals**: `theme`, `visualizerColor`, `visualizerStyle`, `visualizerIntensity`, `visualizerNormalize`, `visualizerRainbowMode`, `visualizerPulseBackground`, `visualizerGlow`, `backgroundDynamicLighting`, `fftSize`, `autogeneratedTheme`
- **Backgrounds**: `defaultBackgrounds` (array), `shuffleDefaultBackgrounds`, `backgroundDim`
- **Discord**: `discordPresence`, `discordPresenceDetailed`
- **Hue**: `hueEnabled`, `hueBridgeIp`, `hueUsername`, `hueClientkey`, `hueEntertainmentAreaId`
- **Syncing**: `remoteSyncOnStartup`, `remoteSyncOnSongEdit`
- **Performance**: `hideOffScreenSongElements`, `enableThumbnailCache`
- **Effects**: `starRushEffect`, `starRushIntensity`, `audioEffectsEnabled`, `audioReverbLevel`, `audioEchoLevel`, `audioBassBoostLevel`, `audio3DLevel`
- **Crossfade**: `crossfadeEnabled`, `crossfadeDuration`
- **Meta**: `lastShownChangeNotesVersion`, `showAdvancedSettings`, `remoteServer`, `progressBarShowMs`

### VisualizerStyle Enum
```typescript
enum VisualizerStyle {
  None = "none",
  ProgressBar = "progressbar",
  Bottom = "bottom",
  Top = "top",
  TopAndBottom = "topbottom",
  Sides = "sides",
  Center = "center",
  Singularity = "circle",
  SingularityWithLogo = "circlelogo",
  MirroredSingularity = "mirroredsingularity",
  MirroredSingularityWithLogo = "mirroredsingularitywithlogo",
  PulseWave = "pulsewave",
  Waveform = "waveform",
  Orb = "orb",
  WaveformCircle = "waveformcircle",
}
```

### Key Patterns

**1. Settings Hierarchy**
Per-song settings (`Song.visualizerColor`) override global (`Settings.get("visualizerColor")`).
Playlist-specific settings (`Song.playlistSettings[playlistId]`) override per-song settings when playing from that playlist.

**2. Async File Handling**
Use `ToxenFile` interface with `path` and `name` properties. Convert `FileList` to arrays:
```typescript
if (files instanceof FileList) files = [...files];
```

**3. Component Update Pattern**
Panels have `update()` methods called globally via `Toxen.updateSongPanels()`. Components register themselves on mount: `Toxen.songPanel = this;`

**4. React Patterns**
- Class components used extensively (legacy pattern throughout codebase)
- Functional components for newer features
- `forceUpdate()` / `setState()` triggered from global `Toxen` static calls
- `Reloadable` wrapper component for on-demand refresh

**5. SCSS Functions**
Custom `ToxenIsWeb()` SCSS function returns true for web builds (configured in `vite.web.config.ts`).

## UI Component Libraries

**Primary: Mantine UI** (`@mantine/core` v7.10+)
- Button, Stack, Group, Progress, Menu, Modal, Notifications
- Modals: `modals.openModal()`, `modals.openConfirmModal()` from `@mantine/modals`
- Notifications: `showNotification()`, `updateNotification()`, `hideNotification()`
- Icons: `@tabler/icons-react` (e.g., `IconLayoutNavbarExpand`)

**Legacy: React Bootstrap** (`react-bootstrap` v2.10+)
- Older components still in use, gradually migrating to Mantine

**Other UI Dependencies:**
- `animejs` v3.2 - UI animations
- `showdown` + `html-react-parser` - Markdown rendering
- `react-select` v5.8 - Searchable select dropdowns
- `react-render-if-visible` - Virtualization for performance
- `@fortawesome/fontawesome-free` - Additional icons

## Feature Areas

### Visualizers (Audio-Reactive Canvas Rendering)

**Architecture:**
- `Visualizer` component (src/app/components/Background/Visualizer.tsx) - Main rendering engine
- Uses Web Audio API for real-time frequency analysis
- Renders on fullscreen canvas with `requestAnimationFrame` loop

**Audio Pipeline:**
```
AudioContext -> MediaElementSource -> AnalyserNode -> GainNode -> Destination
                                          |
                                    Audio Effects Chain
```

- **AnalyserNode**: FFT analysis with configurable `fftSize` (default 2048, range 256-8192)
- **Data Processing**: Upper half slice, optional normalization, optional seeded shuffle
- **Dynamic Lighting**: `dynamicDim` calculated from average bar heights

**Per-Frame Rendering Loop:**
1. Clear canvas
2. Execute storyboard callbacks (pre-dim)
3. Apply background dim (rgba overlay)
4. Execute storyboard callbacks (post-dim)
5. Update star rush particles
6. Get frequency data from analyser
7. Process data (normalize/shuffle if enabled)
8. Render visualizer bars/shapes based on style
9. Apply glow effects if enabled

**Star Rush Effect:**
- Particle system spawning from center at audio peaks
- Configurable via `starRushEffect` (boolean) and `starRushIntensity` (0-3)

### Storyboards (Timeline-Based Event System)

**Purpose:** Dynamic control of visualizers, effects, and settings synchronized to song timeline.

**Format:** YAML files with timeline events:
```yaml
bpm: 120
bpmOffset: 0
version: 1
author: "Name"
variables:
  myColor: [255, 0, 0]
storyboard:
  - start: 0          # Time in seconds or "1:23" timestamp
    end: 10
    component: visualizerColor
    data:
      color: $myColor  # Variable reference with $
    once: false        # true = execute once at start; false = per-frame
```

**Built-in Storyboard Components:**
- `visualizerColor` / `visualizerColorTransition` - Set/animate color
- `visualizerStyle` - Change visualizer style
- `visualizerIntensity` / `visualizerIntensityTransition` - Set/animate intensity
- `backgroundDim` / `backgroundDimTransition` - Set/animate dim (0-100)
- `starRushEffect` / `starRushIntensity` / `starRushIntensityTransition` - Particle effects
- `dynamicLighting` - Enable/disable audio-reactive brightness
- `pulse` - Beat-synced background pulse
- `background` - Switch background image mid-song
- `visualizerShuffle` / `visualizerNormalize` / `visualizerGlow` / `visualizerPulseBackground` - Toggle features

**Component Registration:**
```typescript
addStoryboardComponent("name", {
  name: "Display Name",
  arguments: [{ name, identifier, type, required, placeholder, description }],
  action(args, info, stateManager, ctx) {
    // Per-frame execution; return callback for post-dim rendering
  }
});
// Argument types: String, Number, Color, Boolean, Select, SelectImage, VisualizerStyle
```

### Subtitles (Synchronized Lyrics Display)

**Supported Formats:**
- **SRT** (SubRip): `1\n00:00:00,000 --> 00:00:05,000\nText`
- **VTT** (WebVTT): `WEBVTT\n\n00:00.000 --> 00:05.000\nText`
- **LRC** (Lyrics): `[00:00.00]Text`
- **TST** (Toxen SubTitles): Custom format with `[+option: value]` directives

**Rendering:** Binary search for active subtitle at current time, animated fade transitions, `subtitleDelay` per-song offset for sync correction.

**Floating Title:** Alternative overlay showing song title with reactive scaling, customizable position, outline color, and optional subtitle text source.

### Audio Effects (Real-Time Web Audio API Processing)

**Effect Chain:**
```
sourceNode --> bassBoostFilter  --> bassWetGain   --\
           --> delayNode        --> delayWetGain   --> effectsMix --> output
           --> convolverNode    --> reverbWetGain  --/
           --> pannerNode       --> pannerWetGain  --/
```

**Effects:**
1. **Bass Boost**: `BiquadFilterNode` lowshelf at 200Hz
2. **Echo/Delay**: `DelayNode` with feedback loop (max 2s)
3. **Reverb**: `ConvolverNode` with synthetic impulse response
4. **3D Audio**: `PannerNode` with HRTF panning and animated rotation

### Themes
```json
{
  "name": "Theme Name", "author": "Author", "version": 1,
  "style": { "primaryColor": "#RRGGBB", "secondaryColor": "#RRGGBB", ... },
  "background": "path/to/image.png"
}
```
- CSS variables injected at runtime via `ThemeContainer`
- Auto-generated themes from visualizer color (per-song setting)
- Import via drag-and-drop `.theme` files (JSON in zip)

## File Structure Conventions

### Song Directories
Each song stored in `{libraryDirectory}/{songUid}/`:
```
{songUid}/
  media.{mp3|mp4|...}        # Audio/video file
  background.{jpg|png|gif}   # Optional background
  storyboard.yaml             # Optional storyboard
  subtitles.{srt|vtt|...}    # Optional subtitles
  data.json                   # Song metadata (ISong)
```

### Global Files (in library root)
- `settings.json` - Global app settings (ISettings)
- `playlists.json` - All playlists (IPlaylist[])
- `statistics.json` - Playback stats
- `themes/` - Imported themes

## Remote Mode & Sync

**Mode Detection:**
```typescript
Settings.isRemote()  // true on web always; configurable on desktop
Settings.getUser()   // User object if logged in
Settings.getServer() // Remote server URL (default: https://stream.toxen.net/api)
```

**Sync System:**
```typescript
Song.sync(diff?, options?)       // Compare local vs remote, upload changes
song.setFile(path, action, dt?)  // Track file changes: "u" (updated) or "d" (deleted)
song.downloadRemoteToLocal(dir)  // Download remote song to local
toxenapi.exportLocalSongs(...songs)  // Export to .toxen package
```

## Desktop-Only Integrations

| Module | Purpose | Package |
|--------|---------|---------|
| `Discord.ts` | Rich Presence status | `discord-rpc-electron` |
| `Ffmpeg.ts` | Media format conversion | `fluent-ffmpeg` |
| `Ytdlp.ts` | YouTube/online media download | `yt-dlp-wrap` |
| `TaskbarControls.ts` | OS taskbar media buttons | Electron APIs |
| `ScreenRecorder.ts` | Screen/audio recording | Electron APIs |
| `CrossPlatform.ts` | OS-specific utilities | Node.js APIs |

**Pattern for desktop-only code:**
```typescript
if (toxenapi.isDesktop()) {
  Toxen.discord?.setPresence(song);
}
```

## TypeScript & Tooling Configuration

**TypeScript** (`tsconfig.json`):
- Target: ESNext, Module: CommonJS, JSX: React
- `noImplicitAny: true`, `esModuleInterop: true`
- Source maps enabled

**ESLint** (`.eslintrc.json`):
- Parser: `@typescript-eslint/parser`
- Extends: eslint recommended, TypeScript recommended, import (with Electron support)

**No test framework** - project relies on manual testing via `npm start`.

## CI/CD

**GitHub Actions** (`.github/workflows/build.yml`):
- Triggered on `release` branch push
- Builds on Windows (latest) and Ubuntu (latest)
- Node 22, yarn for dependency management
- Publishes via `electron-forge publish`
- AUR update job (currently commented out)

## Debugging & Logging

**User-facing notifications:**
```typescript
Toxen.log(message, duration?)     // Green success toast
Toxen.error(message, duration?)   // Red error toast
Toxen.notify(options)             // Custom notification (returns ID for updates)
```

**Common issues:**
1. **Audio context suspended** - Must be resumed after user interaction
2. **Song not loaded** - Always null-check: `const song = Song.getCurrent(); if (!song?.paths?.media) return;`
3. **Path issues** - Use `toxenapi.joinPath()`, never string concatenation
4. **Settings not saving** - Check remote mode and permissions
5. **FFT performance** - fftSize 256 (fast) to 8192 (slow, high detail); default 2048

## Common Pitfalls

1. **Don't assume desktop environment** - Always check `toxenapi.isDesktop()` before using fs/path/Electron APIs
2. **Path separators** - Use `toxenapi` path methods, never hardcode `/` or `\`
3. **Async loading** - Songs load asynchronously; check existence before accessing
4. **Settings precedence** - Remember: playlist-specific > per-song > global
5. **TSX naming** - `Song.tsx`, `Playlist.tsx`, `System.tsx`, `ToxenController.tsx` are TypeScript classes, not React components (legacy naming convention)
6. **Class components** - Most existing components are class-based; maintain consistency when modifying existing components
7. **Global state** - `Toxen` class uses static properties and methods; components register themselves to it on mount
8. **Node integration** - Main window has `nodeIntegration: true` and `contextIsolation: false` (uses `@electron/remote`)
9. **Vite plugin** - The `toxenapi` import in `app.tsx` is string-replaced at build time; don't change the exact comment marker `/*REPLACED_BY_VITE*/`

## Key Files Quick Reference

| Purpose | File |
|---------|------|
| Electron main process | `src/main.ts` |
| React app root | `src/app/ToxenApp.tsx` |
| Platform controller (web) | `src/ToxenControllers/ToxenController.tsx` |
| Platform controller (desktop) | `src/ToxenControllers/DesktopController.tsx` |
| Build-time platform injection | `vite_toxen_plugin.ts` |
| Song model | `src/app/toxen/Song.tsx` |
| Settings model | `src/app/toxen/Settings.ts` |
| Playlist model | `src/app/toxen/Playlist.tsx` |
| File system utilities | `src/app/toxen/System.tsx` |
| Visualizer rendering | `src/app/components/Background/Visualizer.tsx` |
| Audio effects | `src/app/toxen/AudioEffects.ts` |
| Storyboard parser | `src/app/toxen/StoryboardParser.ts` |
| Subtitle parser | `src/app/toxen/SubtitleParser.ts` |
| Theme system | `src/app/toxen/Theme.ts` |
| Electron Forge config | `forge.config.ts` |
| Web build config | `vite.web.config.ts` |
| Renderer build config | `vite.renderer.config.ts` |
