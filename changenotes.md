<!-- ## Upcoming update / 1.5.2 -->
<!-- ## Upcoming update / 1.6.1 -->
## 1.6.0 - 30-09-2023
- Added new visualizer: `Waveform`!
- Added Media Downloader to the import tab. It can be used to download media from Youtube or Soundcloud, and import it to the library.
## 1.5.1 - 01-02-2023
- Added support for `jfif` images.
## 1.5.0 - 12-05-2022
Storyboard:
- Added Philips Hue experimental support. This will be extended further with more features and customization.

Song-Specific Background visuals:
- Added display positions for title of the song on the background. Colors follow visualizer colors. This new feature can be found when editing a song and scrolling down to the **Song-specific visuals** section.

## 1.4.2 - 29-10-2022
Hotfix: Fixed songs being shuffle even when the setting is disabled, when a songs ends on it's own.
## 1.4.1 - 28-10-2022
Playlists:
- Added the ability to change the name of a playlist.
- Removed playlist name length limit.
- Changed the layout of the playlist selection screen.

Storyboards:
- Added background changing effect.

Visualizer:
- Added `Visualizer Size` to the settings. It allows you to change how detailed the visualizer is. The higher the value, the more intense the impact on performance. 6 is the standard and should work well for most, but you can increase or decrease this if you experience lag or if you want to see more detail.
## 1.4.0 - 13-10-2022
New features
- First iteration of a storyboard implementation has been released!
  - Songs with a storyboard file (.tsb) can be selected in the song details panel. (More documentation will be added later)
  - An editor is available when pressing edit song. There's a button under where you would select Storyboard file.
  - The editor has a BPM Finder, you can tab to the beat and it will automatically calculate the BPM for you. The longer you do this for and more consistent you can keeep with the beat, the more accurate it will be.
- (Windows only) `.wma` files are now (indirectly) supported. They are converted to .mp3 when played first time.
  - If you have a lot of `.wma` files in your songs, you can use the button `Settings` -> `Advanced` -> `Convert all necessary audio files` to convert them all at once.
- You can import folders with drag and drop, and Toxen will look through the folder recursively for media files and copy them to the library.
- If you have a song folder which is missing a media file in settings, it will look for one in the folder. If none is found, Toxen will prompt you that it's missing a media file, and you'll have the option to delete the song folder.  
![image](./docs/images/song_missing_media_file.png)
- Added Mini-Player mode! Press `CTRL + F11` to toggle it. When in miniplayer mode, double clicking the window will go back to normal mode.

Restricted access features
- Toxen stream server has been added. This is a new way to stream songs to the client. Currently this feature is restricted to the developer, but will be opened up as a `Premium` feature later. No existing features in Toxen will be restricted by `Premium`, don't worry.
- Login button in the top right corner has been added. This is currently only used for the stream server, but will be used for other features later. Registration is currently not possible and is restricted to a select few.
- Added `Sync to remote` on each song on the `Context menu` (right click). This will sync the song to the remote server. This only works if you're logged in as a user with `Premium`.

Changes
- The song panel will now only render songs that are in frame. This should improve overall performance if you have a lot of songs. (This was tested with over 2000 songs)
- Restyled the search box in the song panel.
- Changed the search bar in the song panel to require an `Enter` press to search. This should improve performance when typing in the search box.
  - It will still auto-reset the list when the search box is empty.
- Moved "Change playlist" into the header of the song panel.

Removed
- Removed `Migration` button from advanced mode sidebar

Bug fixes
- Fixed `Progress bar: Show milliseconds` showing weirdly and pushing other elements when a song is playing.
- Fixed Toxen crashing when importing the first song in an empty music folder.

## 1.3.3 - 2022-06-17
- Added alternative Toxen icon.
- Fixed Appbar title overflowing.
## 1.3.2 - 2022-06-17
- Fixed Toxen not downloading ffmpeg due to expired URL.
- Auto retrying up to 3 times if trimming fails.
## 1.3.1 - 2022-06-07
A couple minor fixes and improvements.
- Added new shortcuts for opening specific panels. Can be found in the Toxen dropdown in the top right corner under `Toxen`.
- Fixed up the remaining design changes on the Edit Song panel.
- Changes on a the Song Edit panel now save automatically when changed, so no need to click Save.

