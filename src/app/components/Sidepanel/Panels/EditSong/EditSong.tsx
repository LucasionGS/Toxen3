// import * as remote from "@electron/remote";
import React from "react";
import Converter from "../../../../toxen/Converter";
import Settings, { VisualizerStyle } from "../../../../toxen/Settings";
import Song, { ISong } from "../../../../toxen/Song";
import Playlist from "../../../../toxen/Playlist";
import SubtitleParser from "../../../../toxen/SubtitleParser";
import System from "../../../../toxen/System";
import { Toxen } from "../../../../ToxenApp";
import SidepanelSectionHeader from "../../SidepanelSectionHeader";
import "./EditSong.scss";
// import fsp from "fs/promises";
// import Path from "path";
import { Button, Checkbox, ColorInput, InputLabel, Loader, NumberInput, Radio, Select, Slider, TextInput } from "@mantine/core";
import ListInput from "../../../ListInput/ListInput";
import SelectAsync from "../../../SelectAsync/SelectAsync";
import BackgroundFileSelector from "../../../BackgroundFileSelector/BackgroundFileSelector";
import { useModals } from "@mantine/modals";
import ScreenPositionSelector from "../../../ScreenPositionSelector/ScreenPositionSelector";
import { VisualizerStyleOptions } from "../SettingsPanel/SettingsPanel";
import { useForceUpdate } from "@mantine/hooks";
import { hideNotification, updateNotification } from "@mantine/notifications";

interface EditSongProps { }

