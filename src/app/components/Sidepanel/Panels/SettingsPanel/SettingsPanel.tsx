import { Checkbox, Tabs, TextInput, NumberInput, Select, Button, ColorInput, RangeSlider, Slider, Text, Alert } from "@mantine/core";
// import * as remote from "@electron/remote";
import type { HueEntertainmentArea } from "../../../../toxen/philipshue/HueAPI";
import React, { useEffect } from "react";
import Converter from "../../../../toxen/Converter";
import HueManager from "../../../../toxen/philipshue/HueManager";
import Settings, { ISettings, VisualizerStyle, visualizerStyleOptions } from "../../../../toxen/Settings";
import Song from "../../../../toxen/Song";
import { Toxen } from "../../../../ToxenApp";
import TButton from "../../../Button/Button";
import { PanelDirection } from "../../Sidepanel";
import SidepanelSectionGroup from "../../SidepanelSectionGroup";
import "./SettingsPanel.scss";
import { useForceUpdate } from "@mantine/hooks";
import LoginForm from "../../../LoginForm/LoginForm";
import User from "../../../../toxen/User";
import { bytesToString } from "../../../AppBar/AppBar";
import { Tab } from "react-bootstrap";

interface SettingsPanelProps { }

export default function SettingsPanel(props: SettingsPanelProps) {
  const forceUpdate = useForceUpdate();
  const user = User.getCurrentUser();
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
          <Tabs.Tab value="Performance">
            Performance
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
              return (
                <Alert color="yellow">
                  Not all settings are available on Toxen Web
                </Alert>
              );
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
                <sup>
                  Music Library to fetch songs from.
                </sup>
              </>
            );
          })()}
        </Tabs.Panel>

        <Tabs.Panel value="Sidepanel">
          <h2>Sidepanel</h2>
          <Checkbox onClick={(e) => Settings.apply({ panelVerticalTransition: e.currentTarget.checked }, true)} defaultChecked={Settings.get("panelVerticalTransition")} name="panelVerticalTransition" label="Vertical Transition" />
          <sup>Makes the Sidepanel appear from the bottom instead of the side.</sup>

          <Checkbox onClick={(e) => Settings.apply({ exposePanelIcons: e.currentTarget.checked }, true)} defaultChecked={Settings.get("exposePanelIcons")} name="exposePanelIcons" label="Expose Panel Icons" />
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
                <sup>
                  Set a background for the sidepanel.
                </sup>
              </>
            );
          })()}
        </Tabs.Panel>

        <Tabs.Panel value="Controls">
          <h2>Controls</h2>
          <Checkbox onClick={(e) => Settings.apply({ pauseWithClick: e.currentTarget.checked }, true)} defaultChecked={Settings.get("pauseWithClick")} name="pauseWithClick" label="Pause With Click" />
          <sup>Pauses/Plays the song when you click on the background.</sup>
        </Tabs.Panel>

        <Tabs.Panel value="Window">
          <h2>Window</h2>
          <Checkbox onClick={(e) => Settings.apply({ restoreWindowSize: e.currentTarget.checked }, true)} defaultChecked={Settings.get("restoreWindowSize")} name="restoreWindowSize" label="Restore Window Size On Startup" />
          <sup>Saves and restores the window size from last session.</sup>
        </Tabs.Panel>

        <Tabs.Panel value="Visuals">
          <h2>Visuals</h2>

          <SidepanelSectionGroup 
            title="Theme & Appearance" 
            icon={<i className="fas fa-palette" />}
            collapsible
          >
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
            <sup>Select the theme you want to use.</sup>
            
            <Button.Group>
              <Button 
                leftSection={<i className="fas fa-paint-brush" />} 
                onClick={() => Toxen.setMode("ThemeEditor")}
              >
                Edit Theme
              </Button>
              <Button 
                leftSection={<i className="fas fa-sync-alt" />} 
                onClick={() => Toxen.loadThemes()}
              >
                Reload Themes
              </Button>
              <Button 
                leftSection={<i className="fas fa-download" />} 
                onClick={async () => {
                  if (Toxen.theme) {
                    try {
                      await toxenapi.exportTheme(Toxen.theme);
                      Toxen.log(`Theme "${Toxen.theme.displayName || Toxen.theme.name}" exported successfully.`, 3000);
                    } catch (error) {
                      Toxen.error(`Failed to export theme: ${error.message}`);
                    }
                  } else {
                    Toxen.warn("No theme selected to export.");
                  }
                }}
                disabled={!Toxen.theme}
              >
                Export Theme
              </Button>
            </Button.Group>
          </SidepanelSectionGroup>

          <SidepanelSectionGroup 
            title="Background Settings" 
            icon={<i className="fas fa-image" />}
            collapsible
          >
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
                  <TextInput 
                    disabled 
                    onClick={callback} 
                    value={bg} 
                    name="defaultBackground" 
                    label="Default Background" 
                  />
                  <Button 
                    leftSection={<i className="fas fa-folder" />} 
                    onClick={callback}
                  >
                    Change Default Background
                  </Button>
                  <sup>
                    Set a default background which will apply for songs without one.
                    Click the button to open a select prompt.
                    You can also set a background for a specific song by clicking the song in the song list.
                  </sup>
                </>
              );
            })()}

            <Text>Background Dim</Text>
            <Slider 
              onChange={v => Settings.set("backgroundDim", v)} 
              onChangeEnd={v => Settings.apply({ backgroundDim: v }, true)} 
              defaultValue={Settings.get("backgroundDim")} 
              name="backgroundDim" 
              label={(value) => `${value}%`} 
              min={0} 
              max={100} 
            />
            <sup>
              Set the base background dim level between 0-100%.
              This is how dark the background will appear. Can be dynamically changed by having Dynamic Lighting enabled.
            </sup>

            <Checkbox 
              onClick={(e) => Settings.apply({ backgroundDynamicLighting: e.currentTarget.checked }, true)} 
              defaultChecked={Settings.get("backgroundDynamicLighting")} 
              name="backgroundDynamicLighting" 
              label="Dynamic Lighting" 
            />
            <sup>
              Enables dynamic lighting on the background image on songs.
              <br />⚠ Flashing colors ⚠
            </sup>

            <Checkbox 
              onClick={(e) => Settings.apply({ visualizerPulseBackground: e.currentTarget.checked }, true)} 
              defaultChecked={Settings.get("visualizerPulseBackground")} 
              name="visualizerPulseBackground" 
              label="Background Pulsing" 
            />
            <sup>
              Enables pulsing on the background image of a song. Pulse is based off music intensity and volume.
            </sup>
          </SidepanelSectionGroup>

          <SidepanelSectionGroup 
            title="Audio Visualizer" 
            icon={<i className="fas fa-wave-square" />}
            collapsible
          >
            <Text>Visualizer Intensity</Text>
            <Slider 
              onChange={v => Settings.set("visualizerIntensity", v / 100)} 
              onChangeEnd={v => Settings.apply({ visualizerIntensity: v / 100 }, true)} 
              defaultValue={(Settings.get("visualizerIntensity") * 100) || 100} 
              name="visualizerIntensity" 
              label={(value) => `${value}%`} 
              min={50} 
              max={200} 
            />
            <sup>
              Set the base intensity level of the visualizer. 0-100%.
              Default is 100%.
            </sup>

            <Checkbox 
              onClick={(e) => Settings.apply({ visualizerNormalize: e.currentTarget.checked }, true)} 
              defaultChecked={Settings.get("visualizerNormalize")} 
              name="visualizerNormalize" 
              label="Normalize Visualizer" 
            />
            <sup>
              Normalize the visualizer to the intensity level of the song. This will make the visuals more smoothed out and less intense.
            </sup>

            <Text>Visualizer Size</Text>
            <Slider 
              onChange={v => Settings.set("fftSize", v)} 
              onChangeEnd={v => Settings.apply({ fftSize: v }, true)} 
              defaultValue={Settings.get("fftSize") || 6} 
              name="fftSize" 
              label={(v) => v} 
              min={1} 
              max={10} 
            />
            <sup>
              Set the base size visualizer. 1-10.
              This can have a high impact on performance. Higher numbers can cause major slow-downs.
              Default is 6.
            </sup>

            <ColorInput 
              onChange={(c) => Settings.apply({ visualizerColor: c }, true)} 
              defaultValue={Settings.get("visualizerColor")} 
              name="visualizerColor" 
              label="Visualizer Color" 
            />
            <sup>Default color for the visualizer if a song specific isn't set.</sup>

            <Checkbox 
              onClick={(e) => Settings.apply({ visualizerRainbowMode: e.currentTarget.checked }, true)} 
              defaultChecked={Settings.get("visualizerRainbowMode")} 
              name="visualizerRainbowMode" 
              label="Rainbow Mode" 
            />
            <sup>
              Override the visualizer color to show a colorful rainbow visualizer.
              <br />⚠ Flashing colors ⚠
            </sup>

            <Checkbox 
              onClick={(e) => Settings.apply({ visualizerGlow: e.currentTarget.checked }, true)} 
              defaultChecked={Settings.get("visualizerGlow")} 
              name="visualizerGlow" 
              label="Visualizer Glow" 
            />
            <sup>
              Enable a glow effect on the visualizer.
            </sup>
          </SidepanelSectionGroup>

          <SidepanelSectionGroup 
            title="Visual Effects" 
            icon={<i className="fas fa-magic" />}
            collapsible
          >
            <Checkbox 
              onClick={(e) => Settings.apply({ starRushEffect: e.currentTarget.checked }, true)} 
              defaultChecked={Settings.get("starRushEffect")} 
              name="starRushEffect" 
              label="Star Rush Effect" 
            />
            <sup>
              Enable a particle effect where white stars/snow shoot outward from the center, accelerating as they move.
            </sup>

            <Text>Star Rush Intensity</Text>
            <Slider 
              onChange={v => Settings.set("starRushIntensity", v)} 
              onChangeEnd={v => Settings.apply({ starRushIntensity: v }, true)} 
              defaultValue={Settings.get("starRushIntensity") || 1} 
              name="starRushIntensity" 
              label={(value) => `${value}x`} 
              min={0.25} 
              max={2} 
              step={0.25}
            />
            <sup>
              Set the intensity level of the star rush particle effect. 0.25x-2x.
              Higher values create more particles and faster movement.
            </sup>
          </SidepanelSectionGroup>


          <Select
            allowDeselect={false}
            onChange={(value) => {
              Settings.apply({ visualizerStyle: value as VisualizerStyle }, true);
              forceUpdate();
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
          <sup>Select which style for the visualizer to use.</sup>

          {/* Specific VS settings */}
          <VisualizerStyleOptions
            style={Settings.get("visualizerStyle")}
            allOptions={Settings.get("visualizerStyleOptions")}
            onSave={(allOptions) => Settings.apply({ visualizerStyleOptions: allOptions })}
            onSaveEnd={(allOptions) => Settings.apply({ visualizerStyleOptions: allOptions }, true)}
          />
          
        </Tabs.Panel>

        <Tabs.Panel value="Performance">
          <h2>Performance</h2>
          <Checkbox
            onClick={(e) => Settings.apply({ hideOffScreenSongElements: e.currentTarget.checked }, true)}
            defaultChecked={Settings.get("hideOffScreenSongElements")}
            name="hideOffScreenSongElements"
            label="Hide Off-Screen Song Elements"
          />
          <sup>
            Hides song elements that are off-screen. This can improve performance by not loading images that aren't visible.
            This only overrides local, remote will always use this option.
          </sup>
          
          <Checkbox
            onClick={(e) => Settings.apply({ enableThumbnailCache: e.currentTarget.checked }, true)}
            defaultChecked={Settings.get("enableThumbnailCache")}
            name="enableThumbnailCache"
            label="Enable Background Thumbnail Cache"
          />
          <sup>
            Caches resized thumbnails of song backgrounds to improve performance when browsing large song lists.
            Thumbnails are automatically updated when backgrounds change.
          </sup>
        </Tabs.Panel>

        <Tabs.Panel value="Account">
          <LoginForm />
          {user && (() => {
            const usedQuota = user ?
              `${bytesToString(user.storage_used)}/${bytesToString(user.storage_quota)} used (${(user.storage_used / user.storage_quota * 100).toFixed(2)}%)`
              : "0B/0B used (0%)";
            return (<>
              <h2>{user.name}</h2>
              <h2>Premium status</h2>
              {user.premium ? (
                <>
                  <p>Expires <code>{user.premium_expire.toDateString()}</code></p>
                  <p>Remote Library Quota: <b>{usedQuota}</b></p>
                  {
                    toxenapi.isDesktop() && (
                      <>
                        <Checkbox onClick={(e) => Settings.apply({ remoteSyncOnStartup: e.currentTarget.checked }, true)} defaultChecked={Settings.get("remoteSyncOnStartup")} name="remoteSyncOnStartup" label="Sync on startup" />
                        <sup>
                          Syncs your local library with the remote library on startup.
                          <br />
                          Uploads new songs and updates existing ones. Update is two-way.
                        </sup>
                        <Checkbox onClick={(e) => Settings.apply({ remoteSyncOnSongEdit: e.currentTarget.checked }, true)} defaultChecked={Settings.get("remoteSyncOnSongEdit")} name="remoteSyncOnSongEdit" label="Sync on edit" />
                        <sup>
                          Syncs individual songs when you edit them automatically.
                        </sup>
                      </>
                    )
                  }
                </>
              ) : (
                <p>You are not a premium user.</p>
              )}
            </>)
          })()}
        </Tabs.Panel>

        <Tabs.Panel value="Advanced">
          <h2>Advanced settings</h2>
          <Checkbox onClick={(e) => {
            Settings.apply({ showAdvancedSettings: e.currentTarget.checked }, true);
            Toxen.reloadSection();
          }} defaultChecked={Settings.get("showAdvancedSettings")} name="showAdvancedSettings" label="Show Advanced UI" />
          <sup>
            Enables the viewing of advanced settings and UI elements. This will display a few more buttons around in Toxen,
            along with more technical settings that users usually don't have to worry about.
          </sup>

          <Checkbox onClick={(e) => Settings.apply({ progressBarShowMs: e.currentTarget.checked }, true)} defaultChecked={Settings.get("progressBarShowMs")} name="progressBarShowMs" label="Progress Bar: Show milliseconds" />
          <sup>Enables showing the milliseconds in the progress bar.</sup>

          {
            toxenapi.isDesktop() && (
              <>
                <Checkbox onClick={(e) => Settings.apply({ discordPresence: e.currentTarget.checked }, true)} defaultChecked={Settings.get("discordPresence")} name="discordPresence" label="Discord Presence" />
                <sup>Enables Discord presence integration. It will show you are using Toxen in your status.</sup>

                <Checkbox onClick={(e) => Settings.apply({ discordPresenceDetailed: e.currentTarget.checked }, true)} defaultChecked={Settings.get("discordPresenceDetailed")} name="discordPresenceDetailed" label="Discord Presence: Show details" />
                <sup>Enables a detailed activity status in Discord presence. It'll show what song you are listening to, and how far into it you are.</sup>

                {
                  Settings.isAdvanced() && (
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
                  )
                }
              </>
            )
          }


          <br />
          {/* Hue Settings */}
          <HueSettings />
        </Tabs.Panel>
      </Tabs>
    </>
  )
}

