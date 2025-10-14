# Toxen3 Development Guide

## Project Overview
Toxen is a highly customizable music player built with **Electron + React + TypeScript**. It targets both **desktop (Electron)** and **web** platforms with platform-specific controllers abstracted through `ToxenController`.

**Key Architecture:**
- Desktop: Electron with Node.js integration (`DesktopController`)
- Web: Browser-only version (`ToxenController` base class)
- Platform abstraction: `toxenapi` global is replaced at build time by `vite_toxen_plugin.ts`
- Dual-mode: Local (file system) and Remote (web server) with user authentication

## Build & Development

### Commands
```bash
npm start           # Run Electron dev server
npm run buildweb    # Build web version to buildweb/
npm run startweb    # Run web dev server
npm run package     # Package Electron app
npm run make        # Create distributable installers
npm run publish     # Publish to GitHub releases
```

### Build System
- **Electron**: Uses `@electron-forge/plugin-vite` with multiple Vite configs:
  - `vite.main.config.ts` - Main process
  - `vite.preload.config.ts` - Preload scripts  
  - `vite.renderer.config.ts` - Renderer (React app)
- **Web**: Uses `vite.web.config.ts` with custom `toxenApi("web")` plugin
- **Platform detection**: `toxenapi.isDesktop()` returns boolean, use for conditional logic
- **Path handling**: Always use `toxenapi.path.resolve()` / `toxenapi.joinPath()` for cross-platform compatibility

## Core Architecture

### Platform Abstraction Layer
```typescript
// src/ToxenControllers/toxenapi.ts exports window.toxenapi
// Replaced at build time by vite_toxen_plugin.ts to either:
//   - toxenapi_desktop.ts → new DesktopController()
//   - toxenapi_web.ts → new ToxenController()
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

### Core Classes

**`Song` (src/app/toxen/Song.tsx)**
- Central entity representing a music track
- Stores metadata, paths, visualizer settings, storyboard/subtitle references
- Per-song settings override global Settings via `visualizerColor`, `visualizerStyle`, etc.
- `playlistSettings` map allows playlist-specific overrides (e.g., different backgrounds per playlist)
- Uses `ISong` interface for serialization

**`Settings` (src/app/toxen/Settings.ts)**
- Global app configuration (theme, default visualizer, library path, etc.)
- Load/save via `Settings.load()` / `Settings.save()`
- Uses `ISettings` interface

**`Playlist` (src/app/toxen/Playlist.tsx)**
- Manages song collections with `songList: Song[]`
- Supports playlist-specific backgrounds via `background` and `songBackground` map
- Persisted to `playlists.json` in library directory

**`System` (src/app/toxen/System.tsx)**
- File system utilities: `System.recursive()`, `System.handleImportedFiles()`
- Handles drag-and-drop imports of songs, backgrounds, subtitles
- Desktop-only operations - throws on web

**`Toxen` class (src/app/ToxenApp.tsx)**
- Global event emitter and state manager
- Access via `Toxen.songList`, `Toxen.currentSong`, `Toxen.notify()`, etc.
- Handles loading screen, notifications, title bar updates

### Key Patterns

**1. Desktop-Only Operations**
```typescript
if (!toxenapi.isDesktop()) {
  return toxenapi.throwDesktopOnly("operationName");
}
// Desktop code here
```

**2. Song Settings Hierarchy**
Per-song settings (`Song.visualizerColor`) override global (`Settings.get("visualizerColor")`).  
Playlist-specific settings (`Song.playlistSettings[playlistId]`) override per-song settings when playing from that playlist.

**3. Async File Handling**
Use `ToxenFile` interface with `path` and `name` properties. Convert `FileList` to arrays:
```typescript
if (files instanceof FileList) files = [...files];
```

**4. SCSS Functions**
Custom SCSS function `ToxenIsWeb()` returns true for web builds (see `vite.web.config.ts`).

## Feature Areas

### Visualizers (Audio-Reactive Canvas Rendering)

**Architecture:**
- `Visualizer` component (src/app/components/Background/Visualizer.tsx) - Main rendering engine
- Uses Web Audio API for real-time frequency analysis
- Renders on fullscreen canvas with requestAnimationFrame loop

**Audio Pipeline:**
```typescript
// Shared audio graph initialized once per song:
AudioContext → MediaElementSource → AnalyserNode → GainNode → Destination
                                   ↓
                            Audio Effects Chain
