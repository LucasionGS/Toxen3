import React, { useEffect, useState } from "react";
import "./StoryboardEditor.scss";
import { Button, Checkbox, Collapse, ColorInput, Group, NumberInput, Select, Slider, TextInput, TextInputProps } from "@mantine/core";
import { Toxen } from "../../ToxenApp";
import StoryboardParser from "../../toxen/StoryboardParser";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import SelectAsync from "../SelectAsync/SelectAsync";
import { VisualizerStyle } from "../../toxen/Settings";
import { hexToRgbArray, rgbArrayToHex } from "../Form/FormInputFields/FormInputColorPicker";
import Time from "../../toxen/Time";
import Converter from "../../toxen/Converter";

export interface StoryboardEditorController {
  start: () => void;
  stop: () => void;
}

interface StoryboardEditorProps {
  controllerSetter: (controller: StoryboardEditorController) => void;
}

let currentMousePos: { x: number, y: number } = { x: 0, y: 0 };
const mouseDown = { m0: false, m1: false, m2: false };
const mouseDownFrame = { m0: false, m1: false, m2: false };

export default function StoryboardEditor(props: StoryboardEditorProps) {
  const modals = useModals();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isStarted, setIsStarted] = React.useState(false);
  const [config, setConfig] = React.useState<StoryboardParser.StoryboardConfig>(null);
  const [speed, _setSpeed] = React.useState(1);
  const setSpeed = (v: number) => {
    _setSpeed(v);
    Toxen.musicPlayer.media.playbackRate = v;
  }
  const [bpm, _setBpm] = React.useState(120);
  const setBpm = (v: number) => {
    _setBpm(v);
    if (config) {
      config.bpm = v;
      setConfig(config);
    }
  }
  const [bpmOffset, _setBpmOffset] = React.useState(0);
  const setBpmOffset = (v: number) => {
    _setBpmOffset(v);
    if (config) {
      config.bpmOffset = v;
      setConfig(config);
    }
  }

  const mouseEventHandler = React.useCallback((e: MouseEvent) => {
    // Mouse position is relative to the canvas
    const canvasSize = canvasRef.current.getBoundingClientRect();
    currentMousePos = {
      x: e.offsetX / canvasSize.width * canvasRef.current.width,
      y: e.offsetY / canvasSize.height * canvasRef.current.height
    };
    let btns = e.buttons;
    if (btns >= 4) {
      mouseDown.m2 = true;
      btns -= 4;
    } else mouseDown.m2 = false;

    if (btns >= 2) {
      mouseDown.m1 = true;
      btns -= 2;
    } else mouseDown.m1 = false;

    if (btns >= 1) {
      mouseDown.m0 = true;
    } else mouseDown.m0 = false;
  }, []);
  
  const start = React.useCallback(() => {
    if (!Toxen.editingSong) return;

    if (!Toxen.editingSong.paths.media.endsWith(".ogg")) {
      // Toxen.notify({
      //   content: "Storyboard works optimially with .ogg files. Precise timing may not be accurate with other file types.",
      //   type: "error",
      //   expiresIn: 5000
      // });

      function PopupModalConfirmation() {
        const [converting, setConverting] = React.useState(false);
        
        return (
          <div>
            <div>
              <p>Storyboard works optimially with .ogg files. Precise timing may not be accurate with other file types.</p>
              <p>Would you like to continue?</p>
            </div>

            <Group>
              <Button disabled={converting} color="red" onClick={() => {
                modals.closeModal(modalId);
                stop();
                Toxen.setMode("Player");
              }}>Cancel</Button>
              <Button disabled={converting} color="blue" onClick={() => {
                modals.closeModal(modalId);
              }}>Continue</Button>
              {toxenapi.isDesktop() && (
                <Button loading={converting} disabled={converting} color="blue" onClick={() => {
                  setConverting(true);
                  toxenapi.ffmpeg.convertToOgg(Toxen.editingSong).then(() => {
                    setConverting(false);
                    modals.closeModal(modalId);
                    Toxen.notify({
                      content: "Converted to .OGG",
                      expiresIn: 2000
                    });
                  });
                }}>Convert to .OGG</Button>
              )}
            </Group>
          </div>
        )
      }
      
      const modalId = modals.openModal({
        title: "Storyboard Warning",
        closeOnClickOutside: false,
        closeOnEscape: false,
        withCloseButton: false,
        children: <PopupModalConfirmation />
      });
    }
    
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (!config) {
          Toxen.editingSong.readStoryboardFile(false).then((config) => {
            config = StoryboardParser.setStoryboard(config);
            setConfig(config);
            _setBpm(config.bpm ?? 120);
            _setBpmOffset(config.bpmOffset ?? 0);
            storyboardRenderer(ctx, config, modals, performance.now());
          });
        }
      }
      setIsStarted(true);

      // Add event listeners
      canvas.addEventListener("mousemove", mouseEventHandler);
      canvas.addEventListener("mousedown", mouseEventHandler);
      canvas.addEventListener("mouseup", mouseEventHandler);
    }
  }, []);
  
  const stop = React.useCallback(() => {
    const canvas = canvasRef.current;
    shouldBeStopped = true;
    setIsStarted(false);
    canvas.removeEventListener("mousemove", mouseEventHandler);
    canvas.removeEventListener("mousedown", mouseEventHandler);
    canvas.removeEventListener("mouseup", mouseEventHandler);
  }, []);

  const controller = React.useMemo<StoryboardEditorController>(() => ({
    start,
    stop
  }), [start, stop]);
  
  props.controllerSetter?.(controller);
  
  const song = Toxen.editingSong;
  return (
    <div className="storyboard-editor" style={{ display: isStarted ? "": "none" }}>
      <div style={{ display: "flex" }}>
        <Button onClick={() => {
          const saveLocation = song.storyboardFile() || song.dirname("storyboard.tsb");
          StoryboardParser.save(saveLocation, config);
          Toxen.notify({
            content: "Storyboard saved",
            expiresIn: 2000
          });
        }}>Save</Button>
        <Button onClick={() => {
          stop();
          Toxen.setMode("Player");
        }}>Stop</Button>
        <Button onClick={() => {
          Toxen.musicPlayer.pause();
          Toxen.musicPlayer.media.currentTime = bpmOffset / 1000;
      }}>Goto start</Button>
        <NumberInput value={bpm} onChange={(v) => setBpm(+v)} label="BPM" />
        <NumberInput value={bpmOffset} onChange={(v) => setBpmOffset(+v)} label="BPM Offset" />
        <Button onClick={() => {
          setBpmOffset(Toxen.musicPlayer.media.currentTime * 1000);
        }}>Now</Button>
        <Slider value={speed} onChange={setSpeed} label="Speed" min={0.5} max={2} step={0.1} style={{
          width: 200
        }} />
        <Button onClick={() => {
          const beat = config.bpm ?? 120;
          const beatOffset = config.bpmOffset ?? 0;
          const currentTime = Toxen.musicPlayer.media.currentTime * 1000;
          const offset = currentTime - beatOffset;
          const interval = (60000 / beat) / 4;
          const fullBeat = Math.floor(offset / interval);
          const nextBeat = (fullBeat + 1) * interval + beatOffset;
          Toxen.musicPlayer.media.currentTime = nextBeat / 1000;
        }}>Go to nearest quarter beat</Button>
      </div>
      <canvas ref={canvasRef} width={1920} height={200}>

      </canvas>
    </div>
  )
}

