import { Button, Checkbox, Collapse, ColorInput, Group, NumberInput, Select, Slider, TextInput, TextInputProps } from "@mantine/core";
import React, { Component, useEffect, useState } from "react"
import Song from "../../toxen/Song";
import StoryboardParser from "../../toxen/StoryboardParser";
import Time from "../../toxen/Time";
import { Toxen } from "../../ToxenApp";
import SidepanelSection from "../Sidepanel/SidepanelSection";
import SidepanelSectionHeader from "../Sidepanel/SidepanelSectionHeader";
import { IconArrowDownCircle, IconArrowLeftBar, IconArrowRightBar, IconArrowUpCircle, IconPlayerPause, IconPlayerPlay, IconStar } from "@tabler/icons";
import { useClipboard, useForceUpdate } from "@mantine/hooks";
import { hexToRgbArray, rgbArrayToHex } from "../Form/FormInputFields/FormInputColorPicker";
import Settings, { VisualizerStyle } from "../../toxen/Settings";
import Path from "path";
import "./StoryboardEditorPanel.scss";

interface StoryboardEditorPanelProps { }

interface StoryboardEditorPanelState {
  song: Song;
}

export default function StoryboardEditorPanel() {
  const [song, setSong] = React.useState(Toxen.editingSong);
  const [playbackRate, setPlaybackRate] = React.useState(Toxen.musicPlayer.playbackRate);
  const [config, setConfig] = React.useState<StoryboardParser.StoryboardConfig>();
  const clipboard = useClipboard();
  const [paused, setPaused] = useState(Toxen.musicPlayer.media.paused);
  const forceUpdate = useForceUpdate();
  if (!song) {
    return (<div>No song</div>)
  }

  if (!config) {
    song.readStoryboardFile(false).then((config) => {
      config = StoryboardParser.setStoryboard(config);
      setConfig(config);
    });
    return (<div>No config</div>);
  }

  return (
    <>
      <SidepanelSectionHeader>
        <h1>Storyboard Editor</h1>
        <Button color="green" onClick={async () => {
          const saveLocation = song.storyboardFile() || song.dirname("storyboard.tsb");
          StoryboardParser.save(saveLocation, config);
          if (saveLocation !== song.storyboardFile()) {
            if (Settings.isRemote()) {
              song.paths.storyboard = saveLocation.replace(song.dirname(), "");
              while (song.paths.storyboard.startsWith("/")) {
                song.paths.storyboard = song.paths.storyboard.substring(1);
              }
              while (song.paths.storyboard.endsWith("/")) {
                song.paths.storyboard = song.paths.storyboard.substring(0, song.paths.storyboard.length - 1);
              }
            }
            else {
              song.paths.storyboard = Path.relative(song.dirname(), saveLocation);
            }
            song.saveInfo();
          }
          Toxen.log("Saved storyboard", 2000);
        }}>Save</Button>
        <Button color="red" onClick={() => {
          // Check if there are unsaved changes and confirm the exit.
          Toxen.musicPlayer.setPlaybackRate(1); // Reset playback rate
          Toxen.setMode("Player");
        }}>Exit editor</Button>
        <br />
        <Button color="blue" onClick={() => {
          clipboard.copy(new Time(Toxen.musicPlayer.media.currentTime * 1000).toTimestamp(Time.FORMATS.STANDARD_WITH_MS));
          Toxen.log("Copied current time to clipboard", 2000);
        }}>Copy current time</Button>
        <hr />
        <Group position="center">
          <Button title="-5s" color="blue" onClick={() => {
            Toxen.musicPlayer.setPosition(Math.max(0, Math.min(Toxen.musicPlayer.media.currentTime - (5 * playbackRate), Toxen.musicPlayer.media.duration)));
          }}>
            <IconArrowLeftBar />
          </Button>
          <Button title="Play/Pause" color="blue" onClick={() => {
            setPaused(!Toxen.musicPlayer.paused);
            Toxen.musicPlayer.toggle();
          }}>
            {
              paused ? <IconPlayerPlay /> : <IconPlayerPause />
            }
          </Button>
          <Button title="+5s" color="blue" onClick={() => {
            Toxen.musicPlayer.setPosition(Math.max(0, Math.min(Toxen.musicPlayer.media.currentTime + (5 * playbackRate), Toxen.musicPlayer.media.duration)));
          }}>
            <IconArrowRightBar />
          </Button>
        </Group>
        <Group position="center">
          {/* Playback rate */}
          <Slider
            style={{
              width: "90%",
            }}
            value={playbackRate}
            min={0.50}
            max={1.5}
            step={0.25}
            onChange={(value) => {
              Toxen.musicPlayer.setPlaybackRate(value);
              setPlaybackRate(value);
            }}
            label={(value) => `${value}x speed`}
          />
        </Group>
      </SidepanelSectionHeader>
      {/* <h1>Storyboard editor coming soon!</h1>
      <p>Click the <code>Exit editor</code> to get back to your songs.</p>
      <p>Nothing can be done in here yet. This is just a placeholder.</p> */}

      {
        config.storyboard.sort((a, b) => a.startTime - b.startTime).map((event, i) => {
          return (
            <EventElement
              key={event._key}
              config={config}
              event={event}
              updateParent={() => {
                forceUpdate();
              }}
            />
          )
        })
      }
      {/* Add */}
      <Button color="green" onClick={() => {
        config.storyboard.push(StoryboardParser.SBEvent.fromConfig({
          start: Toxen.musicPlayer.media.currentTime,
          end: Toxen.musicPlayer.media.currentTime,
          component: null,
          data: {},
        }, {}, null, false));
        forceUpdate();
      }}>Add event</Button>
    </>
  )
}