```

**Key Components:**
- **AnalyserNode**: FFT analysis with configurable `fftSize` (default 2048)
  - `getFrequencyData()` returns Uint8Array of 0-255 values
  - Higher values = louder frequencies at that bin
- **Data Processing**:
  - Sliced to upper half (removes low frequency redundancy)
  - Optional normalization: scales to max value in current frame
  - Optional shuffle: seeded pseudo-random reorder for aesthetic
- **Dynamic Lighting**: `dynamicDim` calculated from average bar heights
  - Brightens background during loud sections, dims during quiet

**Visualizer Styles** (VisualizerStyle enum):
- `ProgressBar`: Bars above music controls, tracks song position
- `Orb`: Circular pattern expanding from center (not in current file structure)
- `Waveform`: Linear frequency bars
- `Singularity`: Centered radial effect (not in current file structure)
- `WaveformCircle`: Circular waveform pattern
- `None`: No visualizer, only dynamic lighting

**Per-Frame Rendering Loop:**
```typescript
loop() {
  1. Clear canvas
  2. Execute storyboard callbacks (pre-dim)
  3. Apply background dim (rgba overlay)
  4. Execute storyboard callbacks (post-dim)
  5. Update star rush particles
  6. Get frequency data from analyser
  7. Process data (normalize/shuffle if enabled)
  8. Render visualizer bars/shapes based on style
  9. Apply glow effects if enabled
}
```

**Star Rush Effect:**
- Particle system overlaid on visualizer
- Spawns particles from center at audio peaks
- Particles accelerate outward with velocity/opacity decay
- Configurable via `starRushEffect` (boolean) and `starRushIntensity` (0-3)
- Per-song or storyboard controlled

### Storyboards (Timeline-Based Event System)

**Purpose:** Dynamic control of visualizers, effects, and settings synchronized to song timeline

**Format:** YAML with this structure:
```yaml
bpm: 120           # Beats per minute (for beat-sync features)
bpmOffset: 0       # Offset in seconds
version: 1         # Parser version
author: "Name"     # Optional
variables:         # Optional reusable values
  myColor: [255, 0, 0]
storyboard:
  - start: 0       # Time in seconds (or timestamp "1:23")
    end: 10
    component: visualizerColor
    data:
      color: $myColor  # Variable reference
    once: false    # If true, executes once at start instead of per-frame
```

**Component System:**
Components defined in `StoryboardParser` via `addStoryboardComponent()`:
- Each component has typed arguments (String, Number, Color, Boolean, Select, SelectImage, VisualizerStyle)
- `action()` function executes per-frame during event duration
- Can return callback to execute AFTER background dim applied

**Built-in Components:**
- `visualizerColor`: Set static color `[r,g,b]` or `"#RRGGBB"`
- `visualizerColorTransition`: Animate between colors over duration
- `visualizerStyle`: Change style (ProgressBar, Waveform, etc.)
- `visualizerIntensity`: Scale bar heights (0-2+ range)
- `visualizerIntensityTransition`: Animate intensity change
- `backgroundDim`: Set opacity 0-100
- `backgroundDimTransition`: Animate dim change
- `starRushEffect`: Enable/disable particle effect
- `starRushIntensity`: Set particle spawn rate (0-3)
- `starRushIntensityTransition`: Animate intensity
- `dynamicLighting`: Enable/disable audio-reactive brightness
- `pulse`: Beat-synced background pulse effect
- `background`: Switch background image mid-song
- `visualizerShuffle`: Enable/disable bar randomization
- `visualizerNormalize`: Enable/disable normalization
- `visualizerGlow`: Enable/disable glow effect
- `visualizerPulseBackground`: Force pulse on/off (overrides global)

**Event Execution:**
```typescript
// Parser maintains:
- loadedStoryboard: Full timeline
- currentEvents[]: Active events at current time
- eventIndex: Next event to check

