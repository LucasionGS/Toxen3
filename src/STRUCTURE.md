# Toxen client: structure for the sync rewrite

Target layout for Phase 1 (2.13: `SongStorage`, Song split, settings resolver) and Phase 4 (2.14: unified library,
`SyncEngine`). Spec: `docs/plans/sync-v2-and-cleanup.md` §2.2, §2.6, §2.9, §5. The full app layout is in `CLAUDE.md`;
this file only covers what changes. Skeletons are marked `throw new Error("Not implemented.")` / `TODO(builder)`.

## Tree (new and changed)

```
src/
  ToxenControllers/
    ToxenController.tsx      + atomicWriteFile, hashFile, listFilesRecursive, uploadFile, downloadFile (web: desktop-only stubs)
    DesktopController.tsx    implements those (Phase 1: atomicWriteFile; Phase 4: the rest). Phase 1 moves loadLocalSongs out
    DesktopIO.ts             types of the IO methods above
  app/
    bootstrap.ts             (Phase 1) startup steps from ToxenAppRenderer.componentDidMount, each caught on its own;
                             (Phase 4) wires SyncEngine events to notifications, socket events to SyncEngine
    ToxenApp.tsx             Toxen static class + renderer only
    toxen/
      storage/
        SongStorage.ts       interface + namespace (Kind, FileEntry, WriteData, DiskFile, Location, ChangeEvent)
        LocalSongStorage.ts  song folders on disk via toxenapi; emits `change` on every write. `LibraryRules`
                             (buildInfo, audio formats) are injected by SongLibrary so storage never imports Toxen
        CloudSongStorage.ts  server: v1 endpoints (Phase 1), /v2 via SyncApi (Phase 4)
        StorageSelector.ts   the only place that picks Local vs Cloud (song.storage)
      sync/                  (Phase 4, skeletons now)
        SyncApi.ts           SyncV2 contract (copy of server/src/types/syncV2.ts) + /v2 HTTP client. Leaf
        Merge.ts             pure three-way merge -> SyncPlan; conflict record types. Leaf
        SyncState.ts         .toxen/sync.json: bases, hashCache, pending, conflicts, per-machine settings
        Manifest.ts          local folder scan (hash via toxenapi) / remote manifest -> merge input
        Transfer.ts          streamed upload/download with progress
        SyncEngine.ts        static manager: queue, triggers, typed events
      SongLibrary.tsx        load / count / import / delete songs (out of Song.tsx). .tsx for the missing-media notification
      SettingsResolver.ts    storyboard -> playlist -> song -> global -> default
      PlayQueue.ts           (Phase 1) history + queue (out of Song.tsx)
      SongSettingsClipboard.ts (Phase 1) copy/paste settings (out of Song.tsx)
      MediaFormats.ts        (Phase 1) supported/native/transcode extension lists (out of ToxenApp.tsx)
      Notify.ts              (Phase 1) log/warn/error/notify/sendError (out of ToxenApp.tsx; Toxen.* stay as wrappers)
      Song.tsx               entity + paths as one-liners over song.storage + play()
    components/
      SongPanel/SongContextMenu.tsx   (Phase 1) contextMenuModal, trim modal, manage-playlists modals (out of Song.tsx)
      SongPanel/SyncBadge.tsx         (Phase 4) status icon per song row
      SyncConflicts/SyncConflictModal.tsx (Phase 4) diff view, shell now
      Sidepanel/Panels/SettingsPanel/  (Phase 4) Sync tab
```

## What moves where (Phase 1)