function EventElement(props: { config: StoryboardParser.StoryboardConfig, event: StoryboardParser.SBEvent, updateParent?: () => void }) {
  const { event, config, updateParent } = props;

  const [opened, setOpened] = useState(false);
  const [startTime, setStartTime] = useState(
    Time.fromTimestamp((event.startTime || 0).toString()).toTimestamp(
      event.startTime === Math.round(event.startTime) ? Time.FORMATS.STANDARD : Time.FORMATS.STANDARD_WITH_MS
    )
  );
  const [endTime, setEndTime] = useState(
    Time.fromTimestamp((event.endTime || 0).toString()).toTimestamp(
      event.endTime === Math.round(event.endTime) ? Time.FORMATS.STANDARD : Time.FORMATS.STANDARD_WITH_MS
    )
  );
  const [component, setComponent] = useState(event.component ?? (event.component = Object.keys(StoryboardParser.components)[0]));

  const isNew = Toxen.musicPlayer.media.currentTime === event.startTime;

  return (
    <div>
      <span
        onClick={() => setOpened(!opened)}
        style={{
          userSelect: "none", cursor: "pointer",
          color: isNew ? "lightgreen" : undefined,
        }}
        className="sbevent-header"
      >
        {
          isNew ? <IconStar style={{ transform: "translateY(5px)" }} />
            : opened ?
              <IconArrowDownCircle style={{ transform: "translateY(5px)" }} />
              :
              <IconArrowUpCircle style={{ transform: "translateY(5px)" }} />
        } [<code>{
          Time.fromTimestamp(startTime, () => null)?.toTimestamp(Time.FORMATS.STANDARD_WITH_MS) ?? "INVALID"
        } - {
            Time.fromTimestamp(endTime, () => null)?.toTimestamp(Time.FORMATS.STANDARD_WITH_MS) ?? "INVALID"
          }</code>] {StoryboardParser.components[component].name}
      </span>
      <Collapse in={opened}>
        <Group>
          <TimeInput
            label="Start time"
            value={startTime}
            onChange={(e, value, valid) => {
              if (valid) {
                const seconds = value.toSeconds();
                event.startTime = seconds;
              }
              setStartTime(e.currentTarget.value);
            }}
          />
          <Button onClick={() => {
            Toxen.musicPlayer.setPosition(event.startTime);
          }}>Go</Button>
        </Group>
        <TimeInput
          label="End time"
          value={endTime}
          onChange={(e, value, valid) => {
            if (valid) {
              const seconds = value.toSeconds();
              event.endTime = seconds;
            }
            setEndTime(e.currentTarget.value);
          }}
        />
        <Select
          label="Component"
          data={Object.keys(StoryboardParser.components).map((key) => {
            return {
              label: StoryboardParser.components[key].name,
              value: key,
            }
          })}
          value={component}
          onChange={(value) => {
            setComponent(event.component = value);
          }}
        />

        <div>
          {/* Data */}
          <h3>Properties</h3>
          {
            StoryboardParser.components[component]?.arguments.map(c => <ComponentButton key={c.identifier} event={event} component={c} />) ?? (
              <p>Select component to see properties</p>
            )
          }
        </div>
        <br />
        <Group position="apart">
          <Button color="blue" onClick={() => {
            config.storyboard.push(StoryboardParser.SBEvent.fromConfig({
              start: event.startTime,
              end: event.endTime,
              component: event.component,
              data: Object.create(event.data),
              once: event.once,
            }, {}, null, false));
            updateParent();
          }}>+ Duplicate</Button>

          <Button variant="outline" color="red" onClick={() => {
            config.storyboard.splice(config.storyboard.indexOf(event), 1);
            StoryboardParser.resetCurrentEvents();
            updateParent?.();
          }}>Delete</Button>
        </Group>
        <hr />
      </Collapse>
    </div>
  )
}

