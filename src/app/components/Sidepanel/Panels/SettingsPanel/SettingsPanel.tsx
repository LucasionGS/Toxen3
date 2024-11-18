import { Checkbox, Tabs, TextInput, NumberInput, Select, Button, ColorInput, RangeSlider, Slider, Text } from "@mantine/core";
// import * as remote from "@electron/remote";
// import type { EntertainmentArea } from "hue-sync";
import React, { useEffect } from "react";
import Converter from "../../../../toxen/Converter";
// import HueManager from "../../../../toxen/philipshue/HueManager";
import Settings, { VisualizerStyle } from "../../../../toxen/Settings";
import Song from "../../../../toxen/Song";
import { Toxen } from "../../../../ToxenApp";
import TButton from "../../../Button/Button";
import { PanelDirection } from "../../Sidepanel";
import "./SettingsPanel.scss";

interface SettingsPanelProps { }

export default function SettingsPanel(props: SettingsPanelProps) {
  return (
    <>
      <h1>Settings</h1>
      <Tabs onChange={(key) => window.localStorage.setItem("settings-tab-index", key)} defaultValue={window.localStorage.getItem("settings-tab-index") || "general"}>
        <Tabs.List>
          <Tabs.Tab value="General">
            General
          </Tabs.Tab>
          <Tabs.Tab value="Sidepanel">
            Sidepanel
          </Tabs.Tab>
          <Tabs.Tab value="Controls">
            Controls
          </Tabs.Tab>
          <Tabs.Tab value="Window">
            Window
          </Tabs.Tab>
          <Tabs.Tab value="Visuals">
            Visuals
          </Tabs.Tab>
          <Tabs.Tab value="Account">
            Account
          </Tabs.Tab>
          <Tabs.Tab value="Advanced">
            Advanced
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="General">
          <h2>General</h2>
          {(() => {
            if (!toxenapi.isDesktop()) {
              return null;
            }
            
            return (
              <>
                <Select
                  allowDeselect={false}
                  onChange={(value) => Settings.apply({ isRemote: value === "local" ? false : true }, true)}
                  defaultValue={Settings.get("isRemote") ? "remote" : "local"}
                  name="isRemote"
                  label="Music Library"
                  data={[
                    {
                      value: "local",
                      label: Settings.get("libraryDirectory")
                    },
                    Settings.getUser()?.premium ? {
                      value: "remote",
                      label: "Remote Library"
                    } : null
                  ].filter(x => x)}
                />
                <Button
                  leftSection={<i className="fas fa-folder" />}
                  onClick={() => {
                    // e.preventDefault();
                    let value = toxenapi.remote.dialog.showOpenDialogSync(toxenapi.remote.getCurrentWindow(), {
                      properties: [
                        'openDirectory'
                      ]
                    });

                    if (!value || value.length == 0)
                      return;

                    // Settings.set("libraryDirectory", value[0]);
                    // Settings.save({
                    //   suppressNotification: true
                    // })
                    Settings.apply({ libraryDirectory: value[0] }, true).then(() => {
                      Toxen.sidePanel.reloadSection();
                      Toxen.loadSongs();
                    });
                  }}>
                  &nbsp;Change Music Folder
                </Button>
                <Button leftSection={<i className="fas fa-folder-open" />} onClick={() => toxenapi.remote.shell.openPath(Settings.get("libraryDirectory"))}>
                  &nbsp;Open Music Folder
                </Button>
                <br />
                <br />
                <sup>
                  Music Library to fetch songs from.<br />
                </sup>
              </>
            );
          })()}
        </Tabs.Panel>

        <Tabs.Panel value="Sidepanel">
          <h2>Sidepanel</h2>
          <Checkbox onClick={(e) => Settings.apply({ panelVerticalTransition: e.currentTarget.checked }, true)} defaultChecked={Settings.get("panelVerticalTransition")} name="panelVerticalTransition" label="Vertical Transition" />
          <br />
          <sup>Makes the Sidepanel appear from the bottom instead of the side.</sup>

          <Checkbox onClick={(e) => Settings.apply({ exposePanelIcons: e.currentTarget.checked }, true)} defaultChecked={Settings.get("exposePanelIcons")} name="exposePanelIcons" label="Expose Panel Icons" />
          <br />
          <sup>Exposes the icons when the panel is hidden. Only applies when Vertical Transition is off.</sup>

          <Select
            allowDeselect={false}
            onChange={(value) => Settings.apply({ panelDirection: value as PanelDirection }, true)}
            defaultValue={Settings.get("panelDirection")}
            name="panelDirection"
            label="Panel Direction"
            data={[
              {
                value: "left",
                label: "Left"
              },
              {
                value: "right",
                label: "Right"
              }
            ]}
          />
          <br />
          <sup>Choose which side the sidepanel should appear on.</sup>

          {(function () {
            const [bg, setBg] = React.useState(Settings.get("sidepanelBackground"));
            const callback = async () => {
              const bg = await Settings.selectFile({
                filters: [
                  { name: "Images", extensions: Toxen.getSupportedImageFiles().map(f => f.replace(".", "")) }
                ]
              });

              if (bg) {
                Settings.apply({ sidepanelBackground: bg }, true);
                setBg(bg);
              }
            };
            return (
              <>
                <TextInput disabled onClick={callback} value={bg} name="sidepanelBackground" label="Sidepanel Background" />
                <Button
                  leftSection={<i className="fas fa-folder" />}
                  onClick={callback}>
                  Change background
                </Button>
                <Button
                  leftSection={<i className="fas fa-sync-alt" />}
                  color="red"
                  onClick={() => {
                    Settings.apply({ sidepanelBackground: null }, true);
                    setBg("");
                  }}>
                  Reset background
                </Button>
                <br />
                <br />
                <sup>
                  Set a background for the sidepanel.
                </sup>
                <br />
              </>
            );
          })()}
        </Tabs.Panel>

        <Tabs.Panel value="Controls">
          <h2>Controls</h2>
          <Checkbox onClick={(e) => Settings.apply({ pauseWithClick: e.currentTarget.checked }, true)} defaultChecked={Settings.get("pauseWithClick")} name="pauseWithClick" label="Pause With Click" />
          <br />
          <sup>Pauses/Plays the song when you click on the background.</sup>
        </Tabs.Panel>

        <Tabs.Panel value="Window">
          <h2>Window</h2>
          <Checkbox onClick={(e) => Settings.apply({ restoreWindowSize: e.currentTarget.checked }, true)} defaultChecked={Settings.get("restoreWindowSize")} name="restoreWindowSize" label="Restore Window Size On Startup" />
          <br />
          <sup>Saves and restores the window size from last session.</sup>
        </Tabs.Panel>

        <Tabs.Panel value="Visuals">
          <h2>Visuals</h2>

          {/* Edit theme button */}
          {(() => {
            const btn = React.createRef<TButton & HTMLButtonElement>();
            return (
              <>

                <Select
                  allowDeselect={false}
                  onChange={(value) => {
                    Toxen.setThemeByName(value as string);
                  }}
                  defaultValue={Toxen.theme?.name ?? ""}
                  name="theme"
                  label="Theme"
                  data={[
                    {
                      value: "",
                      label: "<Default>"
                    },
                    ...Toxen.themes.map(t => ({
                      value: t.name,
                      label: t.getDisplayName()
                    }))
                  ]}
                />
                <br />
                <sup>Select the theme you want to use.</sup>
                <Button leftSection={<i className="fas fa-paint-brush" />} ref={btn} disabled={!Toxen.theme || true} onClick={() => {
                  Toxen.setMode("ThemeEditor");
                }}>Edit Theme</Button>
                <Button leftSection={<i className="fas fa-paint-brush" />} onClick={() => {
                  // e.preventDefault();
                  Toxen.loadThemes();
                }}>Reload Theme</Button>
              </>
            );
          })()}

          <br />
          <br />
          {(function () {
            const [bg, setBg] = React.useState(Settings.get("defaultBackground"));
            const callback = async () => {
              const bg = await Settings.selectFile({
                filters: [
                  { name: "Images", extensions: Toxen.getSupportedImageFiles().map(f => f.replace(".", "")) }
                ]
              });

              if (bg) {
                Settings.apply({ defaultBackground: bg }, true);
                setBg(bg);
              }
            };
            return (
              <>
                <TextInput disabled onClick={callback} value={bg} name="defaultBackground" label="Default Background" />
                <Button leftSection={<i className="fas fa-folder" />} onClick={callback}>
                  Change default background
                </Button>
                <br />
                <br />
                <sup>
                  Set a default background which will apply for songs without one.<br />
                  Click the button <code>Change default background</code> to open a select prompt.
                  You can also set a background for a specific song by clicking the song in the song list.<br />
                </sup>
                <br />
              </>
            );
          })()}

          <Text>Background Dim</Text>
          <Slider onChange={v => Settings.set("backgroundDim", v)} onChangeEnd={v => Settings.apply({ backgroundDim: v }, true)} defaultValue={Settings.get("backgroundDim")} name="backgroundDim" label={(value) => `${value}%`} min={0} max={100} />
          <br />
          <sup>
            Set the base background dim level between <code>0-100%</code>.<br />
            This is how dark the background will appear. Can be dynamically changed by having <code>Dynamic Lighting</code> enabled.
          </sup>
          <br />

          <Text>Visualizer Intensity</Text>
          <Slider onChange={v => Settings.set("visualizerIntensity", v / 100)} onChangeEnd={v => Settings.apply({ visualizerIntensity: v / 100 }, true)} defaultValue={(Settings.get("visualizerIntensity") * 100) || 100} name="visualizerIntensity" label={(value) => `${value}%`} min={50} max={200} />
          <br />
          <sup>
            Set the base intensity level of the visualizer. <code>0-100%</code>.<br />
            Default is <code>100%</code><br />
          </sup>
          <br />

          <Checkbox onClick={(e) => Settings.apply({ visualizerNormalize: e.currentTarget.checked }, true)} defaultChecked={Settings.get("visualizerNormalize")} name="visualizerNormalize" label="Normalize Visualizer" />
          <br />
          <sup>
            Normalize the visualizer to the intensity level of the song. This will make the visuals more smoothed out and less intense.
          </sup>

          <Text>Visualizer Size</Text>
          <Slider onChange={v => Settings.set("fftSize", v)} onChangeEnd={v => Settings.apply({ fftSize: v }, true)} defaultValue={Settings.get("fftSize") || 6} name="fftSize" label={(v) => v} min={1} max={10} />
          <br />
          <sup>
            Set the base size visualizer. <code>1-10</code>.<br />
            This can have a high impact on performance. Higher numbers can cause major slow-downs.<br />
            Default is <code>6</code><br />
          </sup>
          <br />

          <ColorInput onChange={(c) => Settings.apply({ visualizerColor: c }, true)} defaultValue={Settings.get("visualizerColor")} name="visualizerColor" label="Visualizer Color" />
          <br />
          <sup>Default color for the visualizer if a song specific isn't set.</sup>
          <br />

          <Checkbox onClick={(e) => Settings.apply({ visualizerRainbowMode: e.currentTarget.checked }, true)} defaultChecked={Settings.get("visualizerRainbowMode")} name="visualizerRainbowMode" label="Rainbow Mode" />
          <br />
          <sup>
            Override the visualizer color to show a colorful rainbow visualizer.
            <br />
            <code>⚠ Flashing colors ⚠</code>
          </sup>
          <br />

          <Checkbox onClick={(e) => Settings.apply({ backgroundDynamicLighting: e.currentTarget.checked }, true)} defaultChecked={Settings.get("backgroundDynamicLighting")} name="backgroundDynamicLighting" label="Dynamic Lighting" />
          <br />
          <sup>
            Enables dynamic lighting in on the background image on songs.
            <br />
            <code>⚠ Flashing colors ⚠</code>
          </sup>
          <br />

          <Checkbox onClick={(e) => Settings.apply({ visualizerPulseBackground: e.currentTarget.checked }, true)} defaultChecked={Settings.get("visualizerPulseBackground")} name="visualizerPulseBackground" label="Background pulsing" />
          <br />
          <sup>
            Enables pulsing on the background image of a song. Pulse is based off music intensity and volume.
          </sup>
          <br />
          <Select
            allowDeselect={false}
            onChange={(value) => {
              Settings.apply({ visualizerStyle: value as VisualizerStyle }, true);
            }}
            defaultValue={Settings.get("visualizerStyle")}
            name="visualizerStyle"
            label="Visualizer Style"
            data={[
              {
                value: "",
                label: "<Default>"
              },
              ...Object.keys(VisualizerStyle).map(key => ({
                value: (VisualizerStyle as any)[key],
                label: Converter.camelCaseToSpacing(key)
              }))
            ]}
          />
          <br />
          <sup>Select which style for the visualizer to use.</sup>
          <br />
        </Tabs.Panel>

        {/* <Tabs.Panel value="Account">
          <LoginForm />
        </Tabs.Panel> */}

        <Tabs.Panel value="Advanced">
          <h2>Advanced settings</h2>
          <Checkbox onClick={(e) => Settings.apply({ showAdvancedSettings: e.currentTarget.checked }, true)} defaultChecked={Settings.get("showAdvancedSettings")} name="showAdvancedSettings" label="Show Advanced UI" />
          <br />
          <sup>
            Enables the viewing of advanced settings and UI elements. This will display a few more buttons around in Toxen,
            along with more technical settings that users usually don't have to worry about.
          </sup>

          <Checkbox onClick={(e) => Settings.apply({ discordPresence: e.currentTarget.checked }, true)} defaultChecked={Settings.get("discordPresence")} name="discordPresence" label="Discord Presence" />
          <br />
          <sup>Enables Discord presence integration. It will show you are using Toxen in your status.</sup>

          <Checkbox onClick={(e) => Settings.apply({ discordPresenceDetailed: e.currentTarget.checked }, true)} defaultChecked={Settings.get("discordPresenceDetailed")} name="discordPresenceDetailed" label="Discord Presence: Show details" />
          <br />
          <sup>Enables a detailed activity status in Discord presence. It'll show what song you are listening to, and how far into it you are.</sup>

          <Checkbox onClick={(e) => Settings.apply({ progressBarShowMs: e.currentTarget.checked }, true)} defaultChecked={Settings.get("progressBarShowMs")} name="progressBarShowMs" label="Progress Bar: Show milliseconds" />
          <br />
          <sup>Enables showing the milliseconds in the progress bar.</sup>

          <Button onClick={() => {
            const songs = Toxen.getAllSongs();

            Song.convertAllNecessary(songs).then((changedSongs) => {
              Toxen.updateSongPanels();
              Toxen.notify({
                title: "Converted all songs",
                content: `Converted ${changedSongs} songs to the new format.`
              })
            });
          }} color="green">
            Convert all necessary audio files
          </Button>

          <br />
          {/* Hue Settings */}
          {/* <HueSettings /> */}
        </Tabs.Panel>
      </Tabs>
    </>
  )
}

