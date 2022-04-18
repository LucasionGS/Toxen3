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

interface EditSongProps { }

export default function EditSong(props: EditSongProps) {
  return (
    <>
      <SidepanelSectionHeader>
        <h1>Edit music details</h1>
        <button className="tx-btn tx-btn-action" onClick={() => Toxen.editSongForm.submit()}>
          <i className="fas fa-save"></i>&nbsp;
          Save
        </button>
        <button className="tx-btn" onClick={() => remote.shell.openPath(Toxen.editingSong.dirname())}>
          <i className="fas fa-folder-open"></i>&nbsp;
          Open music folder
        </button>
        <button className="tx-btn" onClick={() => Toxen.reloadSection()}>
          <i className="fas fa-redo"></i>&nbsp;
          Reload data
        </button>
        <button className="tx-btn advanced-only" onClick={() => Toxen.editingSong.copyUID()}>
          {/* <i className="fas fa-redo"></i>&nbsp; */}
          Copy UUID
        </button>
      </SidepanelSectionHeader>
      <Form hideSubmit ref={ref => Toxen.editSongForm = ref} saveButtonText="Save song" onSubmit={async (_, formValues) => {
        let current = Song.getCurrent();
        let preBackground = Toxen.editingSong.paths.background;
        let preMedia = Toxen.editingSong.paths.media;
        let preSubtitles = Toxen.editingSong.paths.subtitles;
        let preStoryboard = Toxen.editingSong.paths.storyboard;
        let preVisualizerColor = Toxen.editingSong.visualizerColor;
        for (const key in formValues) {
          if (Object.prototype.hasOwnProperty.call(formValues, key)) {
            const value = formValues[key];
            JSONX.setObjectValue(Toxen.editingSong, key, value);

            // Special cases
            switch (key) {
              case "visualizerColor":
                if (Toxen.editingSong == current && current.visualizerColor !== preVisualizerColor) {
                  Toxen.setAllVisualColors(current.visualizerColor);
                }
                break;

              case "paths.background":
                if (Toxen.editingSong == current && current.paths.background !== preBackground) {
                  Toxen.background.setBackground(current.backgroundFile());
                }
                break;

              case "paths.media":
                if (Toxen.editingSong == current && current.paths.media !== preMedia) {
                  Toxen.musicPlayer.setSource(current.mediaFile(), true);
                }
                break;

              case "paths.subtitles":
                // Update subtitles
                if (Toxen.editingSong == current && current.paths.subtitles !== preSubtitles) {
                  current.applySubtitles();
                }
                break;

              case "paths.storyboard":
                // Update storyboard
                if (Toxen.editingSong == current && current.paths.storyboard !== preStoryboard) {
                  // Toxen.musicPlayer.setStoryboard(current.storyboardFile(), true); // Not yet implemented
                }
                break;

              default:
                break;
            }

            Toxen.background.storyboard.setSong(current);
          }
        }

        Toxen.editingSong.saveInfo().then(() => Toxen.reloadSection());
      }}>
        <h2>General information</h2>
        {/* <FormInput displayName="Location" name="paths.dirname*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" readOnly /> */}
        <FormInput displayName="Artist" name="artist*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
        <FormInput displayName="Title" name="title*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
        <FormInput displayName="Co-Artists" name="coArtists*array" getValueTemplateCallback={() => Toxen.editingSong} type="list" />
        <FormInput displayName="Album" name="album*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
        <FormInput displayName="Source" name="source*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
        <FormInput displayName="Language" name="language*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
        <FormInput displayName="Release Year" name="year*number" getValueTemplateCallback={() => Toxen.editingSong} type="number" />
        <FormInput displayName="Tags" name="tags*array" getValueTemplateCallback={() => Toxen.editingSong} type="list" />
        <br />
        <FormInput displayName="Media File" name="paths.media*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
          values={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedMediaFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })} />
        <FormInput nullable displayName="Background file" name="paths.background*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
          values={(async () => {
            let song = Toxen.editingSong;
            if (!song)
              return [];
            let path = song.dirname();

            let supported = Toxen.getSupportedImageFiles();
            return await Toxen.filterSupportedFiles(path, supported);
          })} />
        <FormInput nullable displayName="Subtitle file" name="paths.subtitles*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
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
        </FormInput>
        <FormInput nullable displayName="Storyboard file" name="paths.storyboard*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
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
        </FormInput>
        <hr />
        <h2>Song-specific visuals</h2>
        <FormInput nullable displayName="Visualizer Color" name="visualizerColor*string" getValueTemplateCallback={() => Toxen.editingSong} type="color"
          onChange={v => Toxen.setAllVisualColors(v)} />

        <FormInput type="checkbox" name="visualizerForceRainbowMode*boolean" displayName="Force Visualizer Rainbow Mode" getValueTemplateCallback={() => Toxen.editingSong} />
        <br />
        <sup>Enable to force Rainbow mode onto this song. If disabled, but the global settings have it enabled, this will also be enabled.</sup>

        <FormInput type="select" name="visualizerPulseBackground*string" displayName="Background pulsing" getValueTemplateCallback={() => Toxen.editingSong}>
          <option className="tx-form-field" value={""}>{"<Default>"}</option>
          <option className="tx-form-field" value={"pulse"}>Enabled</option>
          <option className="tx-form-field" value={"pulse-off"}>Disabled</option>
        </FormInput>
        <br />
        <sup>Enables pulsing on the background image of a song. Pulse is based off music intensity and volume.</sup>

        <FormInput type="select" name="visualizerStyle*string" displayName="Visualizer Style" getValueTemplateCallback={() => Toxen.editingSong}>
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
        </FormInput>
        <br />
        <sup>Select which style for the visualizer to use for this song.</sup>
      </Form>
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