let shouldBeStopped = false;

let canPlayClap = true;
const eventBorderSelectSize = 10;
function storyboardRenderer(ctx: CanvasRenderingContext2D, config: StoryboardParser.StoryboardConfig, modals: ModalsContextProps, time: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (shouldBeStopped) {
    return shouldBeStopped = false;
  }
  const song = Toxen.editingSong;
  // console.log("Rendering storyboard");
  requestAnimationFrame((t) => storyboardRenderer(ctx, config, modals, t));
  if (!song) return;

  const bpm = config.bpm ?? 120;
  const bpmOffset = config.bpmOffset ?? 0;
  const songTime = (Toxen.musicPlayer.media.currentTime) * 1000;
  const duration = Toxen.musicPlayer.media.duration * 1000;

  const w = ctx.canvas.width, h = ctx.canvas.height;
  const indicatorPos = w * 0.25;
  
  // Draw outline
  ctx.fillStyle = "lightgreen";
  ctx.fillRect(0, 0, w, 2);
  ctx.fillRect(0, 0, 2, h);
  ctx.fillRect(w - 2, 0, 2, h);
  ctx.fillRect(0, h - 2, w, 2);

  // ctx.fillText("BPM: " + bpm, 10, 10);
  // ctx.fillText("BPM Offset: " + bpmOffset, 10, 20);
  // ctx.fillText("Time: " + songTime, 10, 30);
  // ctx.fillText("Duration: " + duration, 10, 40);
  // ctx.fillText("Mouse: " + currentMousePos.x + ", " + currentMousePos.y, 10, 50);
  // ctx.fillText("Mouse Click: " + mouseDown.m0 + ", " + mouseDown.m1 + ", " + mouseDown.m2, 10, 60);
  // // Display selectedEvent
  // if (selectedEvent.event) {
  //   ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
  //   const event = selectedEvent.event;
  //   const startTime = event.startTime * 1000;
  //   const endTime = event.endTime * 1000;

  //   ctx.fillText("Selected Event: " + event.component, 10, 70);
  //   ctx.fillText("Start: " + startTime, 10, 80);
  //   ctx.fillText("End: " + endTime, 10, 90);
  // }

  
  // Display intervals based on BPM
  const intervalFull = 60000 / bpm;
  const intervalsFull = (w / intervalFull) + 2;
  const intervalQuarter = intervalFull / 4;
  const intervalsQuarter = (w / intervalQuarter) + 2;
  const offset = (songTime - bpmOffset) % intervalFull;

  const offsetPos = indicatorPos % intervalFull;
  
  const quarterBeatPositions: number[] = [];
  
  for (let i = 1; i < intervalsQuarter; i++) {
    ctx.fillStyle = "rgba(200, 200, 200, 0.25)";
    const pos = offsetPos + i * intervalQuarter - offset - (intervalQuarter * 2);
    ctx.fillRect(pos, 0, 1, h * 0.25);
    quarterBeatPositions.push(pos);
  }
  
  for (let i = 1; i < intervalsFull; i++) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(offsetPos + i * intervalFull - offset - (intervalFull * 2), 0, 2, h * 0.25);
  }

  // Play a sound if the time is on the beat
  // if (songTime > bpmOffset) {
  //   if (Math.abs(offset) < 12) {
  //     if (canPlayClap) {
  //       const audio = new Audio(soundClap);
  //       audio.volume = 0.01;
  //       audio.play();
  //       canPlayClap = false;
  //     }
  //   }
  //   else {
  //     // can play again
  //     canPlayClap = true;
  //   }
  // }

  // Nearest quarter beat to mouse
  function getNearestBeatFrom(x: number) {
    const nearestCachedBeat = quarterBeatPositions.reduce((prev, curr) => {
      return Math.abs(curr - x) < Math.abs(prev - x) ? curr : prev;
    });

    return nearestCachedBeat;

    // const nearestCachedBeatToIndicator = quarterBeatPositions.reduce((prev, curr) => {
    //   return Math.abs(curr - indicatorPos) < Math.abs(prev - indicatorPos) ? curr : prev;
    // });

    // // return nearestCachedBeatToIndicator;

    // const diff = nearestCachedBeatToIndicator - indicatorPos;

    // const beat = Math.round(Math.floor(x / intervalQuarter) * intervalQuarter + diff + (intervalQuarter / 2));
    // return beat;
  }
  const nearestMouseBeat = getNearestBeatFrom(currentMousePos.x);
  
  if (selectStart && !selectedEvent.event) {
    ctx.fillStyle = "rgba(0, 0, 255, 0.5)";

    const end = selectEnd ?? currentMousePos;
    ctx.fillRect(selectStart.x, selectStart.y, end.x - selectStart.x, end.y - selectStart.y);
  }

  // Draw all events on the timeline at the appropriate time
  const visibleEvents: [StoryboardParser.SBEvent, number, number, number, number][] = [];
  let hPosOffset = 0;
  const visibleStoryboard = config.storyboard.filter((event) => {
    const startTime = event.startTime * 1000;
    const endTime = event.endTime * 1000;
    return startTime - songTime <= 2000 && endTime - songTime >= -2000;
    // if (startTime - songTime > 2000) return false;
    // if (endTime - songTime < -2000) return false;
    // return true;
  });
  const eventH = h / (visibleStoryboard.length + 1);
  ctx.save();
  visibleStoryboard.forEach((event, i) => {
    const startTime = event.startTime * 1000;
    const endTime = event.endTime * 1000;
    if (startTime - songTime > 2000) return;
    if (endTime - songTime < -2000) return;
    
    
    const xStart = indicatorPos + (startTime - songTime), yStart = i * eventH;
    const xEnd = xStart + endTime - startTime, yEnd = yStart + eventH;

    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    if (event.component === "visualizerColor") {
      // debugger
      const color = (event.data.color ?? [255, 255, 255]) as [number, number, number];
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.5)`;
    }
    
    ctx.fillRect(
      xStart,
      yStart,
      endTime - startTime,
      eventH
    );
    
    if (currentMousePos.y >= yStart && currentMousePos.y <= yEnd) {
      if (Math.abs(xStart - currentMousePos.x) < eventBorderSelectSize || Math.abs(xEnd - currentMousePos.x) < eventBorderSelectSize) {
        ctx.strokeStyle = "rgba(0, 0, 255, 0.5)";
      }
      else {
        ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
      }

      ctx.strokeRect(xStart, yStart, xEnd - xStart, yEnd - yStart); 
    }
    visibleEvents.push([event, xStart, xEnd, yStart, yEnd]);

    // Draw component name and adjust font size
    ctx.fillStyle = "white";
    ctx.font = `${eventH - 2}px Arial`;
    ctx.fillText(StoryboardParser.components?.[event.component]?.name ?? event.component, xStart + eventH / 2, yStart + eventH - 2);
  });
  ctx.restore();

  // Display current time
  ctx.fillStyle = "red";
  ctx.fillRect(indicatorPos, 0, 2, h);

  function positionToTime(x: number) {
    return Math.round(x + songTime - indicatorPos);
  }

  function getHoveredEvent() {
    return visibleEvents.find(([event, startX, endX, startY, endY]) => {
      if (
        currentMousePos.x + eventBorderSelectSize < startX || currentMousePos.x - eventBorderSelectSize > endX
        || currentMousePos.y < startY || currentMousePos.y > endY
      ) return false;
    
      return true;
    });
  }

  // ctx.fillText("Mouse Time: " + positionToTime(currentMousePos.x), 10, 100);

  function onMouseDown() {
    selectEnd = { x: nearestMouseBeat, y: 100 };

    
    if (selectedEvent.event) {
      const newPos = (positionToTime(nearestMouseBeat) / 1000);
      if (selectedEvent.edge === "start" && newPos < selectedEvent.event.endTime) {
        selectedEvent.event.startTime = newPos;
      }
      else if (selectedEvent.edge === "end" && newPos > selectedEvent.event.startTime) {
        selectedEvent.event.endTime = newPos;
      }
    }
  }

  function onMouseDownFrame(modals: ModalsContextProps) {
    // If near an edge of an event
    const data = getHoveredEvent();

    if (!data) {
      selectStart = { x: nearestMouseBeat, y: 0 };
      selectedEvent.event = null;
      selectedEvent.edge = null;
      return;
    }

    const [event, startX, endX] = data;

    if (event) {
      if (Math.abs(startX - currentMousePos.x) < eventBorderSelectSize) {
        selectedEvent.event = event;
        selectedEvent.edge = "start";
      }
      else if (Math.abs(endX - currentMousePos.x) < eventBorderSelectSize) {
        selectedEvent.event = event;
        selectedEvent.edge = "end";
      }
      else {
        const modalId = modals.openModal({
          title: "Edit Event",
          children: <EditEvent event={event} config={config} close={() => {
            modals.closeModal(modalId);
            StoryboardParser.setStoryboard(config);
          }} />
        });
      }

      Toxen.musicPlayer.pause();
    }
    else {
      selectedEvent.event = null;
      selectedEvent.edge = null;
      selectStart = { x: nearestMouseBeat, y: 0 };
    }
  }
  
  function onMouseUpFrame() {
    console.log("Mouse up on frame");

    // Add event
    if (selectStart && selectEnd && Math.abs(selectStart.x - selectEnd.x) > 10 && selectStart.x < selectEnd.x) {
      const newEvent = StoryboardParser.SBEvent.fromConfig({
        start: positionToTime(selectStart.x) / 1000,
        end: positionToTime(selectEnd.x) / 1000,
        component: Object.keys(StoryboardParser.components)[0],
        data: {},
        once: false,
      }, {}, null, false);

      config.storyboard.push(newEvent);
      
      const modalId = modals.openModal({
        title: "New Event",
        children: <EditEvent config={config} event={newEvent} close={() => {
          modals.closeModal(modalId);
        }} />
      });
    }
    
    selectStart = null;
    selectEnd = null;

    selectedEvent.event = null;
    selectedEvent.edge = null;
  }

  function onRightClickDown() {}
  function onRightClickDownFrame() {
    Toxen.musicPlayer.setPosition(positionToTime(currentMousePos.x) / 1000);
    // Toxen.musicPlayer.media.currentTime = positionToTime(currentMousePos.x) / 1000;
  }
  function onRightClickUpFrame() {}

  function onMiddleClickDown() {
    if (moveEvent) {
      const targetTime = positionToTime(nearestMouseBeat - moveEvent.startMouseOffset) / 1000;
      moveEvent.event.startTime = targetTime;
      moveEvent.event.endTime = targetTime + moveEvent.duration
    }
  }
  function onMiddleClickDownFrame() {
    const data = getHoveredEvent();
    if (data) {
      moveEvent = {
        event: data[0],
        startTime: data[0].startTime,
        startX: data[1],
        startMouseOffset: nearestMouseBeat - data[1],
        duration: data[0].endTime - data[0].startTime,
      };
      console.log("Middle click on event", moveEvent);
    }
    else {
      console.log("Middle click on event no event");
      moveEvent = null;
    }
  }
  
  function onMiddleClickUpFrame() {
    moveEvent = null;
  }

  // Mouse events on frame
  if (mouseDown.m0) {
    onMouseDown();
  }
  if (mouseDown.m0 && !mouseDownFrame.m0) {
    onMouseDownFrame(modals);
    mouseDownFrame.m0 = true;
  }
  if (!mouseDown.m0 && mouseDownFrame.m0) {
    onMouseUpFrame();
    mouseDownFrame.m0 = false;
  }

  if (mouseDown.m1) {
    onRightClickDown();
  }
  if (mouseDown.m1 && !mouseDownFrame.m1) {
    onRightClickDownFrame();
    mouseDownFrame.m1 = true;
  }
  if (!mouseDown.m1 && mouseDownFrame.m1) {
    onRightClickUpFrame()
    mouseDownFrame.m1 = false;
  }

  if (mouseDown.m2) {
    onMiddleClickDown();
  }
  if (mouseDown.m2 && !mouseDownFrame.m2) {
    onMiddleClickDownFrame();
    mouseDownFrame.m2 = true;
  }
  if (!mouseDown.m2 && mouseDownFrame.m2) {
    onMiddleClickUpFrame();
    mouseDownFrame.m2 = false;
  }
}

let selectStart: { x: number, y: number } | null = null;
let selectEnd: { x: number, y: number } | null = null;
const selectedEvent: { event: StoryboardParser.SBEvent | null, edge: "start" | "end" | null } = { event: null, edge: null }
let moveEvent: {
  event: StoryboardParser.SBEvent,
  startTime: number,
  startX: number,
  startMouseOffset: number,
  duration: number,
} | null = null;

interface EditEventProps {
  config: StoryboardParser.StoryboardConfig,
  event: StoryboardParser.SBEvent,
  close: () => void;
}

function EditEvent(props: EditEventProps) {
  const { event, config, close } = props;


  return (
    <div>
      <EventElement config={config} event={event} close={close} />
    </div>
  )
}

function EventElement(props: { config: StoryboardParser.StoryboardConfig, event: StoryboardParser.SBEvent, close: () => void }) {
  const { event, config, close } = props;

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

  return (
    <div>
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
        allowDeselect={false}
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
      <Group justify="apart">
        <Button color="blue" onClick={() => {
          config.storyboard.push(StoryboardParser.SBEvent.fromConfig({
            start: event.startTime,
            end: event.endTime,
            component: event.component,
            data: Converter.createDeepCopy(event.data),
            once: event.once,
          }, {}, null, false));
          close();
        }}>+ Duplicate</Button>

        <Button variant="outline" color="red" onClick={() => {
          config.storyboard.splice(config.storyboard.indexOf(event), 1);
          StoryboardParser.resetCurrentEvents();
          close();
        }}>Delete</Button>
      </Group>
    </div>
  )
}

interface TimeInputProps extends Omit<TextInputProps, "onChange"> {
  onChange?(event: React.ChangeEvent<HTMLInputElement>, time: Time, valid: boolean): void;
}

function TimeInput(props: TimeInputProps) {
  const { onChange, ...others } = props;
  const [error, setError] = useState(false);
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
  const song = Toxen.editingSong;
  
  const { component: comp, event } = props;
  const dataId = comp.identifier;
  const dataName = comp.name;
  const dataType = comp.type;
  const placeholder = comp.placeholder;
  const description = comp.description;
  const required = comp.required;
  const dataValue = event.data[dataId] as StoryboardParser.ComponentArgumentTypes[typeof dataType];
  const [value, setValue] = useState(dataValue);
  switch (dataType) {
    case "String": return (
      <>
        <div>
          <TextInput
            label={dataName + (required ? " *" : "")}
            value={value as string}
            onChange={(e) => {
              setValue(event.data[dataId] = e.currentTarget.value);
            }}
            placeholder={placeholder}
            />
        </div>
        <small>{description}</small>
      </>
    );

    case "Number": return (
      <>
        <div>
          <NumberInput
            // precision={2}
            fixedDecimalScale
            decimalScale={2}
            decimalSeparator="."
            label={dataName + (required ? " *" : "")}
            value={value as number}
            onChange={(v) => {
              setValue(event.data[dataId] = v);
            }}
            placeholder={placeholder}
          />
        </div>
        <small>{description}</small>
      </>
    );

    case "Boolean": return (
      <>
        <div>
          <Checkbox
            label={dataName + (required ? " *" : "")}
            checked={value as boolean}
            onChange={(e) => {
              setValue(event.data[dataId] = e.currentTarget.checked);
            }}
          />
        </div>
        <small>{description}</small>
      </>
    );

    case "Color": return (
      <>
        <div>
          <ColorInput
            label={dataName + (required ? " *" : "")}
            value={rgbArrayToHex((((value as any)?.slice(0, 3) as [number, number, number]) ?? [255, 255, 255]))}
            onChange={(color) => {
              setValue(event.data[dataId] = hexToRgbArray(color));
            }}
            placeholder={placeholder}
          />
        </div>
        <small>{description}</small>
      </>
    );

    case "VisualizerStyle": return (
      <>
        <div>
          <Select
            allowDeselect={false}
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
        <small>{description}</small>
      </>
    );

    case "Select": return (
      <>
        <div>
          <Select
            allowDeselect={false}
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
        <small>{description}</small>
      </>
    );
    
    case "SelectImage": return (
      <>
        <div>
          <SelectAsync
            allowDeselect={false}
            label={dataName + (required ? " *" : "")}
            data={(async () => {
              const song = Toxen.editingSong;
              if (!song)
                return [];
              const path = song.dirname();

              const supported = Toxen.getSupportedImageFiles();
              return await Toxen.filterSupportedFiles(path, supported);
            })}
            value={value as string}
            onChange={(value) => {
              setValue(event.data[dataId] = value as string);
            }}
          />
        </div>
        <small>{description}</small>
      </>
    );

    default:
      return (<></>);
  }
}