export default function EditSong(props: EditSongProps) {
  const modals = useModals();
  const forceUpdate = useForceUpdate();

  // State for playlist-specific settings mode
  const [isPlaylistMode, setIsPlaylistMode] = React.useState(false);
  const currentPlaylist = Toxen.playlist;
  // const hasPlaylistSettings = currentPlaylist ? Toxen.editingSong.hasPlaylistSettings(currentPlaylist.name) : false;
  
  // Get current settings (either playlist-specific or song default)
  const getCurrentSettings = () => {
    if (isPlaylistMode && currentPlaylist) {
      return Toxen.editingSong.getPlaylistSettings(currentPlaylist.name) || {};
    }
    return Toxen.editingSong;
  };

  // Save settings to the appropriate location
  const saveSettings = (key: string, value: any, saveToFile: boolean = true) => {
    if (isPlaylistMode && currentPlaylist) {
      const currentPlaylistSettings = Toxen.editingSong.getPlaylistSettings(currentPlaylist.name) || {};
      const newSettings = { ...currentPlaylistSettings, [key]: value };
      Toxen.editingSong.setPlaylistSettings(currentPlaylist.name, newSettings);
    } else {
      (Toxen.editingSong as any)[key] = value;
    }

    if (saveToFile) {
      Toxen.editingSong.saveInfo();
    }
  };

  type ValidSettings = Partial<Omit<ISong, "uid" | "files" | "hash" | "duration" | "playlistSettings">>;
  type ValidSetting = keyof ValidSettings;
  
  // Get value for inputs
  const getValue = (key: ValidSetting | `${ValidSetting}.${string}`): any => {
    const settings = getCurrentSettings();
    if (key.includes('.')) {
      const keys = key.split('.');
      let obj: any = settings;
      for (const k of keys) {
        obj = obj?.[k];
      }
      return obj;
    }
    return (settings as any)[key];
  };

  function textInputSaveOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      Toxen.editingSong.saveInfo();
    }
  }

  const inActivePlaylist = currentPlaylist && currentPlaylist.songList.includes(Toxen.editingSong);
  
  return (
    <div key={`${isPlaylistMode ? currentPlaylist?.name : 'song'}-${Toxen.editingSong.uid}`}>
      <SidepanelSectionHeader>
        <h1>Edit music details</h1>
        {/* <button className="tx-btn tx-btn-action" onClick={() => Toxen.editSongForm.submit()}>
          <i className="fas fa-save"></i>&nbsp;
          Save
        </button> */}
        <Button.Group>
          {inActivePlaylist && (
            <Button 
              variant={isPlaylistMode ? "filled" : "light"} 
              onClick={() => setIsPlaylistMode(!isPlaylistMode)}
              leftSection={<i className="fas fa-list"></i>}
              title={isPlaylistMode ? `Switch to Song Settings` : `Switch to Playlist-specific settings for: ${currentPlaylist.name}`}
            >
              {isPlaylistMode ? `For Playlist: ${currentPlaylist.name}` : 'Song Settings'}
            </Button>
          )}
          {
            !Settings.isRemote() && toxenapi.isDesktop() && (
            <Button onClick={() => toxenapi.remote.shell.openPath(Toxen.editingSong.dirname())} leftSection={<i className="fas fa-folder-open"></i>}>
              Open music folder
            </Button>
            )
          }
          <Button onClick={() => Toxen.reloadSection()} leftSection={<i className="fas fa-redo"></i>}>
            Reload data
          </Button>
          <Button className="advanced-only" onClick={() => Toxen.editingSong.copyUID()} leftSection={<i className="fas fa-redo"></i>}>
            Copy UUID
          </Button>
        </Button.Group>
      </SidepanelSectionHeader>
      
      <>
        {!isPlaylistMode && (<>
          <h2>General information</h2>
          <TextInput
            label="Artist"
            name="artist"
            onChange={(v) => saveSettings('artist', v.currentTarget.value)}
            defaultValue={getValue('artist')}
            onBlur={() => Toxen.editingSong.saveInfo()}
            onKeyDown={textInputSaveOnEnter}
          />
          <TextInput
            label="Title"
            name="title"
            onChange={(v) => saveSettings('title', v.currentTarget.value)}
            defaultValue={getValue('title')}
            onBlur={() => Toxen.editingSong.saveInfo()}
            onKeyDown={textInputSaveOnEnter}
          />
          <ListInput
            label="Co-Artists"
            name="coArtists"
            onChange={(list) => saveSettings('coArtists', list)}
            defaultValue={getValue('coArtists')}
          />
          <TextInput
            label="Album"
            name="album"
            onChange={(v) => saveSettings('album', v.currentTarget.value)}
            defaultValue={getValue('album')}
            onBlur={() => Toxen.editingSong.saveInfo()}
            onKeyDown={textInputSaveOnEnter}
          />
          <TextInput
            label="Genre"
            name="genre"
            onChange={(v) => saveSettings('genre', v.currentTarget.value)}
            defaultValue={getValue('genre')}
            onBlur={() => Toxen.editingSong.saveInfo()}
            onKeyDown={textInputSaveOnEnter}
          />
          <TextInput
            label="Source"
            name="source"
            onChange={(v) => saveSettings('source', v.currentTarget.value)}
            defaultValue={getValue('source')}
            onBlur={() => Toxen.editingSong.saveInfo()}
            onKeyDown={textInputSaveOnEnter}
          />
          <TextInput
            label="Language"
            name="language"
            onChange={(v) => saveSettings('language', v.currentTarget.value)}
            defaultValue={getValue('language')}
            onBlur={() => Toxen.editingSong.saveInfo()}
            onKeyDown={textInputSaveOnEnter}
          />
          <NumberInput
            label="Release Year"
            name="year"
            onChange={(v) => saveSettings('year', +v)}
            defaultValue={getValue('year')}
            onBlur={() => Toxen.editingSong.saveInfo()}
            onKeyDown={textInputSaveOnEnter}
          />
          <ListInput
            label="Tags"
            name="tags"
            onChange={(list) => saveSettings('tags', list)}
            defaultValue={getValue('tags')}
          />

        </>)
        }
        <SelectAsync
          allowDeselect={false}
          label="Media File"
          name="paths.media"
          defaultValue={getValue('paths.media')}
          data={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedMediaFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })}
          onChange={(v) => {
            if (isPlaylistMode && currentPlaylist) {
              const currentSettings = getCurrentSettings();
              const paths = currentSettings.paths || {};
              saveSettings('paths', { ...paths, media: v });
            } else {
              Toxen.editingSong.paths.media = v;
              Toxen.editingSong.saveInfo();
            }
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              Toxen.musicPlayer.setSource(current.mediaFile(), true);
            }
          }}
        />
        <BackgroundFileSelector
          label="Background file"
          defaultValue={getValue('paths.background')}
          sourceDir={Toxen.editingSong.dirname()}
          onChange={(v) => {
            // Invalidate cache for old background before changing
            Toxen.invalidateSongBackgroundCache(Toxen.editingSong);
            
            if (isPlaylistMode && currentPlaylist) {
              const currentSettings = getCurrentSettings();
              const paths = currentSettings.paths || {};
              saveSettings('paths', { ...paths, background: v });
            } else {
              Toxen.editingSong.paths.background = v;
              Toxen.editingSong.saveInfo();
            }
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              Toxen.background.setBackground(current.backgroundFile() + "?h=" + current.hash);
            }
          }}
        />

        <SelectAsync
          allowDeselect={false}
          label="Subtitle file"
          name="paths.subtitles"
          defaultValue={getValue('paths.subtitles')}
          data={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedSubtitleFiles();
            return [
              "<Empty>",
              ...(await Toxen.filterSupportedFiles(path, supported))
            ];
          })}
          onChange={(v) => {
            if (v === "<Empty>") {
              v = null;
            }
            if (isPlaylistMode && currentPlaylist) {
              const currentSettings = getCurrentSettings();
              const paths = currentSettings.paths || {};
              saveSettings('paths', { ...paths, subtitles: v });
            } else {
              Toxen.editingSong.paths.subtitles = v;
              Toxen.editingSong.saveInfo();
            }
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              current.applySubtitles();
            }
          }}
        />
        <NumberInput
          label="Subtitle Offset (ms)"
          name="subtitleDelay"
          defaultValue={getValue('subtitleDelay')}
          onChange={(v) => {
            saveSettings('subtitleDelay', +v);
          }}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />

        {/* Whisper Transcription - Advanced UI only */}
        {Settings.isAdvanced() && toxenapi.isDesktop() && (
          <>
            <InputLabel>Auto-transcribe with Whisper</InputLabel>
            <Button
              leftSection={<i className="fas fa-microphone"></i>}
              onClick={async () => {
                try {
                  const infoLog = Toxen.notify({
                    title: "Whisper",
                    content: (<>
                      <Loader size="xs" /> Transcribing with Whisper...
                      <br />
                      This may take a while depending on the audio length.
                    </>),
                    expiresIn: null,
                    type: "normal",
                    disableClose: true,
                  });
                  await toxenapi.transcribeWithWhisper(Toxen, Song, Toxen.editingSong);
                  
                  updateNotification({
                    id: infoLog,
                    message: (<>
                      <i className="fas fa-check"></i>&nbsp;
                      Transcription completed successfully!
                    </>)
                  });

                  setTimeout(() => {
                    // Close the notification after a short delay
                    hideNotification(infoLog);
                  }, 2000);
                  
                  // Update UI
                  forceUpdate();
                } catch (error) {
                  console.error("Whisper transcription failed:", error);
                  if (error.message.includes("command not found") || error.message.includes("not recognized")) {
                    Toxen.error("Whisper not found. Please install Whisper with 'pip install openai-whisper' and ensure it's in your PATH.");
                  } else if (error.message.includes("timeout")) {
                    Toxen.error("Whisper transcription timed out. Try with a shorter audio file.");
                  } else {
                    Toxen.error(`Whisper transcription failed: ${error.message}`);
                  }
                }
              }}
              variant="light"
              color="blue"
              fullWidth
            >
              Generate Subtitles with Whisper
            </Button>
            <sup>
              Requires OpenAI Whisper installed globally ('pip install openai-whisper'). 
              Will create an SRT file with automatic transcription.
              <br />
              <strong>Note:</strong> This may take a while depending on the audio length, AND it will likely be incorrect, so used the Subtitle Editor to fix it.
            </sup>
          </>
        )}
        <SelectAsync
          allowDeselect={false}
          label="Storyboard file"
          name="paths.storyboard"
          defaultValue={getValue('paths.storyboard')}
          data={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedStoryboardFiles();
            return [
              "<Empty>",
              ...(await Toxen.filterSupportedFiles(path, supported))
            ];
          })}
          onChange={(v) => {
            if (v === "<Empty>") {
              v = null;
            }
            console.log("changed", v);
            if (isPlaylistMode && currentPlaylist) {
              const currentSettings = getCurrentSettings();
              const paths = currentSettings.paths || {};
              saveSettings('paths', { ...paths, storyboard: v });
            } else {
              Toxen.editingSong.paths.storyboard = v;
              Toxen.editingSong.saveInfo();
            }
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              current.applyStoryboard();
            }
          }}
        />
        <Button onClick={() => {
          Toxen.setMode("StoryboardEditor", Toxen.editingSong);
        }}>
          Edit storyboard
        </Button>

        <hr />
        <h2>Song-specific visuals</h2>
        <ColorInput
          label="Visualizer Color"
          name="visualizerColor"
          defaultValue={getValue('visualizerColor') ?? "<Default>"}
          onChange={(v) => {
            saveSettings('visualizerColor', v, false);
            Toxen.setAllVisualColors(v);
          }}
          onChangeEnd={(v) => {
            saveSettings('visualizerColor', v);
            Toxen.setAllVisualColors(v);
          }}
          onBlur={() => {
            Toxen.setAllVisualColors(getValue('visualizerColor'));
            Toxen.editingSong.saveInfo();
          }}
        />
        <Checkbox
          label="Force Visualizer Rainbow Mode"
          name="visualizerForceRainbowMode"
          defaultChecked={getValue('visualizerForceRainbowMode')}
          onChange={(v) => {
            saveSettings('visualizerForceRainbowMode', v.currentTarget.checked);
            // Toxen.setAllVisualColors(Toxen.editingSong.visualizerColor);
          }}
        />
        <sup>Enable to force Rainbow mode onto this song. If disabled, but the global settings have it enabled, this will also be enabled.</sup>

        <Select
          allowDeselect={false}
          label="Background pulsing"
          name="visualizerPulseBackground"
          defaultValue={getValue('visualizerPulseBackground') ?? ""}
          data={[
            { value: "", label: "<Default>" },
            { value: "pulse", label: "Enabled" },
            { value: "pulse-off", label: "Disabled" }
          ]}
          onChange={(v) => {
            saveSettings('visualizerPulseBackground', v as any);
          }}
        />
        <sup>Enables pulsing on the background image of a song. Pulse is based off music intensity and volume.</sup>

        <InputLabel>Background Dim</InputLabel>
        <Slider
          defaultValue={getValue('backgroundDim') ?? -1}
          onChange={(v) => {
            saveSettings('backgroundDim', v === -1 ? null : v);
          }}
          onChangeEnd={(v) => {
            saveSettings('backgroundDim', v === -1 ? null : v);
          }}
          label={(value) => value === -1 ? "Default" : `${value}%`}
          min={-1}
          max={100}
        />
        <sup>Set the background dim level for this song. Default uses the global setting.</sup>

        <Select
          allowDeselect={false}
          label="Autogenerated Theme"
          name="autogeneratedTheme"
          defaultValue={getValue('autogeneratedTheme') ? "enabled" : getValue('autogeneratedTheme') === false ? "disabled" : ""}
          data={[
            { value: "", label: `<Default> (${Settings.get("autogeneratedTheme") ? "Enabled" : "Disabled"})` },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" }
          ]}
          onChange={(v) => {
            saveSettings('autogeneratedTheme', v === "enabled" ? true : v === "disabled" ? false : null);
            // Trigger theme update immediately
            Toxen.applyAutogeneratedThemeIfEnabled();
          }}
        />
        <sup>Enables autogenerated theme based on the visualizer color. The theme will automatically update as the visualizer color changes throughout the song. Default follows the global setting.</sup>

        <Select
          allowDeselect={false}
          label="Visualizer Style"
          name="visualizerStyle"
          defaultValue={getValue('visualizerStyle') ?? ""}
          data={[
            { value: "", label: "<Default>" },
            ...(() => {
              let objs: { value: string, label: string }[] = [];
              for (const key in VisualizerStyle) {
                if (Object.prototype.hasOwnProperty.call(VisualizerStyle, key)) {
                  const v = (VisualizerStyle as any)[key];
                  objs.push({ value: v, label: Converter.camelCaseToSpacing(key) });
                }
              }
              return objs;
            })()
          ]}
          onChange={(v) => {
            saveSettings('visualizerStyle', v as any);
            forceUpdate();
          }}
        />
        <sup>Select which style for the visualizer to use for this song.</sup>

        {/* Specific VS settings */}
        <VisualizerStyleOptions
          style={getValue('visualizerStyle')}
          allOptions={getValue('visualizerStyleOptions')}
          onSave={(allOptions) => saveSettings('visualizerStyleOptions', allOptions)}
          onSaveEnd={(allOptions) => {
            saveSettings('visualizerStyleOptions', allOptions);
            forceUpdate();
          }}
        />

        {/* Visualizer Glow */}
        <Select
          allowDeselect={false}
          label="Visualizer Glow"
          name="visualizerGlow"
          defaultValue={getValue('visualizerGlow') ? "enabled" : getValue('visualizerGlow') === false ? "disabled" : ""}
          data={[
            { value: "", label: "<Default>" },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" }
          ]}
          onChange={(v) => {
            saveSettings('visualizerGlow', v === "enabled" ? true : v === "disabled" ? false : null);
          }}
        />
        <sup>Enables a glow effect on the visualizer for this song.</sup>

        {/* Visualizer Shuffle */}
        <Select
          allowDeselect={false}
          label="Visualizer Shuffle"
          name="visualizerShuffle"
          defaultValue={getValue('visualizerShuffle') ? "enabled" : getValue('visualizerShuffle') === false ? "disabled" : ""}
          data={[
            { value: "", label: "<Default>" },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" }
          ]}
          onChange={(v) => {
            saveSettings('visualizerShuffle', v === "enabled" ? true : v === "disabled" ? false : null);
          }}
        />
        <sup>Enables a shuffle effect on the visualizer for this song.</sup>

        {/* Star Rush Effect */}
        <Select
          allowDeselect={false}
          label="Star Rush Effect"
          name="starRushEffect"
          defaultValue={getValue('starRushEffect') ? "enabled" : getValue('starRushEffect') === false ? "disabled" : ""}
          data={[
            { value: "", label: "<Default>" },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" }
          ]}
          onChange={(v) => {
            saveSettings('starRushEffect', v === "enabled" ? true : v === "disabled" ? false : null);
          }}
        />
        <sup>Enables a particle effect where white stars/snow shoot outward from the center, accelerating as they move.</sup>

        <Select
          allowDeselect={false}
          label="Star Rush Intensity"
          name="starRushIntensity"
          defaultValue={getValue('starRushIntensity')?.toString() || ""}
          data={[
            { value: "", label: "<Default>" },
            { value: "0.25", label: "Very Low (0.25x)" },
            { value: "0.5", label: "Low (0.5x)" },
            { value: "0.75", label: "Reduced (0.75x)" },
            { value: "1", label: "Normal (1x)" },
            { value: "1.25", label: "High (1.25x)" },
            { value: "1.5", label: "Very High (1.5x)" },
            { value: "2", label: "Maximum (2x)" }
          ]}
          onChange={(v) => {
            saveSettings('starRushIntensity', v ? parseFloat(v) : null);
          }}
        />
        <sup>Controls the intensity of the star rush effect for this song.</sup>


        <Checkbox
          label="Floating Title"
          name="floatingTitle"
          defaultChecked={getValue('floatingTitle')}
          onChange={v => {
            saveSettings('floatingTitle', v.currentTarget.checked);
          }}
        />
        <sup>Gives the floating title an underline</sup>

        <TextInput
          label="Floating Title: Text"
          name="floatingTitleText"
          placeholder="<Default>"
          onChange={(v) => saveSettings('floatingTitleText', v.currentTarget.value)}
          defaultValue={getValue('floatingTitleText')}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <sup>Set the text for the floating title. (Defaults to song title, if empty)</sup>

        {/* useFloatingTitleSubtitles */}
        <Checkbox
          label="Floating Title: Use Subtitles"
          name="useFloatingTitleSubtitles"
          defaultChecked={getValue('useFloatingTitleSubtitles')}
          onChange={v => {
            saveSettings('useFloatingTitleSubtitles', v.currentTarget.checked);
          }}
        />
        <sup>Use the subtitles if selected, as the text for the floating title. This overrides the text field.</sup>

        <Checkbox
          label="Floating Title: Underline"
          name="floatingTitleUnderline"
          defaultChecked={getValue('floatingTitleUnderline')}
          onChange={v => {
            saveSettings('floatingTitleUnderline', v.currentTarget.checked);
          }}
        />
        <sup>Enables the floating title for this song.</sup>
        <ScreenPositionSelector
          onChange={v => {
            saveSettings('floatingTitlePosition', v === "" ? null : v);
          }}
          defaultValue={getValue('floatingTitlePosition') || ""}
          label="Floating Title: Position"
          name="floatingTitlePosition"
          deselectable
          showText
        />
        <sup>Set the position of the floating title.</sup>

        <Checkbox
          label="Floating Title: Reactive"
          name="floatingTitleReactive"
          defaultChecked={getValue('floatingTitleReactive')}
          onChange={v => {
            saveSettings('floatingTitleReactive', v.currentTarget.checked);
          }}
        />
        <sup>Enables the floating title to react to the music.</sup>

        <Checkbox
          label="Floating Title: Override Visualizer"
          name="floatingTitleOverrideVisualizer"
          defaultChecked={getValue('floatingTitleOverrideVisualizer')}
          onChange={v => {
            saveSettings('floatingTitleOverrideVisualizer', v.currentTarget.checked);
          }}
        />
        <sup>Enables the floating title to override the visualizer if necessary. Otherwise its just placed on top.</sup>

        <ColorInput
          label="Floating Title: Outline Color"
          placeholder="#FFFFFF"
          defaultValue={getValue('floatingTitleOutlineColor') || "#FFFFFF"}
          onChange={v => {
            saveSettings('floatingTitleOutlineColor', v, false);
          }}
          onChangeEnd={v => {
            saveSettings('floatingTitleOutlineColor', v);
          }}
        />
        <sup>Set the outline color for the floating title text.</sup>
      </>
      <hr />
      <h2>Export options</h2>
      <Button onClick={async () => {
        if (toxenapi.isDesktop()) {
          toxenapi.remote.Menu.buildFromTemplate(
            (await Toxen.filterSupportedFiles(Toxen.editingSong.dirname(), Toxen.getSupportedMediaFiles())).map(file => {
              file = Toxen.editingSong.dirname(file);
              return {
                label: (Toxen.editingSong.mediaFile() === file ? "(Current) " : "") + "Export " + file,
                click: async () => {
                  let fileData: Buffer;
                  try {
                    if (Settings.isRemote()) {
                      fileData = Buffer.from(await Toxen.fetch(file).then(res => res.arrayBuffer()));
                    }
                    else {
                      fileData = await toxenapi.fs.promises.readFile(file);
                    }
                  } catch (error) {
                    return Toxen.error(error);
                  }
                  System.exportFile(Settings.isRemote() ? toxenapi.path.basename(file) : file, fileData, [{ name: "", extensions: [file.split(".").pop()] }]);
                }
              };
            })
          ).popup();
        }
        else {
          toxenapi.throwDesktopOnly();
        }
      }}><i className="fas fa-file-export"></i>&nbsp;Export Media File</Button>

      <br />

      <Button onClick={async () => {
        if (toxenapi.isDesktop()) {
          toxenapi.remote.Menu.buildFromTemplate(
            (await Toxen.filterSupportedFiles(Toxen.editingSong.dirname(), Toxen.getSupportedImageFiles())).map(file => {
              file = Toxen.editingSong.dirname(file);
              return {
                label: (Toxen.editingSong.backgroundFile() === file ? "(Current) " : "") + "Export " + file,
                click: async () => {
                  let fileData: Buffer;
                  try {
                    if (Settings.isRemote()) {
                      fileData = Buffer.from(await Toxen.fetch(file).then(res => res.arrayBuffer()));
                    }
                    else {
                      fileData = await toxenapi.fs.promises.readFile(file);
                    }
                  } catch (error) {
                    return Toxen.error(error);
                  }
                  System.exportFile(Settings.isRemote() ? toxenapi.path.basename(file) : file, fileData, [{ name: "", extensions: [file.split(".").pop()] }]);
                }
              };
            })
          ).popup();
        }
      }}><i className="fas fa-file-export"></i>&nbsp;Export Image File</Button>

      <Button onClick={async () => {
        if (toxenapi.isDesktop()) {
          toxenapi.remote.Menu.buildFromTemplate(
            (await Toxen.filterSupportedFiles(Toxen.editingSong.dirname(), Toxen.getSupportedSubtitleFiles())).map(file => {
              file = Toxen.editingSong.dirname(file);
              return {
                label: (Toxen.editingSong.subtitleFile() === file ? "(Current) " : "") + "Export " + file,
                click: async () => {
                  let fileData: Buffer;
                  try {
                    if (Settings.isRemote()) {
                      fileData = Buffer.from(await Toxen.fetch(file).then(res => res.arrayBuffer()));
                    }
                    else {
                      fileData = await toxenapi.fs.promises.readFile(file);
                    }
                  } catch (error) {
                    return Toxen.error(error);
                  }
                  toxenapi.remote.Menu.buildFromTemplate(
                    Toxen.getSupportedSubtitleFiles().map(ext => {
                      return {
                        label: (toxenapi.path.extname(file) === ext ? "(Current) " : "") + `Export as ${ext} format`,
                        click: () => {
                          fileData = Buffer.from(SubtitleParser.exportByExtension(SubtitleParser.parseByExtension(fileData.toString(), toxenapi.path.extname(file)), ext));
                          System.exportFile((Settings.isRemote() ? "" : toxenapi.path.dirname(file) + "/") + toxenapi.path.basename(file, toxenapi.path.extname(file)), fileData, [{ name: "", extensions: [ext.replace(/^\.+/g, "")] }]);
                        }
                      };
                    })
                  ).popup();
                }
              };
            })
          ).popup();
        }
      }}><i className="fas fa-file-export"></i>&nbsp;Export Subtitle File</Button>
    </div>
  )
}
