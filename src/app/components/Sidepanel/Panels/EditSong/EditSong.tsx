import { remote } from "electron";
import React from "react";
import Form from "../../../Form/Form";
import Converter from "../../../../toxen/Converter";
import JSONX from "../../../../toxen/JSONX";
import Settings, { VisualizerStyle } from "../../../../toxen/Settings";
import Song from "../../../../toxen/Song";
import SubtitleParser from "../../../../toxen/SubtitleParser";
import System from "../../../../toxen/System";
import { Toxen } from "../../../../ToxenApp";
import FormInput from "../../../Form/FormInputFields/FormInput";
import SidepanelSectionHeader from "../../SidepanelSectionHeader";
import "./EditSong.scss";
import fsp from "fs/promises";
import Path from "path";
import { Button, Checkbox, ColorInput, NumberInput, Select, TextInput } from "@mantine/core";
import ListInput from "../../../ListInput/ListInput";
import SelectAsync from "../../../SelectAsync/SelectAsync";
import ToxenInteractionMode from "../../../../toxen/ToxenInteractionMode";

interface EditSongProps { }

export default function EditSong(props: EditSongProps) {

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
        <Button onClick={() => remote.shell.openPath(Toxen.editingSong.dirname())} leftIcon={<i className="fas fa-folder-open"></i>}>
          Open music folder
        </Button>
        <Button onClick={() => Toxen.reloadSection()} leftIcon={<i className="fas fa-redo"></i>}>
          Reload data
        </Button>
        <Button className="advanced-only" onClick={() => Toxen.editingSong.copyUID()} leftIcon={<i className="fas fa-redo"></i>}>
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
          onChange={(v) => Toxen.editingSong.year = v}
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
        <br />
        <SelectAsync
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
          label="Background file"
          name="paths.background"
          defaultValue={Toxen.editingSong.paths.background}
          data={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedImageFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })}
          onChange={(v) => {
            Toxen.editingSong.paths.background = v;
            Toxen.editingSong.saveInfo();
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              Toxen.background.setBackground(current.backgroundFile());
            }
          }}
        />
        <SelectAsync
          label="Subtitle file"
          name="paths.subtitles"
          defaultValue={Toxen.editingSong.paths.subtitles}
          data={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedSubtitleFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })}
          onChange={(v) => {
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
            Toxen.editingSong.subtitleDelay = v;
          }}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <SelectAsync
          label="Storyboard file"
          name="paths.storyboard"
          defaultValue={Toxen.editingSong.paths.storyboard}
          data={(async () => {
            console.log(Toxen.editingSong.paths.storyboard);

            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedStoryboardFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })}
          onChange={(v) => {
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
          defaultValue={Toxen.editingSong.visualizerColor}
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
        <br />
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
        <br />
        <sup>Enable to force Rainbow mode onto this song. If disabled, but the global settings have it enabled, this will also be enabled.</sup>

        <Select
          label="Background pulsing"
          name="visualizerPulseBackground"
          defaultValue={Toxen.editingSong.visualizerPulseBackground}
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
        <br />
        <sup>Enables pulsing on the background image of a song. Pulse is based off music intensity and volume.</sup>

        <Select
          label="Visualizer Style"
          name="visualizerStyle"
          defaultValue={Toxen.editingSong.visualizerStyle}
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
          }}
        />
        <br />
        <sup>Select which style for the visualizer to use for this song.</sup>

        <Checkbox
          label="Floating Title"
          name="floatingTitle"
          defaultChecked={Toxen.editingSong.floatingTitle}
          onChange={v => {
            Toxen.editingSong.floatingTitle = v.currentTarget.checked;
            Toxen.editingSong.saveInfo();
          }}
        />
        <br />
        <sup>Gives the floating title an underline</sup>

        <TextInput
          label="Floating Title: Text"
          name="floatingTitleText"
          onChange={(v) => Toxen.editingSong.floatingTitleText = v.currentTarget.value}
          defaultValue={Toxen.editingSong.floatingTitleText}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        <br />
        <sup>Set the text for the floating title. (Defaults to song title, if empty)</sup>


        <Checkbox
          label="Floating Title: Underline"
          name="floatingTitleUnderline"
          defaultChecked={Toxen.editingSong.floatingTitleUnderline}
          onChange={v => {
            Toxen.editingSong.floatingTitleUnderline = v.currentTarget.checked;
            Toxen.editingSong.saveInfo();
          }}
        />
        <br />
        <sup>Enables the floating title for this song.</sup>
        
        <Select
          data={[
            { label: "Center", value: "center" },
            { label: "Top", value: "top" },
            { label: "Bottom", value: "bottom" },
            { label: "Left", value: "left" },
            { label: "Right", value: "right" },
            { label: "Top left", value: "top-left" },
            { label: "Top right", value: "top-right" },
            { label: "Bottom left", value: "bottom-left" },
            { label: "Bottom right", value: "bottom-right" },
          ]}
          label="Floating Title: Position"
          name="floatingTitlePosition"
          defaultValue={Toxen.editingSong.floatingTitlePosition}
          onChange={v => {
            Toxen.editingSong.floatingTitlePosition = v as typeof Toxen.editingSong.floatingTitlePosition;
            Toxen.editingSong.saveInfo();
          }}
        />
        <br />
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
        <br />
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
        <br />
        <sup>Enables the floating title to override the visualizer if necessary. Otherwise its just placed on top.</sup>
      </>
      <hr />
      <h2>Export options</h2>
      <Button onClick={async () => {
        remote.Menu.buildFromTemplate(
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
                    fileData = await fsp.readFile(file);
                  }
                } catch (error) {
                  return Toxen.error(error);
                }
                System.exportFile(Settings.isRemote() ? Path.basename(file) : file, fileData, [{ name: "", extensions: [file.split(".").pop()] }]);
              }
            };
          })
        ).popup();
      }}><i className="fas fa-file-export"></i>&nbsp;Export Media File</Button>

      <br />

      <Button onClick={async () => {
        remote.Menu.buildFromTemplate(
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
                    fileData = await fsp.readFile(file);
                  }
                } catch (error) {
                  return Toxen.error(error);
                }
                System.exportFile(Settings.isRemote() ? Path.basename(file) : file, fileData, [{ name: "", extensions: [file.split(".").pop()] }]);
              }
            };
          })
        ).popup();
      }}><i className="fas fa-file-export"></i>&nbsp;Export Image File</Button>

      <br />

      <Button onClick={async () => {
        remote.Menu.buildFromTemplate(
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
                    fileData = await fsp.readFile(file);
                  }
                } catch (error) {
                  return Toxen.error(error);
                }
                remote.Menu.buildFromTemplate(
                  Toxen.getSupportedSubtitleFiles().map(ext => {
                    return {
                      label: (Path.extname(file) === ext ? "(Current) " : "") + `Export as ${ext} format`,
                      click: () => {
                        fileData = Buffer.from(SubtitleParser.exportByExtension(SubtitleParser.parseByExtension(fileData.toString(), Path.extname(file)), ext));
                        System.exportFile((Settings.isRemote() ? "" : Path.dirname(file) + "/") + Path.basename(file, Path.extname(file)), fileData, [{ name: "", extensions: [ext.replace(/^\.+/g, "")] }]);
                      }
                    };
                  })
                ).popup();
              }
            };
          })
        ).popup();
      }}><i className="fas fa-file-export"></i>&nbsp;Export Subtitle File</Button>
    </>
  )
}