/**
 * Hue settings
 * DISABLED FOR NOW
 */
// function HueSettings() {
//   const [areas, setAreas] = React.useState<EntertainmentArea[]>(null);
//   const [selectedArea, _setSelectedArea] = React.useState<EntertainmentArea>(HueManager.currentArea ?? null);
//   function setSelectedArea(area: EntertainmentArea) {
//     _setSelectedArea(area);
//     HueManager.setCurrentArea(area);
//     Settings.apply({ hueEntertainmentAreaId: area.id }, true);
//   }

//   function fetchAreas() {
//     if (HueManager.instance) {
//       HueManager.instance?.getEntertainmentAreas().then((areas) => {
//         setAreas(areas);
//         const selectedArea = areas.find(a => a.id === Settings.get("hueEntertainmentAreaId"));
//         if (selectedArea) setSelectedArea(selectedArea);
//       });
//     }
//     else {
//       // Give a popup idk
//     }
//   }

//   useEffect(() => {
//     if (HueManager.instance) {
//       fetchAreas();
//     }
//   }, []);

//   return (
//     <>
//       <h2>Philip Hue Settings</h2>
//       <Checkbox onClick={(e) => {
//         Settings.apply({ hueEnabled: e.currentTarget.checked }, true);
//         if (e.currentTarget.checked) {
//           HueManager.init({
//             ip: Settings.get("hueIp"),
//             username: Settings.get("hueUsername"),
//             clientkey: Settings.get("hueClientkey")
//           });
//           HueManager.start().then(() => Toxen.log("Hue connected", 1000)).catch((error) => Toxen.error(error.message));
//         } else {
//           HueManager.dispose();
//         }
//       }} defaultChecked={Settings.get("hueEnabled")} name="hueEnabled" label="Enable Hue" />
//       <br />
//       <sup>
//         Enables Hue integration. This will allow you to control your Hue lights with Toxen storyboards.
//         <code>⚠ Experimental, stability is <b>not</b> guaranteed ⚠</code>
//       </sup>
      