| From | Code | To |
|---|---|---|
| Song.tsx | `dirname`, `mediaFile`, `backgroundFile`, `subtitleFile`, `storyboardFile`, `rainfallImageFile` | stay on Song as one-liners over `this.storage.fileLocation` (unauthenticated: callers compare them, append `?h=` and read extensions from them) |
| Song.tsx | `getMediaSource` auth | `this.storage.fileUrl` (authenticated) |
| Song.tsx | `readSubtitleFile`, `readStoryboardFile`, `writeSubtitleFile`, `saveInfo` I/O | `this.storage.readText / writeFile / saveInfo` (subtitle text clean-up stays in Song) |
| Song.tsx | `getSongs`, `getSongCount`, `loadLocalSongs`, `loadRemoteSongs`, `importSong(Remote)`, `delete` | `SongLibrary` (+ `LocalSongStorage.listSongs` gets `DesktopController.loadLocalSongs`). `getSongs`/`getSongCount` stay as `@deprecated` wrappers until ToxenApp calls `SongLibrary`; `loadLocalSongs`/`loadRemoteSongs` stay for the old sync (`SongLibrary.loadFrom(storage)`) |
| Song.tsx | `reload` | stays on Song, reads `info.json` through `this.storage.readText` |
| Song.tsx | `contextMenuModal`, `createTrimSongModal`, `createManagePlaylists`, `createManageMultiSongsPlaylists` | `components/SongPanel/SongContextMenu.tsx` |
| Song.tsx | `SETTINGS_*`, `buildSettingsPayload`, `copyImageFile`, `copy/paste*`, `_applySettingsPayload` | `SongSettingsClipboard.ts` (`copyImageFile` via `readBlob` + `writeFile`) |
| Song.tsx | `history*`, `clearQueue`, `addToQueue`, `removeFromQueue` | `PlayQueue.ts` (fix: `addToQueue` must not sort) |
| Song.tsx | `play()` orchestration | `MusicPlayerController.playSong()` with a play token (plan §5 race fix) |
| Song.tsx | `toISong` key list, `create` `any` loop | one typed `SONG_INFO_KEYS` constant in Song.tsx used by both |
| Song.tsx | old sync: `sync`, `compare*`, `validateAgainstRemote`, `downloadRemoteToLocal`, `downloadAllMissingRemoteToLocal`, `setFile` | untouched in Phase 1; deleted in Phase 4 |
| Storyboard.tsx | 25 `get*` getters | one-line wrappers over `SettingsResolver.resolve` (callers unchanged), then callers move over |
| ToxenApp.tsx | `get*Files` format lists | `MediaFormats.ts` |
| ToxenApp.tsx | `log/warn/error/notify/sendError` bodies | `Notify.ts` |
| ToxenApp.tsx | autogen theme (`createAutogeneratedTheme`… `restoreOriginalTheme`) | `Theme.ts` |
| ToxenApp.tsx | `componentDidMount` init chain | `app/bootstrap.ts` |

## Boundaries

