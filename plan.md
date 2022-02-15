# Toxen3 Development

## TODO
### Base Requirements
- Side panel
  - Toggleable from button presses.
  - Menu can switch between different panels.
    - Panels: `Songs`, `Settings`, `Playlist Management`, `Edit song data`

- Plugins: Allow developers to write plugins for Toxen, and give them their own management panel.
- Listen together: Listen along other Toxen users.
- Visualizer
  - Color picker from current background.
- Playlist management
  - Create playlist from current queue.
  - Multi-add to playlist.

### Bugs
- Fix background dim still being dimmed even at 0% opacity.
- No easy way to delete a song from your library. (Physically delete it from the file system)

### Improvements from v2
- Asynchronize loading of Songs, and overall use an async structure.

- Playlists: Simplier creation, renaming, deleting, and general managing.
  - For god sake, store them separately. Not in the fucking song details individually.

- Visualizer: Smooth out visuals

- Storyboard: Drop the custom language concept entirely, make an editor immmediately using JSON storage.
  - A light script based on the editors attributes might be a possibility. This could make it easier to edit a storyboard for those who prefer to use a text editor.

- Music shuffle: Should be more shuffled, so it should play through at least the whole playlist, before replaying the same songs.

- Themes: Allow for themes to be applied to the whole application. Should be downloadable from within Toxen, using the `Toxen.net` API.