export function VisualizerStyleOptions(props: {
  style: VisualizerStyle,
  allOptions: ISettings["visualizerStyleOptions"],
  onSave: (allOptions: ISettings["visualizerStyleOptions"]) => void,
  onSaveEnd?: (allOptions: ISettings["visualizerStyleOptions"]) => void
}) {
  const { style, allOptions = {}, onSave, onSaveEnd = onSave } = props;
  
  return visualizerStyleOptions[style]?.map((option) => {
    const options = allOptions[style] ?? {};
    switch (option.type) {
      default:
        return null;

      case "range":
        return (
          <React.Fragment key={option.key}>
            <Text>{option.name}</Text>
            <Slider
              onChange={v => {
                options[option.key] = v;
                allOptions[style] = options;
                onSave(allOptions);
              }}
              onChangeEnd={v => {
                options[option.key] = v;
                allOptions[style] = options;
                onSaveEnd(allOptions);
              }}

              defaultValue={options[option.key] ?? option.defaultValue}
              name={option.key}
              label={(v) => v == option.defaultValue ? "Default" : v}
              min={option.min}
              max={option.max}
              step={option.step ?? 1}
            />
          </React.Fragment>
        );

      case "boolean":
        return (
        <Select key={option.key}
          allowDeselect={false}
          onChange={(value) => {
            if (value === "") {
              delete options[option.key];
            }
            else {
              options[option.key] = value === "true";
            }
            allOptions[style] = options;
            onSaveEnd(allOptions);
          }}
          defaultValue={typeof options[option.key] === "boolean" ? options[option.key].toString() : (option.defaultValue ?? "").toString()}
          name={option.key}
          label={option.name}
          data={[
            {
              value: "",
              label: "<Default>"
            },
            {
              value: "true",
              label: "Yes"
            },
            {
              value: "false",
              label: "No"
            }
          ]}
        />
      );
    }
  });
}