## 1.3.0 - 2022-04-23
New features
- Fully implemented song trimming feature. Right-click on a song and select `Trim` to start the quick and easy process.  
Works for both audio and video files. It will generate a new file with the same name as the original file, but with the prefix `trimmed.` and automatically apply it.  
You can always revert it back to the original file in the `Edit song` panel. `ffmpeg` is required for this feature to work. It will automatically download `ffmpeg` when it's required.  
`Currently this feature only works on Windows.`
- Added support for `.webp` images for backgrounds.
- Added option to show song progress in milliseconds along with the standard time format: `hh:mm:ss.ms`

Fixed bugs
- Fixed volume bar not displaying the correct volume on startup.

## 1.2.0 - 2022-04-18
Major changes:
- Massive overhaul of the sidepanel interactive element's design. Moved to using Mantine for the UI for certain elements, of which includes textboxes, dropdowns, buttons, sliders, and checkboxes. (You'll still find old design elements some places, but they will all be updated over time)
- Volume control is now a more accurate slider.
- Added customizable background for the sidepanel. It can be changed in `Settings > Sidepanel > Sidepanel Background`.

Minor changes:
- Fixed background dim being removed when Dynamic Lighting is disabled.

## 1.1.1 - 2022-04-14
Major changes:
- If a search is made in the song list, Toxen will only play songs that match the search.
  This will help if you're too lazy to make a queue or playlist with all the songs you want to play if they match a search term.

Minor changes:
- Fixed search field not searching after language tag.

## 1.1.0 - 2022-04-14
From now on, version format will follow the MAJOR.MINOR.PATCH format, instead of incrementing only the last number.

Major changes:
- Added option to have background images pulse along with the music. This can be toggled in global settings, and per song. It's `disabled` by default. Each song can choose to force enable, disable, or use the global (`<Default>`) setting.
- Added `Sides` visualizer. It's as the name implies, similar to Top and Bottom visualizers, but it shows the sides of the window instead.
- Added `Playlist` manager. Open it by using a song's context menu. You can also select multiple songs and manage multiple at once.
- Made textboxes smaller with smaller text. This is subject to change depending on feedback.

Minor changes:
- Fixed `0` background dim not actually being `0%` dimmed.