interface TimeInputProps extends Omit<TextInputProps, "onChange"> {
  onChange?(event: React.ChangeEvent<HTMLInputElement>, time: Time, valid: boolean): void;
}

function TimeInput(props: TimeInputProps) {
  const { onChange, ...others } = props;
  const [error, setError] = useState(false);
  console.log("Error:", error);
  return (
    <>
      <TextInput {...others} onChange={(e) => {
        try {
          const time = Time.fromTimestamp(e.currentTarget.value);
          setError(false);
          return onChange(e, time, true);
        } catch (error) {
          setError(true);
          return onChange(e, null, false);
        }
      }} />
      {error && (
        <span style={{ color: "red" }}>Invalid time</span>
      )}
    </>
  )
}

function ComponentButton(props: { event: StoryboardParser.SBEvent, component: StoryboardParser.ComponentArgument }) {
  const { component: comp, event } = props;
  const dataId = comp.identifier;
  const dataName = comp.name;
  const dataType = comp.type;
  const required = comp.required;
  const dataValue = event.data[dataId] as StoryboardParser.ComponentArgumentTypes[typeof dataType];
  const [value, setValue] = useState(dataValue);
  switch (dataType) {
    case "String": return (
      <div>
        <TextInput
          label={dataName + (required ? " *" : "")}
          value={value as string}
          onChange={(e) => {
            setValue(event.data[dataId] = e.currentTarget.value);
          }}
        />
      </div>
    );

    case "Number": return (
      <div>
        <NumberInput
          precision={2}
          decimalSeparator="."
          label={dataName + (required ? " *" : "")}
          value={value as number}
          onChange={(v) => {
            setValue(event.data[dataId] = v);
          }}
        />
      </div>
    );

    case "Boolean": return (
      <div>
        <Checkbox
          label={dataName + (required ? " *" : "")}
          checked={value as boolean}
          onChange={(e) => {
            setValue(event.data[dataId] = e.currentTarget.checked);
          }}
        />
      </div>
    );

    case "Color": return (
      <div>
        <ColorInput
          label={dataName + (required ? " *" : "")}
          value={rgbArrayToHex((((value as any)?.slice(0, 3) as [number, number, number]) ?? [255, 255, 255]))}
          onChange={(color) => {
            setValue(event.data[dataId] = hexToRgbArray(color));
          }}
        />
      </div>
    );

    case "VisualizerStyle": return (
      <div>
        <Select
          label={dataName + (required ? " *" : "")}
          data={Object.keys(VisualizerStyle).map((key) => {
            return {
              label: key,
              value: VisualizerStyle[key as keyof typeof VisualizerStyle],
            }
          })}
          value={value as string}
          onChange={(value) => {
            setValue(event.data[dataId] = value as VisualizerStyle);
          }}
        />
      </div>
    );

    case "Select": return (
      <div>
        <Select
          label={dataName + (required ? " *" : "")}
          data={comp.selectData.map(([key, value]) => {
            return {
              label: key,
              value: value ?? key,
            }
          })}
          value={value as string}
          onChange={(value) => {
            setValue(event.data[dataId] = value as string);
          }}
        />
      </div>
    );

    default:
      return (<></>);
  }
}