| Module | May import | Must not import |
|---|---|---|
| `sync/SyncApi.ts`, `sync/Merge.ts` | each other (types) | anything else in the app (they're leaves; Merge is tested from a scratch script) |
| `sync/*` (rest) | `storage/`, `sync/`, `Song` (types), `Settings`, `User`, `toxenapi` | React components, `Toxen` (ToxenApp), `@mantine/*`. User-facing output goes out as `SyncEngine.events` |
| `storage/*` | `Song` (types), `Settings`, `User`, `sync/SyncApi`, `toxenapi` | `SyncEngine`, `Toxen`, React. Errors are thrown; callers notify with `Toxen.error` |
| `SettingsResolver` | `Settings`, `Song`/`Playlist` (types), `ExtensionManager` | React, `Toxen` UI helpers (the default context reads `Toxen.playlist` / current song through a getter passed in by bootstrap, not an import) |
| shared code (anything not in `desktop/` or a Controller) | `toxenapi.*` | `node:*`, `fs`, `path`, `crypto`, `electron` directly |
| `app/bootstrap.ts` | everything | — (it's the wiring layer) |

Rules:
- Pick storage only through `StorageSelector` (`song.storage`). New code never branches on `Settings.isRemote()`.
- Every local song write goes through `LocalSongStorage` (that's what tells sync). During Phase 1 `LocalSongStorage`
  also calls `song.setFile()` itself, so the old sync keeps working and the 16 manual `setFile` calls can go.
- Desktop-only fs/crypto/http lives in `DesktopController`, exposed as `toxenapi` methods with web stubs that throw.
- Keep file line endings: Song.tsx, Playlist.tsx, ToxenApp.tsx, ToxenController.tsx, DesktopController.tsx,
  EditSong.tsx, System.tsx, Storyboard.tsx, changenotes.md are CRLF. Check `git diff --stat` after editing.

## `Settings.isRemote()` call sites -> `song.storage` (82 sites, 22 files)

| Category | Sites | Becomes | Phase |
|---|---|---|---|
| A. Paths and URLs | Song 173-174, 182, 201, 216, 232, 243, 252, 329; Visualizer 241; StoryboardEditorPanel 78 | getters: `song.storage.fileLocation(song, rel)`; things the renderer loads: `song.storage.fileUrl(song, rel)` (already authenticated, drop `appendAuth`); `dirname()` stays as a wrapper. Visualizer 241 keeps `appendAuth` for cloud songs until `Storyboard.getRainfallImage` returns `fileUrl` | 1 |
| B. Read text | Song 264, 340; EditSong 853, 885, 912 | `song.storage.readText` / `readBlob` (settles on errors: fixes C9) | 1 |
| C. Writes | Song 305, 966, 1786; StoryboardParser 239; BackgroundFileSelector 207; EditSong 862, 894, 927 | `song.storage.writeFile` / `saveInfo` (`StoryboardParser.save(song, relPath, config)`) | 1 |
| D. Library | Song 1670, 1686, 1715, 1738, 1754, 1850; ToxenApp 304; System 74, 406; ImportPanel 66; ProviderManager 46, 88, 132; DesktopController 841 | `SongLibrary` + `StorageSelector.forLibrary()`; song file lists use `song.listFiles(supported)` (over `storage.list`); `filterSupportedFiles` stays for non-song folders (theme images) and picks fetch vs disk by the path being a URL | 1 |
| E. Capability checks | Song 606, 612, 756, 1267, 1962; EditSong 104, 941-942; MusicPlayerController 459, 476; ToxenApp 765 | `StorageSelector.isLocal(song)` or `song.storage.kind === SongStorage.Kind.Cloud` | 1 |
| F. Old sync UI and code | Song 1276, 1286, 1452, 1462, 1481, 1555, 2045, 2079, 2095; ToxenApp 1301 | unchanged in Phase 1, deleted with the old sync in Phase 4 | 4 |
| G. Library mode in UI | ToxenApp 1262; LoginForm 34; SongElement 201 | `StorageSelector.forLibrary().kind === SongStorage.Kind.Cloud` | 1 |
| H. Playlists and user assets | Playlist.tsx 77, 170, 198, 406, 455, 462; PlaylistPanel 146, 182, 259, 342; PlaylistManager 144; SettingsPanel 352; BackgroundController 31, 67 | stay on `Settings.isRemote()` (playlists and default backgrounds aren't songs). `appendAuth` is idempotent, so BackgroundController keeps it | 5 |
| Definitions | Settings 157; ToxenController 27 (`isLocal($settings)` -> `@deprecated`, no callers left; it doesn't delegate because importing `StorageSelector` into the controller would pull Settings/Song into it); Legacy 63 (comment) | kept until Phase 4 removes the setting | — |

## Phase 1 checklist

After every step: `npm run buildweb`, then a headless boot in local mode and in web mode (see the memory notes on
xvfb + CDP; pause audio). Play a song, edit info, open subtitles and storyboard. No user-visible change except fixes.

1. Implement `storage/` with the Phase 1 rule in `StorageSelector`, `toxenapi.atomicWriteFile` in DesktopController,
   and `public get storage(): SongStorage { return StorageSelector.forSong(this); }` on Song. No call sites yet.
2. Category A: Song path getters become one-liners; Visualizer and StoryboardEditorPanel use `fileUrl`.
3. Categories B and C: reads/writes through storage; `StoryboardParser.save` takes `(song, relPath, config)`;
   BackgroundFileSelector and `copyImageFile` write through storage (fixes plan §1 problem 1); drop the manual `setFile` calls.
4. Category D: `SongLibrary`; `Toxen.loadSongs` calls `SongLibrary.load`; `loadLocalSongs` body moves to
   `LocalSongStorage.listSongs` (parallel, limit 16-32: plan P4).
5. Categories E and G: capability checks.
6. `SettingsResolver`: fill `DEFINITIONS` from the getters, make the Storyboard getters delegate, then fix the
   precedence bugs (`??` not `||`, default-equal values, autogen pre-guard, one background order).
7. Song.tsx split (context menu, clipboard, queue, play orchestration, `SONG_INFO_KEYS`).
8. ToxenApp.tsx split (`MediaFormats`, `Notify`, autogen theme -> `Theme.ts`, `bootstrap.ts`).
9. `changenotes.md` under the upcoming section (bug fixes only), `CLAUDE.md` source tree.

## Phase 4 checklist (needs server 2.1 or a local server on the Phase 3 contract)

1. DesktopController: `hashFile`, `listFilesRecursive`, `uploadFile` (node http/https stream, Content-Length),
   `downloadFile` (temp + rename + sha256 check).
2. `Merge.ts` + scratch `src/test.ts` with the B/L/R table (plan §7). `SyncState`, `Manifest`, `Transfer`, `SyncEngine`.
3. `Song.location` set by `SongLibrary.load` (merge local + `SyncState` cloud songs by uid); switch `StorageSelector`
   to the Phase 4 rule; `CloudSongStorage` on `SyncApi` with media tokens.
4. Wiring in `bootstrap.ts`: `SyncApi.configure`, `SyncEngine.init` after login and `loadSongs`, socket
   `track:changed` -> `SyncEngine.handleRemoteEvent` (socket on websocket transport only), `SyncEngine.events` ->
   `Toxen.notify`, song rows, `openSyncConflictModal`; `applied` -> re-apply background/subtitles/storyboard of the
   current song (media after it ends).
5. One-time settings migration in `Settings.load`: `isRemote` -> cloud browsing, `remoteSyncOnStartup` /
   `remoteSyncOnSongEdit` -> `syncAuto`; `autoDownload` lives in `SyncState.machine` (default off).
6. UI: `SyncBadge`, context menu (Make available offline / Remove download / Upload to cloud / Delete… scopes),
   library filter, Settings > Sync (status, storage bar with Upgrade past ~80%, conflicts), `SyncConflictModal`.
7. Delete the old sync (plan §2.7 list), drop `premium` checks around sync, `?h=${song.hash}` -> `?r=${rev}`.

## Where does new X go?

| New… | Goes in |
|---|---|
| Per-song file operation | A method on `SongStorage`, implemented in both storages; call it through `song.storage` |
| Library knowledge the storage needs (formats, uid rules) | `LocalSongStorage.LibraryRules`, set in `SongLibrary.tsx` |
| Storage backend | `storage/<Name>SongStorage.ts` implementing `SongStorage`, chosen in `StorageSelector` |
| Overridable setting | `ISettings` + `ISong` field + `SettingsResolver.Values` + `DEFINITIONS`; read with `SettingsResolver.resolve` |
| Desktop-only IO | `toxenapi` method: throwing stub in `ToxenController.tsx`, implementation in `DesktopController.tsx`, types in `DesktopIO.ts` |
| v2 endpoint | Server contract first, copy the `SyncV2` region into `SyncApi.ts`, add a `SyncApi` function |
| Sync event for the UI | Overloads on `SyncEngineEmitter`, handled in `bootstrap.ts` |
| Per-machine sync preference | `SyncState.MachineSettings` (never synced) |
| Synced preference | `ISettings` |
| Song context-menu action | `components/SongPanel/SongContextMenu.tsx` |

## Extension points

`SongStorage` implementations + `StorageSelector`; `SettingsResolver.DEFINITIONS`; `SyncEngineEmitter` events;
`Merge.DEEP_MERGE_FIELDS` / `IGNORED_INFO_FIELDS`; `SyncV2.Change` `kind` (playlists and later settings/themes
through the same changelog, plan §8.2: unknown kinds are ignored).