// Per frame:
1. Advance eventIndex to capture new events in range
2. Execute all currentEvents (via StateManager for transitions)
3. Remove expired events from currentEvents
4. Storyboard can draw to canvas before AND after background dim
```

**StateManager:**
- Manages transitions (color, intensity, dim fades)
- Stores per-event state via `event.setState()` / `event.getState()`
- Calculates interpolation: `(currentTime - start) / duration`

**Editor:**
- `StoryboardEditorPanel`: UI for creating/editing events
- `StoryboardEditor`: Canvas overlay showing event timeline
- `StoryboardEditorController`: Manages editor state
- Drag-and-drop YAML import, live preview while editing

### Subtitles (Synchronized Lyrics Display)

**Supported Formats:**
- **SRT** (SubRip): `1\n00:00:00,000 --> 00:00:05,000\nText`
- **VTT** (WebVTT): `WEBVTT\n\n00:00.000 --> 00:05.000\nText`
- **LRC** (Lyrics): `[00:00.00]Text` (simple line-based)
- **TST** (Toxen SubTitles): Custom format with extended options

**TST Format Specifics:**
```
[00:00.000]Text line
[00:05.500]More text
[+align: center]
[+size: 1.5]
[+color: #FF0000]
```
Options apply to all subsequent lines until changed

**Parsing Pipeline:**
```typescript
SubtitleParser.parseByExtension(text, extension)
  → Parses to SubtitleArray (array of SubtitleItem)
  → SubtitleItem: { start: Time, end: Time, text: string, options: SubtitleOptions }
  → Time: { hours, minutes, seconds, milliseconds }
```

**Rendering:**
- `Subtitles` component displays current subtitle
- Tracks `Toxen.musicPlayer.media.currentTime`
- Binary search finds active subtitle
- `subtitleDelay` per-song offset for sync correction
- Animated fade-in/out on transitions

**Floating Title:**
- Alternative to subtitles: displays song title as overlay
- `floatingTitle`: Enable
- `floatingTitleText`: Custom text (defaults to song title)
- `floatingTitlePosition`: `{ x: number, y: number }` screen position
- `floatingTitleReactive`: Scales with audio intensity
- `floatingTitleOverrideVisualizer`: Hides visualizer bars
- `floatingTitleOutlineColor`: Text stroke color
- `useFloatingTitleSubtitles`: Use subtitle text as floating title

**Editor:**
- `SubtitleEditor`: Timeline-based editor with waveform
- `SubtitleEditorPanel`: UI panel integration
- Live preview while editing
- Export to all supported formats

### Themes (Visual Customization)

**Structure:**
```json
{
  "name": "Theme Name",
  "author": "Author",
  "version": 1,
  "style": {
    "primaryColor": "#RRGGBB",
    "secondaryColor": "#RRGGBB",
    "backgroundColor": "#RRGGBB",
    "textColor": "#RRGGBB",
    // ... more color definitions
  },
  "background": "path/to/image.png"  // Optional
}
```

**Application:**
- CSS variables injected at runtime via `ThemeContainer`
- `Theme.apply()` updates DOM custom properties
- Persisted in `themes/` directory
- Drag-and-drop `.theme` files to import

**Auto-Generated Themes:**
- `autogeneratedTheme` (per-song setting)
- Generates theme colors from visualizer color
- Applies when song plays, restores original on stop
- `Toxen.applyAutogeneratedThemeIfEnabled()` called on color change

**Theme Editor:**
- `ThemeEditorPanel`: Live color picker interface
- Real-time preview
- Export as `.theme` file (JSON in zip)

### Audio Effects (Real-Time Processing)

**Architecture:**
- `AudioEffects` class manages Web Audio API effect nodes
- Connects to shared audio graph initialized by `Visualizer`
- Effect chain: Source → Effects → Analyser → Destination

**Effect Nodes:**
```typescript
// Wet/dry mixing for each effect:
sourceNode ─┬─→ bassBoostFilter ──→ bassWetGain ───┐
            ├─→ delayNode ────────→ delayWetGain ──┤
            ├─→ convolverNode ────→ reverbWetGain ─┼──→ effectsMix → output
            ├─→ pannerNode ───────→ pannerWetGain ─┤
            └──────────────────────────────────────┘
```

**Effects:**
1. **Bass Boost**:
   - `BiquadFilterNode` type `lowshelf`, frequency 200Hz
   - Boosts frequencies below 200Hz
   - Wet gain controls intensity (0-1)

2. **Echo/Delay**:
   - `DelayNode` with max 2 second delay
   - `echoFeedback` GainNode for repeats
   - Adjustable delay time and feedback amount

3. **Reverb**:
   - `ConvolverNode` with impulse response buffer
   - `createReverbImpulse()` generates synthetic reverb
   - Wet gain controls room size feel

4. **3D Audio**:
   - `PannerNode` with HRTF panning model
   - Positions audio in 3D space
   - Animated rotation via `animationFrame`

**Settings:**
- Global settings in `Settings` class
- Per-song overrides possible
- UI in `EffectsPanel`
- All effects can be enabled/disabled independently

## UI Components & Architecture

### Layout Hierarchy
```
ToxenAppRenderer (root React component)
├── AppBar (top)
│   ├── Window controls (minimize, maximize, close)
│   ├── User info (if logged in)
│   └── Title display
├── Background (fullscreen behind all)
│   ├── BackgroundImage (with blur/dim)
│   ├── Visualizer (canvas overlay)
│   └── Subtitles (positioned text)
├── Sidepanel (collapsible left panel)
│   ├── SidepanelSection (Music, Playlists, Settings, etc.)
│   ├── SongPanel (music library list)
│   ├── PlaylistPanel (playlist management)
│   ├── SettingsPanel (global settings)
│   ├── EffectsPanel (audio effects)
│   ├── StoryboardEditorPanel
│   ├── SubtitleEditorPanel
│   ├── ThemeEditorPanel
│   └── ImportPanel (drag-and-drop import)
├── MusicControls (bottom bar)
│   ├── Play/Pause button
│   ├── Previous/Next buttons
│   ├── ProgressBar (with click-to-seek)
│   ├── Volume control
│   └── Shuffle/Repeat toggles
├── MusicPlayer (hidden audio/video element)
└── Notifications (Mantine toast system)
```

### Component Libraries

**Primary: Mantine UI** (`@mantine/core` v7.x)
- Modern, TypeScript-first component library
- Used for: Button, Stack, Group, Progress, Menu, Modal, Notifications
- Modals: `modals.openModal()`, `modals.openConfirmModal()` from `@mantine/modals`
- Notifications: `showNotification()`, `updateNotification()`, `hideNotification()`
- Icons: `@tabler/icons-react` (e.g., `IconLayoutNavbarExpand`)

**Legacy: React Bootstrap** (`react-bootstrap` v2.x)
- Older components still in use
- Gradually being migrated to Mantine

**Custom Components:**
- **Button/**: Custom styled buttons
- **Form/**: Form inputs with validation
  - `FormInputColorPicker`: Color picker with hex/RGB support
  - `FormInputFields`: Various input types
- **Expandable/**: Collapsible sections
- **SelectAsync/**: Async dropdown with search
- **Tooltip/**: Custom tooltip implementation
- **ProgressBar/**: Audio progress bar with waveform
- **PulsingLogo/**: Animated Toxen logo

### State Management Patterns

**Global Toxen Class:**
```typescript
// src/app/ToxenApp.tsx
export class Toxen extends EventEmitter {
  static songList: Song[] = [];
  static currentSong: Song | null = null;
  static playlist: Playlist | null = null;
  static songQueue: Song[] = [];
  static musicPlayer: MusicPlayer;
  static background: Background;
  static visualizer: Visualizer;
  // ... more singletons
  
  // Event emitter for cross-component communication
  static on(event: string, callback: Function);
  static emit(event: string, ...args: any[]);
  
  // Notification helpers
  static notify(options: MessageCardOptions): string;
  static log(message: string, duration?: number): void;
  static error(message: string, duration?: number): void;
}
```

**Component Update Pattern:**
```typescript
// Panels have update() methods called globally
Toxen.updateSongPanels() {
  Toxen.songPanel?.update();
  Toxen.songQueuePanel?.update();
  Toxen.playlistPanel?.update();
}

// Components register themselves to global Toxen
componentDidMount() {
  Toxen.songPanel = this;
}
```

**React Component Patterns:**
- Class components used extensively (legacy)
- Functional components for newer features
- Use `forceUpdate()` or `setState()` from global calls
- `Reloadable` wrapper for on-demand refresh

## File Structure Conventions

### Song Directories
Each song stored in `{libraryDirectory}/{songUid}/`:
```
{songUid}/
  └── media.{mp3|mp4|...}     # Audio/video file
  └── background.{jpg|png|gif} # Optional background
  └── storyboard.yaml          # Optional storyboard
  └── subtitles.{srt|vtt|...}  # Optional subtitles
  └── data.json                # Song metadata (ISong)
```

### Global Settings
- `settings.json` - Global app settings (ISettings)
- `playlists.json` - All playlists (IPlaylist[])
- `statistics.json` - Playback stats
- `themes/` - Imported themes

## Remote Sync & Telemetry

### Remote Mode Architecture
**Dual-mode operation:**
- **Local Mode**: Songs stored in `libraryDirectory` on filesystem
- **Remote Mode**: Songs stored on web server, accessed via HTTP API

**Mode Detection:**
```typescript
Settings.isRemote() // Returns boolean
Settings.getUser()  // Returns User object if logged in
```

**Remote Endpoints:**
- `user.getCollectionPath()` → `https://[server]/[userId]/collection`
- Song operations via REST API (GET, PUT, DELETE)
- File operations include hash-based versioning

**Sync System:**
```typescript
Song.sync(diff?: SongDiff, options?: { silenceValidated?: boolean })
// Compares local vs remote, uploads changed files
// Uses file hashes to detect changes
// Per-file tracking via song.files map: { [path]: datetime }
```

**File Action Tracking:**
```typescript
song.setFile(relativePath, action, datetime?)
// action: "u" (updated) or "d" (deleted)
// Stores in song.files for sync comparison
```

**Download/Upload Patterns:**
```typescript
// Download remote song to local
song.downloadRemoteToLocal(localDir: string)

// Export local songs to .toxen package
toxenapi.exportLocalSongs(...songs: Song[])

// Sync selected songs to remote
Toxen.syncSongs(songs: Song[])
```

### Telemetry System
**Purpose:** Anonymous usage analytics

**Architecture:**
- `Telemetry` namespace (src/app/toxen/Telemetry.ts)
- Batch sending (default 10 events per batch)
- Sent to `https://telemetry.toxen.net`

**Event Types:**
```typescript
enum TelemetryEventType {
  USER_LOGIN, USER_LOGOUT, USER_REGISTER,
  APP_START, APP_STOP, APP_ERROR,
  FEATURE_X_USED, FEATURE_Y_USED,
  STARTUP_LOAD_TIME
}
```

**Usage:**
```typescript
Telemetry.log(TelemetryEventType.APP_START, { version: "2.4.1" });
Telemetry.flush(); // Force send remaining events
```

## Testing & Debugging

### Development Workflow
- **No formal test suite** - manual testing via `npm start`
- **Hot reload**: Main process restarts on changes, renderer hot-reloads
- **DevTools**: Electron DevTools available in dev mode (F12)
- **Logging patterns**:
  - `Toxen.log()` - User-facing success messages (green toast)
  - `Toxen.error()` - User-facing error messages (red toast)
  - `Toxen.notify()` - Custom notifications (returns ID for updates)
  - `console.log()` - Debug output (dev console only)

### Debugging Techniques

**Audio Context Issues:**
```typescript
// Audio context must be resumed after user interaction
if (audioContext.state === 'suspended') {
  await audioContext.resume();
}
```

**Song Loading:**
```typescript
// Songs load asynchronously - always check existence
const song = Song.getCurrent();
if (!song || !song.paths?.media) return;
```

**Path Resolution:**
```typescript
// ALWAYS use toxenapi for paths
const path = toxenapi.path.resolve(dir, file); // ✓ Correct
const path = dir + "/" + file;                 // ✗ Wrong (breaks on Windows)
```

**Visualizer Performance:**
```typescript
// FFT size affects performance exponentially
fftSize: 256   // Fast, low detail
fftSize: 2048  // Default, balanced
fftSize: 8192  // Slow, high detail
```

### Common Debug Scenarios

1. **"Cannot read property of undefined"** - Check song loaded: `if (!song?.paths) return;`
2. **Audio not playing** - Check audio context state, media element src
3. **Visualizer not updating** - Verify analyser connected, check if stopped
4. **Settings not saving** - Check if in remote mode, verify permissions
5. **Storyboard events not firing** - Validate YAML syntax, check eventIndex progression

## Common Pitfalls

1. **Don't assume desktop environment** - Always check `toxenapi.isDesktop()` before using fs/path
2. **Path separators** - Use `toxenapi.path` methods, never hardcode `/` or `\`
3. **Async loading** - Songs load asynchronously; check existence before accessing
4. **Settings precedence** - Remember: playlist-specific > per-song > global
5. **TypeScript .tsx files** - Both `Song.tsx`, `Playlist.tsx`, `System.tsx` are actually TypeScript classes, not React components (legacy naming)

## External Dependencies

- **Electron**: Auto-updates via `update-electron-app`
- **Discord RPC**: `discord-rpc-electron` for rich presence (desktop only)
- **FFmpeg**: `fluent-ffmpeg` for media conversion (desktop only)
- **yt-dlp**: `yt-dlp-wrap` for downloading online media (desktop only)
- **Anime.js**: `animejs` for UI animations

## Advanced Development Topics

### Creating Custom Storyboard Components

**Registration Pattern:**
```typescript
// In StoryboardParser.ts
addStoryboardComponent("myComponent", {
  name: "My Component",
  arguments: [
    {
      name: "Intensity",
      identifier: "intensity",
      type: "Number",
      required: true,
      placeholder: "0-1",
      description: "Effect intensity"
    },
    {
      name: "Color",
      identifier: "color",
      type: "Color",
      required: false
    }
  ],
  action(args, info, stateManager, ctx) {
    const intensity = args.intensity;
    const color = args.color;
    
    // Executed per-frame during event duration
    // info: { currentSongTime, songDuration, isPaused }
    
    // Option 1: Do work immediately (before background dim)
    ctx.fillStyle = rgbToHex({ r: color[0], g: color[1], b: color[2] });
    
    // Option 2: Return callback for post-dim rendering
    return () => {
      // This runs AFTER background dim is applied
      ctx.globalAlpha = intensity;
      ctx.fillRect(0, 0, 100, 100);
    };
  }
});
```

**State Management in Transitions:**
```typescript
action(args, info, stateManager, ctx) {
  const { fromColor, toColor, duration } = args;
  
  // Get or initialize state
  let state = stateManager.getState();
  if (!state) {
    state = { startTime: info.currentSongTime };
    stateManager.setState(state);
  }
  
  // Calculate interpolation
  const elapsed = info.currentSongTime - state.startTime;
  const progress = Math.min(elapsed / duration, 1);
  
  // Lerp between colors
  const r = fromColor[0] + (toColor[0] - fromColor[0]) * progress;
  const g = fromColor[1] + (toColor[1] - fromColor[1]) * progress;
  const b = fromColor[2] + (toColor[2] - fromColor[2]) * progress;
  
  Toxen.background.storyboard.setVisualizerColor(rgbToHex({ r, g, b }));
}
```

**Argument Types:**
- `String` - Text input
- `Number` - Numeric input
- `Color` - RGB/RGBA array or hex string
- `Boolean` - Checkbox
- `Select` - Dropdown (provide `selectData: [["value", "Label"]]`)
- `SelectImage` - File picker for images
- `VisualizerStyle` - Enum of visualizer styles

### Extending the Audio Pipeline

**Adding Custom Audio Effects:**
```typescript
// In AudioEffects.ts
export class AudioEffects {
  private myCustomNode: BiquadFilterNode | null = null;
  
  setupEffectChain() {
    this.myCustomNode = this.audioContext.createBiquadFilter();
    this.myCustomNode.type = 'peaking';
    this.myCustomNode.frequency.value = 1000;
    
    // Connect to effect chain
    this.sourceNode.connect(this.myCustomNode);
    this.myCustomNode.connect(this.effectsMix);
  }
  
  setMyEffect(enabled: boolean, intensity: number) {
    if (!this.myCustomNode) return;
    this.myCustomNode.gain.value = enabled ? intensity * 10 : 0;
  }
}
```

**Accessing from Settings/UI:**
```typescript
// In EffectsPanel.tsx
<FormInputFields
  type="checkbox"
  label="My Custom Effect"
  checked={Settings.get("myCustomEffect")}
  onChange={(e) => {
    Settings.set("myCustomEffect", e.target.checked);
    Toxen.audioEffects.setMyEffect(e.target.checked, intensity);
  }}
/>
```

### Song Import Pipeline

**Custom Media Conversion:**
```typescript
// System.handleImportedFiles() flow:
1. Detect file type via extension
2. Create song directory with UID
3. Copy media file
4. Call Song.buildInfo(directory) to extract metadata
5. Generate thumbnail (for videos)
6. Save info.json with ISong data
7. Add to Toxen.songList

// To support new format:
- Add extension to Toxen.getSupportedMediaFiles()
- For convertible formats, add to Toxen.getSupportedConvertableAudioFiles()
- Implement conversion in toxenapi.ffmpeg.convertToMp3()
```

### Platform-Specific Feature Development

**Desktop-Only Features (Example: Discord RPC):**
```typescript
// src/app/toxen/desktop/Discord.ts
export default class Discord {
  static setPresence(song: Song) {
    if (!toxenapi.isDesktop()) return;
    
    const rpc = require('discord-rpc-electron');
    rpc.updatePresence({
      details: song.title,
      state: `by ${song.artist}`,
      largeImageKey: 'toxen_logo',
      largeImageText: 'Toxen Music Player'
    });
  }
}

// Usage in Song.play():
if (toxenapi.isDesktop()) {
  Toxen.discord?.setPresence(this);
}
```

**Web-Only Features (Example: Web Share API):**
```typescript
if (!toxenapi.isDesktop() && navigator.share) {
  await navigator.share({
    title: song.title,
    text: `Listening to ${song.getDisplayName()}`,
    url: window.location.href
  });
}
```

### Performance Optimization

**Canvas Rendering:**
```typescript
// Use requestAnimationFrame for smooth 60fps
loop(time: number) {
  if (!this.stopped) requestAnimationFrame(this.loop.bind(this));
  // ... rendering code
}

// Batch canvas operations
ctx.save();
ctx.fillStyle = color;
ctx.globalAlpha = opacity;
// Multiple fill operations
ctx.restore();
```

**Large Song Libraries:**
```typescript
// Songs load incrementally via forEach callback
await Song.getSongs(true, (song) => {
  Toxen.songList.push(song);
  if (Toxen.songList.length % 50 === 0) {
    Toxen.updateSongPanels(); // Update UI every 50 songs
  }
});
```

**Memory Management:**
```typescript
// Revoke blob URLs when done
if (this.lastBlobUrl) URL.revokeObjectURL(this.lastBlobUrl);

// Clear large arrays
this.starRushParticles = [];
dataArray = null;
```

## Key Files to Reference

**Core Architecture:**
- `src/app/ToxenApp.tsx` - Main React component & global `Toxen` class
- `src/ToxenControllers/ToxenController.tsx` - Base controller (web)
- `src/ToxenControllers/DesktopController.tsx` - Desktop extensions
- `vite_toxen_plugin.ts` - Build-time platform injection logic

**Data Models:**
- `src/app/toxen/Song.tsx` - Song entity with ISong interface
- `src/app/toxen/Settings.ts` - Global settings with ISettings interface
- `src/app/toxen/Playlist.tsx` - Playlist management
- `src/app/toxen/User.ts` - User authentication & remote access

**Audio & Visuals:**
- `src/app/components/Background/Visualizer.tsx` - Main visualizer
- `src/app/toxen/AudioEffects.ts` - Web Audio API effects
- `src/app/toxen/StoryboardParser.ts` - Event timeline system
- `src/app/toxen/SubtitleParser.ts` - Subtitle format parsers

**Build Configuration:**
- `forge.config.ts` - Electron packaging configuration
- `vite.main.config.ts` - Main process build
- `vite.renderer.config.ts` - Renderer (React) build
- `vite.web.config.ts` - Web version build
- `package.json` - Dependencies & scripts