/**
 * Hue settings
 */
function HueSettings() {
  const [areas, setAreas] = React.useState<HueEntertainmentArea[]>(null);
  const [selectedArea, _setSelectedArea] = React.useState<HueEntertainmentArea>(HueManager.currentArea ?? null);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [bridges, setBridges] = React.useState<any[]>(null);
  const [isDiscovering, setIsDiscovering] = React.useState(false);
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [registrationAttempt, setRegistrationAttempt] = React.useState(0);
  
  function setSelectedArea(area: HueEntertainmentArea) {
    _setSelectedArea(area);
    HueManager.setCurrentArea(area);
    Settings.apply({ hueEntertainmentAreaId: area.id }, true);
  }

  function fetchAreas() {
    if (HueManager.instance) {
      HueManager.instance.getEntertainmentAreas().then((areas) => {
        setAreas(areas);
        const selectedArea = areas.find(a => a.id === Settings.get("hueEntertainmentAreaId"));
        if (selectedArea) setSelectedArea(selectedArea);
      }).catch(error => {
        Toxen.error("Failed to fetch entertainment areas: " + error.message);
      });
    }
  }

  async function identifyLights() {
    if (!HueManager.instance || !selectedArea) {
      Toxen.error("No entertainment area selected");
      return;
    }

    try {
      Toxen.log("Identifying lights in entertainment area...", 3000);
      
      // Start entertainment mode if not already started
      const wasStarted = HueManager.started;
      if (!wasStarted) {
        await HueManager.start();
      }

      // Blink sequence: Red -> Green -> Blue -> White -> Off -> Restore
      const blinkSequence = [
        [255, 0, 0],    // Red
        [0, 255, 0],    // Green  
        [0, 0, 255],    // Blue
        [255, 255, 255], // White
        [0, 0, 0],      // Off
      ];

      for (let i = 0; i < blinkSequence.length; i++) {
        const [r, g, b] = blinkSequence[i];
        
        // Set all lights to the current color
        HueManager.setLightNodes(
          HueManager.currentLightNodes.map(() => [r, g, b] as [number, number, number])
        );
        HueManager.transition(); // Actually send the data
        
        // Wait 500ms between each color change
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Restore original state
      if (!wasStarted) {
        HueManager.stop();
      } else {
        // Reset to neutral state
        HueManager.setLightNodes(
          HueManager.currentLightNodes.map(() => [0, 0, 0] as [number, number, number])
        );
        HueManager.transition(); // Send the reset
      }

      Toxen.log("Light identification complete!", 2000);
    } catch (error) {
      console.error("Failed to identify lights:", error);
      Toxen.error("Failed to identify lights: " + error.message);
    }
  }

  async function testEntertainmentStreaming() {
    if (!selectedArea) {
      Toxen.error("Please select an entertainment area first");
      return;
    }

    try {
      Toxen.log("Starting entertainment streaming test...", 3000);
      console.log(`Testing entertainment streaming for area: ${selectedArea.name}`);
      
      // Use the HueManager's HueAPI instance to test streaming
      if (HueManager.instance) {
        // await HueManager.instance.testEntertainmentStreaming(selectedArea, 10000); // 10 second test
        await HueManager.instance.testEntertainmentActivation(selectedArea);
        // Toxen.log("Entertainment streaming test started! Check your lights for color changes.", 5000);
      } else {
        throw new Error("Hue Manager not available");
      }
    } catch (error) {
      console.error("Failed to test entertainment streaming:", error);
      Toxen.error("Failed to test entertainment streaming: " + error.message);
    }
  }

  async function discoverBridges() {
    setIsDiscovering(true);
    try {
      // Use our custom HueAPI discovery
      const discoveredBridges = await HueManager.HueAPIStatic.discover();
      
      if (discoveredBridges.length > 0) {
        setBridges(discoveredBridges);
        Toxen.log(`Found ${discoveredBridges.length} Hue bridge(s)`);
      } else {
        setBridges([]);
        Toxen.error("No Hue bridges found on network");
      }
    } catch (error) {
      Toxen.error("Failed to discover bridges: " + error.message);
      setBridges([]);
    } finally {
      setIsDiscovering(false);
    }
  }

  async function registerWithBridge(bridgeIp: string) {
    setIsRegistering(true);
    setRegistrationAttempt(0);
    
    const maxAttempts = 15; // 30 seconds / 2 seconds per attempt
    const retryInterval = 2000; // 2 seconds
    let attempt = 0;
    
    try {
      Toxen.log("Press the button on your Hue bridge within 30 seconds...", 30000);
      
      const attemptRegistration = async (): Promise<any> => {
        attempt++;
        setRegistrationAttempt(attempt);
        
        try {
          const credentials = await HueManager.HueAPIStatic.register(bridgeIp, "toxen-music-player#desktop");
          return credentials;
        } catch (error) {
          if (attempt >= maxAttempts) {
            throw new Error(`Registration failed after ${maxAttempts} attempts. Make sure you pressed the button on your Hue bridge.`);
          }
          
          // Wait 2 seconds before next attempt
          await new Promise(resolve => setTimeout(resolve, retryInterval));
          return attemptRegistration();
        }
      };
      
      const credentials = await attemptRegistration();
      
      // Apply the credentials to settings
      Settings.apply({
        hueBridgeIp: bridgeIp,
        hueUsername: credentials.username,
        hueClientkey: credentials.clientkey,
        hueBridgeId: bridges?.find(b => b.internalipaddress === bridgeIp)?.id || bridgeIp
      }, true);
      
      Toxen.log("Successfully registered with Hue bridge!");
    } catch (error) {
      console.log(error);
      Toxen.error("Failed to register with bridge: " + error);
    } finally {
      setIsRegistering(false);
      setRegistrationAttempt(0);
    }
  }

  function connectToHue() {
    setIsConnecting(true);
    try {
      console.log("Initializing HueManager with credentials:", {
        ip: Settings.get("hueBridgeIp"),
        username: Settings.get("hueUsername") ? "***" : "missing",
        clientkey: Settings.get("hueClientkey") ? "***" : "missing",
        bridgeId: Settings.get("hueBridgeId") || "using IP as fallback"
      });
      
      HueManager.init({
        ip: Settings.get("hueBridgeIp"),
        username: Settings.get("hueUsername"),
        clientkey: Settings.get("hueClientkey"),
        bridgeId: Settings.get("hueBridgeId")
      });
      
      console.log("HueManager initialized, attempting to start...");
      
      HueManager.start().then(() => {
        console.log("Hue started successfully");
        Toxen.log("Hue connected successfully!", 2000);
        fetchAreas();
      }).catch((error) => {
        console.error("Error starting Hue:", error);
        Toxen.error("Failed to start Hue: " + (error.message || error));
      }).finally(() => {
        setIsConnecting(false);
      });
    } catch (error) {
      console.error("Error initializing Hue:", error);
      
      // Handle the specific DNS lookup error
      if (error.message && error.message.includes("lookup")) {
        Toxen.error("DNS lookup error. This might be due to Node.js version compatibility. Try using IP address instead of hostname.");
      } else {
        Toxen.error("Failed to initialize Hue: " + (error.message || error));
      }
      setIsConnecting(false);
    }
  }

  function disconnectFromHue() {
    HueManager.dispose();
    setAreas(null);
    _setSelectedArea(null);
    Toxen.log("Disconnected from Hue");
  }

  useEffect(() => {
    if (HueManager.instance) {
      fetchAreas();
    }
  }, []);

  return (
    <>
      <h2>Philips Hue Settings</h2>
      
      <Checkbox 
        onClick={(e) => {
          Settings.apply({ hueEnabled: e.currentTarget.checked }, true);
          if (e.currentTarget.checked && Settings.get("hueBridgeIp")) {
            connectToHue();
          } else {
            disconnectFromHue();
          }
        }} 
        defaultChecked={Settings.get("hueEnabled")} 
        name="hueEnabled" 
        label="Enable Hue Integration" 
      />
      <sup>
        Enables Philips Hue integration for real-time light synchronization with music and storyboard effects.
        <br />
        <code>⚠ Experimental feature - stability may vary ⚠</code>
      </sup>

      <h3>Bridge Discovery</h3>
      <Button 
        onClick={discoverBridges} 
        loading={isDiscovering}
        disabled={isDiscovering}
        color="blue"
        size="sm"
      >
        {isDiscovering ? "Discovering..." : "Discover Bridges"}
      </Button>
      <sup>Automatically discover Hue bridges on your network (tries local discovery first, then online discovery).</sup>

      {bridges && bridges.length > 0 && (
        <>
          <Text size="sm" fw={500} mt="md">Found Bridges:</Text>
          {bridges.map((bridge, index) => (
            <div key={index} style={{ marginTop: '8px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
              <Text size="sm"><strong>IP:</strong> {bridge.internalipaddress}</Text>
              <Text size="sm"><strong>ID:</strong> {bridge.id}</Text>
              {bridge.port && <Text size="sm"><strong>Port:</strong> {bridge.port}</Text>}
              <Button 
                onClick={() => registerWithBridge(bridge.internalipaddress)}
                loading={isRegistering}
                disabled={isRegistering}
                color="green"
                size="xs"
                mt="xs"
              >
                {isRegistering ? `Registering... (${registrationAttempt}/15)` : "Register"}
              </Button>
            </div>
          ))}
        </>
      )}

      <h3>Bridge Configuration</h3>
      <TextInput 
        onChange={(e) => Settings.apply({ hueBridgeIp: e.currentTarget.value }, true)} 
        defaultValue={Settings.get("hueBridgeIp")} 
        name="hueBridgeIp" 
        label="Bridge IP Address" 
        placeholder="192.168.1.100"
        error={Settings.get("hueBridgeIp") && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(Settings.get("hueBridgeIp")) ? "Please enter a valid IPv4 address" : null}
      />
      <sup>
        The IP address of your Hue bridge on the local network. 
        <br />
        <strong>Important:</strong> Use the numeric IP address (e.g., 192.168.1.100), not a hostname, to avoid DNS lookup issues.
      </sup>

      <TextInput 
        onChange={(e) => Settings.apply({ hueUsername: e.currentTarget.value }, true)} 
        defaultValue={Settings.get("hueUsername")} 
        name="hueUsername" 
        label="Username" 
        placeholder="Generated after registration"
      />
      <sup>Username credential for accessing the bridge API.</sup>

      <TextInput 
        onChange={(e) => Settings.apply({ hueClientkey: e.currentTarget.value }, true)} 
        defaultValue={Settings.get("hueClientkey")} 
        name="hueClientkey" 
        label="Client Key" 
        placeholder="Generated after registration"
      />
      <sup>Client key credential for Entertainment API access.</sup>

      {Settings.get("hueBridgeIp") && Settings.get("hueUsername") && Settings.get("hueClientkey") && (
        <>
          <Button 
            onClick={connectToHue}
            loading={isConnecting}
            disabled={isConnecting || !!HueManager.instance}
            color="green"
            size="sm"
            mt="md"
          >
            {isConnecting ? "Connecting..." : HueManager.instance ? "Connected" : "Connect to Bridge"}
          </Button>
          
          {HueManager.instance && (
            <Button 
              onClick={disconnectFromHue}
              color="red"
              size="sm"
              mt="md"
              ml="sm"
            >
              Disconnect
            </Button>
          )}
        </>
      )}

      {areas && areas.length > 0 && (
        <>
          <h3>Entertainment Areas</h3>
          <Text size="sm" mb="xs">Select an entertainment area for light effects:</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {areas.map((area) => (
              <Button 
                key={area.id}
                onClick={() => setSelectedArea(area)} 
                color={selectedArea?.id === area.id ? "green" : "gray"}
                variant={selectedArea?.id === area.id ? "filled" : "outline"}
                size="sm"
              >
                {area.name}
              </Button>
            ))}
          </div>
          <sup>Entertainment areas allow real-time control of multiple lights for immersive effects.</sup>
        </>
      )}

      {HueManager.instance && (
        <>
          <Button 
            onClick={fetchAreas}
            color="blue"
            variant="light"
            size="sm"
            mt="md"
          >
            Refresh Areas
          </Button>
          
          {selectedArea && (
            <Button 
              onClick={identifyLights}
              color="orange"
              variant="light"
              size="sm"
              mt="md"
              ml="sm"
            >
              Identify Lights
            </Button>
          )}
        </>
      )}

      <h3>Entertainment Streaming Test</h3>
      <Button 
        onClick={testEntertainmentStreaming}
        color="violet"
        size="sm"
        loading={false}
        disabled={!selectedArea}
      >
        Test Streaming
      </Button>
      <sup>
        Test the entertainment streaming to ensure lights respond correctly.
        This will change the colors of the lights in the selected entertainment area.
        <br />
        <strong>Note:</strong> This is a test function. Use the main controls to start/stop actual streaming.
      </sup>
    </>
  );
}