//       {/* hueBridgeIp */}
//       <TextInput onChange={(e) => Settings.apply({ hueBridgeIp: e.currentTarget.value }, true)} defaultValue={Settings.get("hueBridgeIp")} name="hueBridgeIp" label="Hue Bridge IP" />
//       <br />
//       <sup>Set the IP address of your Hue bridge.</sup>

//       {/* hueUsername */}
//       <TextInput onChange={(e) => Settings.apply({ hueUsername: e.currentTarget.value }, true)} defaultValue={Settings.get("hueUsername")} name="hueUsername" label="Hue Username" />
//       <br />
//       <sup>Set the username of your Hue bridge.</sup>

//       {/* hueClientkey */}
//       <TextInput onChange={(e) => Settings.apply({ hueClientkey: e.currentTarget.value }, true)} defaultValue={Settings.get("hueClientkey")} name="hueClientkey" label="Hue Client Key" />
//       <br />
//       <sup>Set the client key of your Hue bridge.</sup>

//       {/* Light entertainment areas */}
//       {/* <Carousel slideSize="70%" height={200} slideGap="md">
        
//       </Carousel> */}
//       <div>
//         {
//           areas?.map((area) => (
//             <Button onClick={() => setSelectedArea(area)} color={selectedArea?.id === area.id ? "green" : "gray"}>
//               {area.name}
//             </Button>
//           ))
//         }
//       </div>
//       <br />
//       <Button onClick={() => {
//         fetchAreas();
//       }} color="green">
//         Fetch lights
//       </Button>
//       <br />
//       <br />
//       <sup>Fetches the lights from your Hue bridge. This should be done automatically when Toxen starts.</sup>
//     </>
//   );
// }