## 1.0.21 - 2022-04-13
Major changes:
- Changed the design of (some) context menus
- Changed right-clicking on the background to find the currently playing song in the song list. (Previously it opened current song's context menu)
- Added a `Delete` function to the song context menu.
- Changed how playlists are deleted to a confirm prompt instead of an extended context menu.
- Completely changed the Message Card to a more modern and simple design.
- Added a button to open the context menu on a song element. Displayed in front of the song name when hovering over it.

Minor changes:
- Fixed some miscoloring in the base theme.
- Removed Discord error prompts when failing to connect to the Discord API, as it caused spam when Discord isn't available on the computer.

## 1.0.20 - 2022/2/15
Major changes:
- Added tabs to settings
- Settings now automatically save when changed.
- Redesigned the color scheme for the base application, giving it a greener, more Toxen-like look.

Minor changes:
- Added a `Pause With Click` option under a new `Controls` tab.
  - Toggling this off will disable pausing the application when the mouse is clicked on the background.
- Created preparations for song trimming.

## 1.0.19 - 2021/11/16
Major changes:
- Changed how login works. Login can now be done even when not connected to a specific remote server, and will resolve to Toxen official server. Only users with a premium Toxen account can use a remote library.
- Added additional support for flac, ogg, and wav audio files.
- Added a custom app title bar instead of the default OS one. It will be consistent across all OSes.
- Added migration of playlists from Toxen2 if you had any prior to Toxen3
  - This can be done by going to the settings page, and enabling `Advanced UI`, then after saving, pressing on the `Migration` button in the sidebar.

Minor changes:
- Moved around some settings in `Edit Song` panel.
- Fixed the subtitles being selectable with the mouse when active.
## 1.0.18 - 2021/10/19
Major changes:
- Fixed a software breaking bug that was preventing Toxen from initializing properly on first run.
- Added customizable themes (Currently with no built-in editor or documentation - will come later)

Minor changes:
- Added buffering display when streaming from a Toxen server.
- Added expandable content components.
- Made the border around `Progress bars` / `Sliders` less round
- Added preparations for recording a song with the visuals as a video.
- Fixed Toxen attempting to connect to Discord infinitly if Discord is not installed, not running, or couldn't connect.
- Fixed subtitles not being parsed if the file used the wrong type of comma.
- Fixed toxen not being able to load songs from a remote server due to playlists not being supported remotely.
- Changed rainbow visualizer's rotation speed.

## 1.0.17 - 2021/09/23
Major changes:
- Added playlist functionality!
  - Playlists are still subject to change! It will be upgraded and improved in the future.
- Added Dynamic Background Lighting and an option to toggle it.
- Added background dim level to settings.
- Added `Advanced UI` to settings. It will enable more options in settings, as well as add a few new elements to the UI for more technical use.
  - If you're just a regular user of Toxen, this is not necessary to enable. It's meant for advanced users who want to work with Toxen in a more technical way.
- Added Discord integration. Settings for these are located in `Settings > Advanced UI > Discord`.
- Added song multi-select and multi-action.

Minor changes:
- Added fade-in/out animation for message cards.
- Added preparation for the storyboard system.
- Added warning in description on some options that has flashing colors.
- Changed how the currently playing track is displayed.
- Changed the default state of the side panel to be closed on startup.
- Fixed subtitleDelay song property not saving after reload.
- Fixed certain settings not applying as defaults, if they are not set.
- Added transparency to the sidepanel when not hovered over.

## 1.0.16
New stuff:
  - Added a less intrusive auto update prompt.
  - The title of Toxen now changes to the current song which is being played.
  - Added more functions to the context menu for songs.
  - Added queue to the song panel! (Right click on a song to add it to the queue.)
  - Added tooltip to Music progress bar to easier tell what timestamp your cursor is hovering over.
  - Added `srt` (SubRip) subtitle support, as well as a more customizable subtitle format specifically for Toxen, `tst` files!(**T**oxen **S**ub**T**itles)  
  More details under [New Subtitle support](#newsubtitlesupport).
    - `Toxen SubTitles` are a subtitle format that is used by Toxen, and is similar to, yet more customizable than the default `srt` format.
    - `tst` is being continuously updated over time.
  - Added export options for media files, image files, and subtitle files, as well as transpiling between subtitle formats.
  
Changed stuff:
  - Changed Checkbox icons from a slider-check-icon to a circular-check-icon

### New Subtitle support
Along with support for a standard `srt` subtitle format, Toxen supports a more customizable subtitle format, specifically for Toxen.  
If you don't know how srt subtitles work, you can read about them [here](https://en.wikipedia.org/wiki/SubRip).

#### How Toxen SubTitles work:
```
@color = white
@font = Arial
@size = 24

00:00:15,500 | 00:00:19,155
This will come in between the two timestamps!

00:00:19,155 | 00:00:22,238
This will come in between the other two timestamps above this text!

00:00:22,238 | 00:00:25,753
You can make it multiple lines
by simply making a new line.
Just make sure you leave no empty lines in between.

00:00:25,753 | 00:00:29,386
But you need to always have a new line at the end of each subtitle.

00:00:29,386 | 00:00:31,171
Timestamps are in the format:
hh:mm:ss,MMM
(h: hours, m: minutes, s: seconds, M: milliseconds)

00:00:31,171 | 00:00:33,199
@color = red
@fontSize = 30
And this text will be in the color red and font size 30! Other options are available like "@font".
If you have a line that begins with an @ symbol, you can escape it with "\".
\@ like this!
```

## 1.0.15
New stuff:
  - View change notes directly in Toxen from the sidebar under `Change logs`
  - Added `Repeat` functionality.
  - Added `Shuffle` functionality.
  - Added song `History` and proper `Next & Previous song` functionality using the history.
  - Added technical details to the `About`(Previously `Stats`) panel.
  - Added experimental streaming server as a Music Library folder, and user login when connected to a server.
    - This is still in development, and is not yet fully functional. It is currently not possible to host or connect to a streaming server,
    but will be in the future.
  - Added `Default background` functionality to the `Settings` panel.

Changed stuff
  - Changed `Stats` panel to `About` panel.
  - Changed `Music Library` change directory to a `Change Directory` button, and allowed the text field directly to change the directory, if they so desire.

## < 1.0.15
Changes prior to 1.0.15 hasn't been recorded. Changes from 1.0.15 onwards are listed above.