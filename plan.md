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

### Extra fun
- DJ booth: Allowing storyboard events to be triggered in real-time through button presses. Buttons are remappable.
  - This could be a fun way to experiment with storyboards, and can be recording live to be saved as a storyboard.

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
  - Allow delays to be set in milliseconds, Toxen should be able to handle down to 1ms precision.
    Concept
    ```ts
    const eventTypes: { [key: string]: ((currentTime: number, args: any) => void) } = {
      "fade": (currentTime, { from, to }: { from: number, to: number }) => {
        // Do stuff
      }
    }
    
    class SBEvent {
      constructor(
      // Time is in ms
      public startTime: number,
      public endTime: number,
      public type: string,
      public data: any) {}
    }

    let index = 0;
    // `index` will be reset to 0 when the storyboard is finished.
    // `index` will be set to first event that intersects with the current time, when user skips to a different time.
    // `index` will be incremented by 1 every time a new event is added to `currentEvents`
    // `index` will be checked every frame to see if it needs to be incremented. Check if storyboardTimeline[index].endTime < currentTime
    const storyboardTimeline: SBEvent[] = [
      new SBEvent(0, 1000, "fade", { from: 0, to: 1 }),
      new SBEvent(1000, 2000, "fade", { from: 1, to: 0 }),
      new SBEvent(2000, 3000, "fade", { from: 0, to: 1 }),
    ];

    // `currentEvents` will be iterated over every frame, and the events will be executed.
    // `currentEvents` will be cleared when the storyboard is finished.
    // `currentEvents` will be cleared when the user skips to a different time.
    // `currentEvents` will remove events that are finished (endTime < currentTime)
    const currentEvents: SBEvent[] = [];

    // On each frame
    const onFrame = () => {
      let tlEvent = storyboardTimeline[index];
      do {
        if (currentTime > tlEvent.startTime) {
          if (currentTime < tlEvent.endTime) {
            currentEvents.push(tlEvent);
          }
          index++;
        }
      } while (currentTime > (tlEvent = storyboardTimeline[index]).startTime);

      // Execute the current events
      currentEvents.forEach(e => {
        if (e.endTime < currentTime) {
          // Remove the event from the currentEvents array
          currentEvents.splice(currentEvents.indexOf(e), 1);
        } else {
          // Execute the event
          const eventHandler = eventTypes[e.type];
          eventHandler?(currentTime, e.data);
        }
      });
    };

    // On skip
    const onSkip = (time: number) => {
      // Reset the index
      index = 0;
      // Clear the current events
      currentEvents.length = 0;
      // Find the first event that intersects with the current time
      while (time > storyboardTimeline[index].startTime) {
        index++;
      }
    };
      
    ```

- Music shuffle: Should be more shuffled, so it should play through at least the whole playlist, before replaying the same songs.

- Themes: Allow for themes to be applied to the whole application. Should be downloadable from within Toxen, using the `Toxen.net` API.