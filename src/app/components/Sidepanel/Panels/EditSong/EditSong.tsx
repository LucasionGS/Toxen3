// import * as remote from "@electron/remote";
import React from "react";
import Converter from "../../../../toxen/Converter";
import Settings, { VisualizerStyle } from "../../../../toxen/Settings";
import Song from "../../../../toxen/Song";
import SubtitleParser from "../../../../toxen/SubtitleParser";
import System from "../../../../toxen/System";
import { Toxen } from "../../../../ToxenApp";
import SidepanelSectionHeader from "../../SidepanelSectionHeader";
import "./EditSong.scss";
// import fsp from "fs/promises";
// import Path from "path";
import { Button, Checkbox, ColorInput, InputLabel, NumberInput, Radio, Select, Slider, TextInput } from "@mantine/core";
import ListInput from "../../../ListInput/ListInput";
import SelectAsync from "../../../SelectAsync/SelectAsync";
import { useModals } from "@mantine/modals";
import ScreenPositionSelector from "../../../ScreenPositionSelector/ScreenPositionSelector";
import { VisualizerStyleOptions } from "../SettingsPanel/SettingsPanel";
import { useForceUpdate } from "@mantine/hooks";

interface EditSongProps { }

export default function EditSong(props: EditSongProps) {
  const modals = useModals();
  const forceUpdate = useForceUpdate();

  function textInputSaveOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      Toxen.editingSong.saveInfo();
    }
  }

  return (
    <>
      <SidepanelSectionHeader>
        <h1>Edit music details</h1>
        {/* <button className="tx-btn tx-btn-action" onClick={() => Toxen.editSongForm.submit()}>
          <i className="fas fa-save"></i>&nbsp;
          Save
        </button> */}
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
      </SidepanelSectionHeader>
      <>
        <h2>General information</h2>
        <TextInput
          label="Artist"
          name="artist"
          onChange={(v) => Toxen.editingSong.artist = v.currentTarget.value}
          defaultValue={Toxen.editingSong.artist}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <TextInput
          label="Title"
          name="title"
          onChange={(v) => Toxen.editingSong.title = v.currentTarget.value}
          defaultValue={Toxen.editingSong.title}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <ListInput
          label="Co-Artists"
          name="coArtists"
          onChange={(list) => (Toxen.editingSong.coArtists = list) && Toxen.editingSong.saveInfo()}
          defaultValue={Toxen.editingSong.coArtists}
        />
        <TextInput
          label="Album"
          name="album"
          onChange={(v) => Toxen.editingSong.album = v.currentTarget.value}
          defaultValue={Toxen.editingSong.album}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <TextInput
          label="Genre"
          name="genre"
          onChange={(v) => Toxen.editingSong.genre = v.currentTarget.value}
          defaultValue={Toxen.editingSong.genre}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <TextInput
          label="Source"
          name="source"
          onChange={(v) => Toxen.editingSong.source = v.currentTarget.value}
          defaultValue={Toxen.editingSong.source}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <TextInput
          label="Language"
          name="language"
          onChange={(v) => Toxen.editingSong.language = v.currentTarget.value}
          defaultValue={Toxen.editingSong.language}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <NumberInput
          label="Release Year"
          name="year"
          onChange={(v) => Toxen.editingSong.year = +v}
          defaultValue={Toxen.editingSong.year}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <ListInput
          label="Tags"
          name="tags"
          onChange={(list) => (Toxen.editingSong.tags = list) && Toxen.editingSong.saveInfo()}
          defaultValue={Toxen.editingSong.tags}
        />
        <SelectAsync
          allowDeselect={false}
          label="Media File"
          name="paths.media"
          defaultValue={Toxen.editingSong.paths.media}
          data={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedMediaFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })}
          onChange={(v) => {
            Toxen.editingSong.paths.media = v;
            Toxen.editingSong.saveInfo();
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              Toxen.musicPlayer.setSource(current.mediaFile(), true);
            }
          }}
        />
        <SelectAsync
          allowDeselect={false}
          label="Background file"
          name="paths.background"
          defaultValue={Toxen.editingSong.paths.background}
          data={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedImageFiles();
            return [
              "<Empty>",
              ...(await Toxen.filterSupportedFiles(path, supported))
            ];
          })}
          onChange={(v) => {
            if (v === "<Empty>") {
              v = null;
            }
            Toxen.editingSong.paths.background = v;
            Toxen.editingSong.saveInfo();
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              Toxen.background.setBackground(current.backgroundFile() + "?h=" + current.hash);
            }
          }}
        />
        {Toxen.playlist && Toxen.playlist.songList.includes(Toxen.editingSong) ? (
          <>
            <Button.Group>
              <Button
                onClick={() => {
                  Toxen.playlist.promptSetBackground(modals, Toxen.editingSong);
                }}
              >
                <i className="fas fa-image"></i>&nbsp;
                Set playlist background
              </Button>
              {
                Toxen.playlist.songBackground && Toxen.playlist.songBackground[Toxen.editingSong.uid] ? (
                  <Button
                    onClick={() => {
                      Toxen.playlist.removeBackground(Toxen.editingSong);
                      Toxen.reloadSection();
                    }}
                    color="red"
                  >
                    <i className="fas fa-times"></i>&nbsp;
                    Remove playlist background
                  </Button>
                ) : null
              }
            </Button.Group>
            <sup>
              Set the background this song will use specifically when playlist "{Toxen.playlist.name}" is selected
            </sup>
          </>
        ) : null}

        <SelectAsync
          allowDeselect={false}
          label="Subtitle file"
          name="paths.subtitles"
          defaultValue={Toxen.editingSong.paths.subtitles}
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
            Toxen.editingSong.paths.subtitles = v;
            Toxen.editingSong.saveInfo();
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              current.applySubtitles();
            }
          }}
        />
        <NumberInput
          label="Subtitle Offset (ms)"
          name="subtitleDelay"
          defaultValue={Toxen.editingSong.subtitleDelay}
          onChange={(v) => {
            Toxen.editingSong.subtitleDelay = +v;
          }}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <SelectAsync
          allowDeselect={false}
          label="Storyboard file"
          name="paths.storyboard"
          defaultValue={Toxen.editingSong.paths.storyboard}
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
            Toxen.editingSong.paths.storyboard = v;
            Toxen.editingSong.saveInfo();
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
          defaultValue={Toxen.editingSong.visualizerColor ?? "<Default>"}
          onChange={(v) => {
            Toxen.editingSong.visualizerColor = v;
            // Toxen.editingSong.saveInfo();
            Toxen.setAllVisualColors(v);
          }}
          onBlur={() => {
            Toxen.setAllVisualColors(Toxen.editingSong.visualizerColor);
            Toxen.editingSong.saveInfo()
          }}
        />
        <Checkbox
          label="Force Visualizer Rainbow Mode"
          name="visualizerForceRainbowMode"
          defaultChecked={Toxen.editingSong.visualizerForceRainbowMode}
          onChange={(v) => {
            Toxen.editingSong.visualizerForceRainbowMode = v.currentTarget.checked;
            Toxen.editingSong.saveInfo();
            // Toxen.setAllVisualColors(Toxen.editingSong.visualizerColor);
          }}
        />
        <sup>Enable to force Rainbow mode onto this song. If disabled, but the global settings have it enabled, this will also be enabled.</sup>

        <Select
          allowDeselect={false}
          label="Background pulsing"
          name="visualizerPulseBackground"
          defaultValue={Toxen.editingSong.visualizerPulseBackground ?? ""}
          data={[
            { value: "", label: "<Default>" },
            { value: "pulse", label: "Enabled" },
            { value: "pulse-off", label: "Disabled" }
          ]}
          onChange={(v) => {
            Toxen.editingSong.visualizerPulseBackground = v as any;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Enables pulsing on the background image of a song. Pulse is based off music intensity and volume.</sup>

        <InputLabel>Background Dim</InputLabel>
        <Slider
          defaultValue={Toxen.editingSong.backgroundDim ?? -1}
          onChange={(v) => {
            Toxen.editingSong.backgroundDim = v === -1 ? null : v;
          }}
          onChangeEnd={(v) => {
            Toxen.editingSong.backgroundDim = v === -1 ? null : v;
            Toxen.editingSong.saveInfo();
          }}
          label={(value) => value === -1 ? "Default" : `${value}%`}
          min={-1}
          max={100}
        />
        <sup>Set the background dim level for this song. Default uses the global setting.</sup>

        <Select
          allowDeselect={false}
          label="Visualizer Style"
          name="visualizerStyle"
          defaultValue={Toxen.editingSong.visualizerStyle ?? ""}
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
            Toxen.editingSong.visualizerStyle = v as any;
            Toxen.editingSong.saveInfo();
            forceUpdate();
          }}
        />
        <sup>Select which style for the visualizer to use for this song.</sup>

        {/* Specific VS settings */}
        <VisualizerStyleOptions
          style={Toxen.editingSong.visualizerStyle}
          allOptions={Toxen.editingSong.visualizerStyleOptions}
          onSave={(allOptions) => Toxen.editingSong.visualizerStyleOptions = allOptions}
          onSaveEnd={(allOptions) => {
            Toxen.editingSong.visualizerStyleOptions = allOptions;
            Toxen.editingSong.saveInfo();
            forceUpdate();
          }}
        />

        {/* Visualizer Glow */}
        <Select
          allowDeselect={false}
          label="Visualizer Glow"
          name="visualizerGlow"
          defaultValue={Toxen.editingSong.visualizerGlow ? "enabled" : Toxen.editingSong.visualizerGlow === false ? "disabled" : ""}
          data={[
            { value: "", label: "<Default>" },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" }
          ]}
          onChange={(v) => {
            Toxen.editingSong.visualizerGlow = v === "enabled" ? true : v === "disabled" ? false : null;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Enables a glow effect on the visualizer for this song.</sup>

        {/* Star Rush Effect */}
        <Select
          allowDeselect={false}
          label="Star Rush Effect"
          name="starRushEffect"
          defaultValue={Toxen.editingSong.starRushEffect ? "enabled" : Toxen.editingSong.starRushEffect === false ? "disabled" : ""}
          data={[
            { value: "", label: "<Default>" },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" }
          ]}
          onChange={(v) => {
            Toxen.editingSong.starRushEffect = v === "enabled" ? true : v === "disabled" ? false : null;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Enables a particle effect where white stars/snow shoot outward from the center, accelerating as they move.</sup>

        <Select
          allowDeselect={false}
          label="Star Rush Intensity"
          name="starRushIntensity"
          defaultValue={Toxen.editingSong.starRushIntensity?.toString() || ""}
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
            Toxen.editingSong.starRushIntensity = v ? parseFloat(v) : null;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Controls the intensity of the star rush effect for this song.</sup>


        <Checkbox
          label="Floating Title"
          name="floatingTitle"
          defaultChecked={Toxen.editingSong.floatingTitle}
          onChange={v => {
            Toxen.editingSong.floatingTitle = v.currentTarget.checked;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Gives the floating title an underline</sup>

        <TextInput
          label="Floating Title: Text"
          name="floatingTitleText"
          placeholder="<Default>"
          onChange={(v) => Toxen.editingSong.floatingTitleText = v.currentTarget.value}
          defaultValue={Toxen.editingSong.floatingTitleText}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <sup>Set the text for the floating title. (Defaults to song title, if empty)</sup>

        {/* useFloatingTitleSubtitles */}
        <Checkbox
          label="Floating Title: Use Subtitles"
          name="useFloatingTitleSubtitles"
          defaultChecked={Toxen.editingSong.useFloatingTitleSubtitles}
          onChange={v => {
            Toxen.editingSong.useFloatingTitleSubtitles = v.currentTarget.checked;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Use the subtitles if selected, as the text for the floating title. This overrides the text field.</sup>

        <Checkbox
          label="Floating Title: Underline"
          name="floatingTitleUnderline"
          defaultChecked={Toxen.editingSong.floatingTitleUnderline}
          onChange={v => {
            Toxen.editingSong.floatingTitleUnderline = v.currentTarget.checked;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Enables the floating title for this song.</sup>
        <ScreenPositionSelector
          onChange={v => {
            Toxen.editingSong.floatingTitlePosition = v === "" ? null : v;
            Toxen.editingSong.saveInfo();
          }}
          defaultValue={Toxen.editingSong.floatingTitlePosition || ""}
          label="Floating Title: Position"
          name="floatingTitlePosition"
          deselectable
          showText
        />
        <sup>Set the position of the floating title.</sup>

        <Checkbox
          label="Floating Title: Reactive"
          name="floatingTitleReactive"
          defaultChecked={Toxen.editingSong.floatingTitleReactive}
          onChange={v => {
            Toxen.editingSong.floatingTitleReactive = v.currentTarget.checked;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Enables the floating title to react to the music.</sup>

        <Checkbox
          label="Floating Title: Override Visualizer"
          name="floatingTitleOverrideVisualizer"
          defaultChecked={Toxen.editingSong.floatingTitleOverrideVisualizer}
          onChange={v => {
            Toxen.editingSong.floatingTitleOverrideVisualizer = v.currentTarget.checked;
            Toxen.editingSong.saveInfo();
          }}
        />
        <sup>Enables the floating title to override the visualizer if necessary. Otherwise its just placed on top.</sup>
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
                      // @ts-expect-error
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
                      // @ts-expect-error
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
                      // @ts-expect-error
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
    </>
  )
}
