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
        {/* <FormInput displayName="Location" name="paths.dirname*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" readOnly /> */}
        {/* <FormInput displayName="Artist" name="artist*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" /> */}
        <TextInput
          label="Artist"
          name="artist"
          onChange={(v) => Toxen.editingSong.artist = v.currentTarget.value}
          defaultValue={Toxen.editingSong.artist}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        {/* <FormInput displayName="Title" name="title*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" /> */}
        <TextInput
          label="Title"
          name="title"
          onChange={(v) => Toxen.editingSong.title = v.currentTarget.value}
          defaultValue={Toxen.editingSong.title}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        {/* <FormInput displayName="Co-Artists" name="coArtists*array" getValueTemplateCallback={() => Toxen.editingSong} type="list" /> */}
        <ListInput
          label="Co-Artists"
          name="coArtists"
          onChange={(list) => (Toxen.editingSong.coArtists = list) && Toxen.editingSong.saveInfo()}
          defaultValue={Toxen.editingSong.coArtists}
        />
        {/* <FormInput displayName="Album" name="album*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" /> */}
        <TextInput
          label="Album"
          name="album"
          onChange={(v) => Toxen.editingSong.album = v.currentTarget.value}
          defaultValue={Toxen.editingSong.album}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        {/* <FormInput displayName="Source" name="source*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" /> */}
        <TextInput
          label="Source"
          name="source"
          onChange={(v) => Toxen.editingSong.source = v.currentTarget.value}
          defaultValue={Toxen.editingSong.source}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        {/* <FormInput displayName="Language" name="language*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" /> */}
        <TextInput
          label="Language"
          name="language"
          onChange={(v) => Toxen.editingSong.language = v.currentTarget.value}
          defaultValue={Toxen.editingSong.language}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        {/* <FormInput displayName="Release Year" name="year*number" getValueTemplateCallback={() => Toxen.editingSong} type="number" /> */}
        <NumberInput
          label="Release Year"
          name="year"
          onChange={(v) => Toxen.editingSong.year = v}
          defaultValue={Toxen.editingSong.year}
          onBlur={() => Toxen.editingSong.saveInfo()}
          onKeyDown={textInputSaveOnEnter}
        />
        {/* <FormInput displayName="Tags" name="tags*array" getValueTemplateCallback={() => Toxen.editingSong} type="list" /> */}
        <ListInput
          label="Tags"
          name="tags"
          onChange={(list) => (Toxen.editingSong.tags = list) && Toxen.editingSong.saveInfo()}
          defaultValue={Toxen.editingSong.tags}
        />
        <br />
        {/* <FormInput displayName="Media File" name="paths.media*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
          values={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedMediaFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })} /> */}
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
        {/* <FormInput nullable displayName="Background file" name="paths.background*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
          values={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedImageFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })} /> */}
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
        {/* <FormInput nullable displayName="Subtitle file" name="paths.subtitles*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
          values={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedSubtitleFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })}
        >
          <br />
          <FormInput displayName="Subtitle Offset (ms)" name="subtitleDelay*number" getValueTemplateCallback={() => Toxen.editingSong} type="number" />
        </FormInput> */}
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
        {/* <FormInput nullable displayName="Storyboard file" name="paths.storyboard*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
          values={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedStoryboardFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })}
        >
          <button className="tx-btn tx-btn-action" onClick={() => {
            if (!Toxen.editingSong) {
              return Toxen.error("No song has been selected for editing.", 5000);
            }

            Toxen.setMode("StoryboardEditor");
          }}>Edit Storyboard</button>
        </FormInput> */}
        <SelectAsync
          label="Storyboard file"
          name="paths.storyboard"
          defaultValue={Toxen.editingSong.paths.storyboard}
          data={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedStoryboardFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })}
          onChange={(v) => {
            Toxen.editingSong.paths.storyboard = v;
            Toxen.editingSong.saveInfo();
            let current = Song.getCurrent();
            if (Toxen.editingSong == current) {
              // Not implemented yet
            }
          }}
        />
        <hr />
        <h2>Song-specific visuals</h2>
        {/* <FormInput nullable displayName="Visualizer Color" name="visualizerColor*string" getValueTemplateCallback={() => Toxen.editingSong} type="color"
          onChange={v => Toxen.setAllVisualColors(v)} /> */}
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
        {/* <FormInput type="checkbox" name="visualizerForceRainbowMode*boolean" displayName="Force Visualizer Rainbow Mode" getValueTemplateCallback={() => Toxen.editingSong} /> */}
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

        {/* <FormInput type="select" name="visualizerPulseBackground*string" displayName="Background pulsing" getValueTemplateCallback={() => Toxen.editingSong}>
          <option className="tx-form-field" value={""}>{"<Default>"}</option>
          <option className="tx-form-field" value={"pulse"}>Enabled</option>
          <option className="tx-form-field" value={"pulse-off"}>Disabled</option>
        </FormInput> */}
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

        {/* <FormInput type="select" name="visualizerStyle*string" displayName="Visualizer Style" getValueTemplateCallback={() => Toxen.editingSong}>
          {(() => {
            let objs: JSX.Element[] = [
              <option key={null} className="tx-form-field" value={""}>{"<Default>"}</option>
            ];
            for (const key in VisualizerStyle) {
              if (Object.prototype.hasOwnProperty.call(VisualizerStyle, key)) {
                const v = (VisualizerStyle as any)[key];
                objs.push(<option key={key} className="tx-form-field" value={v}>{Converter.camelCaseToSpacing(key)}</option>);
              }
            }
            return objs;
          })()}
        </FormInput> */}
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
      </>
      <hr />
      <h2>Export options</h2>
      <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
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
      }}><i className="fas fa-file-export"></i>&nbsp;Export Media File</button>

      <br />

      <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
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
      }}><i className="fas fa-file-export"></i>&nbsp;Export Image File</button>

      <br />

      <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
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
      }}><i className="fas fa-file-export"></i>&nbsp;Export Subtitle File</button>
    </>
  )
}
