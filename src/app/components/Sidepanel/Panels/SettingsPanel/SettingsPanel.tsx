import { Checkbox, Tabs, TextInput, NumberInput, Select, Button, ColorInput, RangeSlider, Slider, Text } from "@mantine/core";
import { remote } from "electron";
import React from "react";
import Converter from "../../../../toxen/Converter";
import Settings, { VisualizerStyle } from "../../../../toxen/Settings";
import { Toxen } from "../../../../ToxenApp";
import TButton from "../../../Button/Button";
import Form from "../../../Form/Form";
import FormInput from "../../../Form/FormInputFields/FormInput";
import { OptionValues } from "../../../Form/FormInputFields/FormInputSelect";
import LoginForm from "../../../LoginForm/LoginForm";
import { PanelDirection } from "../../Sidepanel";
import "./SettingsPanel.scss";

interface SettingsPanelProps { }

export default function SettingsPanel(props: SettingsPanelProps) {
  return (
    <>
      <h1>Settings</h1>
      <Tabs onTabChange={(index, key) => window.localStorage.setItem("settings-tab-index", index.toString())} initialTab={parseInt(window.localStorage.getItem("settings-tab-index") ?? "0")}>
        <Tabs.Tab title="General" label="General">
          <h2>General</h2>
          {(() => {
            return (
              <>
                <Select
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
                  leftIcon={<i className="fas fa-folder" />}
                  onClick={() => {
                    // e.preventDefault();
                    let value = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
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
                <Button leftIcon={<i className="fas fa-folder-open" />} onClick={() => remote.shell.openPath(Settings.get("libraryDirectory"))}>
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
        </Tabs.Tab>

        <Tabs.Tab title="Sidepanel" label="Sidepanel">
          <h2>Sidepanel</h2>
          <Checkbox onClick={(e) => Settings.apply({ panelVerticalTransition: e.currentTarget.checked }, true)} defaultChecked={Settings.get("panelVerticalTransition")} name="panelVerticalTransition" label="Vertical Transition" />
          <br />
          <sup>Makes the Sidepanel appear from the bottom instead of the side.</sup>

          <Checkbox onClick={(e) => Settings.apply({ exposePanelIcons: e.currentTarget.checked }, true)} defaultChecked={Settings.get("exposePanelIcons")} name="exposePanelIcons" label="Expose Panel Icons" />
          <br />
          <sup>Exposes the icons when the panel is hidden. Only applies when Vertical Transition is off.</sup>

          <Select
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
                leftIcon={<i className="fas fa-folder" />}
                onClick={callback}>
                  Change background
                </Button>
                <Button
                leftIcon={<i className="fas fa-sync-alt" />}
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
        </Tabs.Tab>

        <Tabs.Tab title="Controls" label="Controls">
          <h2>Controls</h2>
          <Checkbox onClick={(e) => Settings.apply({ pauseWithClick: e.currentTarget.checked }, true)} defaultChecked={Settings.get("pauseWithClick")} name="pauseWithClick" label="Pause With Click" />
          <br />
          <sup>Pauses/Plays the song when you click on the background.</sup>
        </Tabs.Tab>

        <Tabs.Tab title="Window" label="Window">
          <h2>Window</h2>
          <Checkbox onClick={(e) => Settings.apply({ restoreWindowSize: e.currentTarget.checked }, true)} defaultChecked={Settings.get("restoreWindowSize")} name="restoreWindowSize" label="Restore Window Size On Startup" />
          <br />
          <sup>Saves and restores the window size from last session.</sup>
        </Tabs.Tab>

        <Tabs.Tab title="Visuals" label="Visuals">
          <h2>Visuals</h2>

          {/* Edit theme button */}
          {(() => {
            const btn = React.createRef<TButton & HTMLButtonElement>();
            return (
              <>

                <Select
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
                <Button leftIcon={<i className="fas fa-paint-brush" />} ref={btn} disabled={!Toxen.theme || true} onClick={() => {
                  Toxen.setMode("ThemeEditor");
                }}>Edit Theme</Button>
                <Button leftIcon={<i className="fas fa-paint-brush" />} onClick={() => {
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
                <Button leftIcon={<i className="fas fa-folder" />} onClick={callback}>
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
            This is how dark the background will appear.Can be dynamically changed by having <code>Dynamic Lighting</code> enabled.
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
        </Tabs.Tab>

        <Tabs.Tab title="Account" label="Account">
          <LoginForm />
        </Tabs.Tab>

        <Tabs.Tab title="Advanced" label="Advanced">
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
        </Tabs.Tab>
      </Tabs>
    </>
  )
}
