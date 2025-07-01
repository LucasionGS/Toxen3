import React, { useEffect, useState } from "react";
import "./StoryboardEditor.scss";
import { Button, Checkbox, Collapse, ColorInput, Group, NumberInput, Select, Slider, TextInput, TextInputProps } from "@mantine/core";
import { Toxen } from "../../ToxenApp";
import StoryboardParser from "../../toxen/StoryboardParser";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import SelectAsync from "../SelectAsync/SelectAsync";
import BackgroundFileSelector from "../BackgroundFileSelector/BackgroundFileSelector";
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

// Polyfill for roundRect if not available
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x: number, y: number, width: number, height: number, radius: number) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}
const mouseDown = { m0: false, m1: false, m2: false };
const mouseDownFrame = { m0: false, m1: false, m2: false };

const eventMadeAtKey: Record<string, StoryboardParser.SBEvent> = {};
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

  const song = Toxen.editingSong;
  
  const mouseEventHandler = React.useCallback((e: MouseEvent) => {
    if (!isStarted) return false;
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
    
    // Update cursor based on interaction state
    if (canvasRef.current) {
      if (mouseDown.m2) {
        canvasRef.current.style.cursor = 'grabbing';
      } else if (mouseDown.m1) {
        canvasRef.current.style.cursor = 'pointer';
      } else if (mouseDown.m0) {
        canvasRef.current.style.cursor = 'grabbing';
      } else {
        canvasRef.current.style.cursor = 'crosshair';
      }
    }
  }, [config, config?.storyboard?.length, isStarted]);
  
  const keydownEventHandler = React.useCallback((e: KeyboardEvent) => {
    if (!isStarted) return false;
    console.log("Key down", e.key, e.code);

    switch (e.code) {
      case "Numpad9":
      case "Numpad8":
      case "Numpad7":
      case "Numpad6":
      case "Numpad5":
      case "Numpad4":
      case "Numpad3":
      case "Numpad2":
      case "Numpad1":
        if (!eventMadeAtKey[e.code]) {
          const event = StoryboardParser.SBEvent.fromConfig({
            start: Toxen.musicPlayer.media.currentTime,
            end: Toxen.musicPlayer.media.currentTime,
            component: "cornerPulseSingle",
            data: {
              color: hexToRgbArray("#FFFFFF"),
              intensity: 1,
            },
            once: false,
          }, {}, null, false);

          eventMadeAtKey[e.code] = event;

          // Set the corners that are active
          switch (e.code) {
            case "Numpad9":
              event.data.pos_topRight = true;
              break;
            case "Numpad8":
              event.data.pos_topLeft = true;
              event.data.pos_topRight = true;
              break;
            case "Numpad7":
              event.data.pos_topLeft = true;
              break;
            case "Numpad6":
              event.data.pos_topRight = true;
              event.data.pos_bottomRight = true;
              break;
            case "Numpad5":
              event.data.pos_topRight = true;
              event.data.pos_topLeft = true;
              event.data.pos_bottomRight = true;
              event.data.pos_bottomLeft = true;
              break;
            case "Numpad4":
              event.data.pos_topLeft = true;
              event.data.pos_bottomLeft = true;
              break;
            case "Numpad3":
              event.data.pos_bottomRight = true;
              break;
            case "Numpad2":
              event.data.pos_bottomLeft = true;
              event.data.pos_bottomRight = true;
              break;
            case "Numpad1":
              event.data.pos_bottomLeft = true;
              break;
          
            default:
              break;
          }
          config?.storyboard.push(event);
        }
        else {
          const event = eventMadeAtKey[e.code];
          event.endTime = Toxen.musicPlayer.media.currentTime;
        }
        break;
    }
  }, [config, config?.storyboard?.length, isStarted]);
  const keyupEventHandler = React.useCallback((e: KeyboardEvent) => {
    if (!isStarted) return false;
    console.log("Key up", e.key, e.code);
    switch (e.code) {
      case "Numpad9":
      case "Numpad8":
      case "Numpad7":
      case "Numpad6":
      case "Numpad5":
      case "Numpad4":
      case "Numpad3":
      case "Numpad2":
      case "Numpad1":
        if (eventMadeAtKey[e.code]) {
          const event = eventMadeAtKey[e.code];
          event.endTime = Toxen.musicPlayer.media.currentTime;
          eventMadeAtKey[e.code] = null;
        }
        break;
    }
  }, [config, config?.storyboard?.length, isStarted]);

  const scrollEventHandler = React.useCallback((e: WheelEvent) => {
    if (!isStarted) return false;
    if (e.deltaY > 0) {
      Toxen.musicPlayer.media.currentTime += 0.2;
    }
    else {
      Toxen.musicPlayer.media.currentTime -= 0.2;
    }
  }, [config, config?.storyboard?.length, isStarted]);
  
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
            config = StoryboardParser.setStoryboard(config, song);
            setConfig(config);
            _setBpm(config.bpm ?? 120);
            _setBpmOffset(config.bpmOffset ?? 0);
            storyboardRenderer(ctx, config, modals, performance.now());
          });
        }
      }
      setIsStarted(true);

      // Add event listeners
      // canvas.addEventListener("mousemove", mouseEventHandler);
      // canvas.addEventListener("mousedown", mouseEventHandler);
      // canvas.addEventListener("mouseup", mouseEventHandler);

      // window.addEventListener("keydown", keydownEventHandler);
      // window.addEventListener("keyup", keyupEventHandler);
    }
  }, []);
  
  const stop = React.useCallback(() => {
    const canvas = canvasRef.current;
    shouldBeStopped = true;
    setIsStarted(false);
    // canvas.removeEventListener("mousemove", mouseEventHandler);
    // canvas.removeEventListener("mousedown", mouseEventHandler);
    // canvas.removeEventListener("mouseup", mouseEventHandler);

    // window.removeEventListener("keydown", keydownEventHandler);
    // window.removeEventListener("keyup", keyupEventHandler);
  }, []);

  const controller = React.useMemo<StoryboardEditorController>(() => ({
    start,
    stop
  }), [start, stop]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    // Add event listeners
    canvas.addEventListener("mousemove", mouseEventHandler);
    canvas.addEventListener("mousedown", mouseEventHandler);
    canvas.addEventListener("mouseup", mouseEventHandler);
    canvas.addEventListener("wheel", scrollEventHandler);

    window.addEventListener("keydown", keydownEventHandler);
    window.addEventListener("keyup", keyupEventHandler);
    return () => {
      canvas.removeEventListener("mousemove", mouseEventHandler);
      canvas.removeEventListener("mousedown", mouseEventHandler);
      canvas.removeEventListener("mouseup", mouseEventHandler);
      canvas.removeEventListener("wheel", scrollEventHandler);

      window.removeEventListener("keydown", keydownEventHandler);
      window.removeEventListener("keyup", keyupEventHandler);
    }
  }, [config]);
  
  props.controllerSetter?.(controller);
  
  return (
    <div className="storyboard-editor" style={{ display: isStarted ? "" : "none" }}>
      <div className="storyboard-controls">
        <div className="control-group primary-controls">
          <Button 
            leftSection={<i className="fas fa-save" />}
            onClick={() => {
              const saveLocation = song.storyboardFile() || song.dirname("storyboard.tsb");
              StoryboardParser.save(saveLocation, config, song);
              Toxen.notify({
                content: "Storyboard saved",
                expiresIn: 2000
              });
            }}
          >
            Save
          </Button>
          <Button 
            color="red"
            leftSection={<i className="fas fa-stop" />}
            onClick={() => {
              stop();
              Toxen.setMode("Player");
            }}
          >
            Stop
          </Button>
          <Button 
            variant="outline"
            leftSection={<i className="fas fa-step-backward" />}
            onClick={() => {
              Toxen.musicPlayer.pause();
              Toxen.musicPlayer.media.currentTime = bpmOffset / 1000;
            }}
          >
            Goto Start
          </Button>
        </div>
        
        <div className="control-group">
          <NumberInput 
            value={bpm} 
            onChange={(v) => setBpm(+v)} 
            label="BPM"
            min={60}
            max={200}
          />
        </div>
        
        <div className="control-group">
          <NumberInput 
            value={bpmOffset} 
            onChange={(v) => setBpmOffset(+v)} 
            label="BPM Offset (ms)"
          />
          <Button 
            size="xs"
            variant="light"
            onClick={() => {
              setBpmOffset(Toxen.musicPlayer.media.currentTime * 1000);
            }}
          >
            Set to Current Time
          </Button>
        </div>
        
        <div className="control-group timeline-controls">
          <Slider 
            value={speed} 
            onChange={setSpeed} 
            label="Playback Speed" 
            min={0.5} 
            max={2} 
            step={0.1}
            marks={[
              { value: 0.5, label: '0.5x' },
              { value: 1, label: '1x' },
              { value: 1.5, label: '1.5x' },
              { value: 2, label: '2x' }
            ]}
          />
        </div>
        
        <div className="control-group">
          <Button 
            variant="outline"
            leftSection={<i className="fas fa-align-center" />}
            onClick={() => {
              const beat = config.bpm ?? 120;
              const beatOffset = config.bpmOffset ?? 0;
              const currentTime = Toxen.musicPlayer.media.currentTime * 1000;
              const offset = currentTime - beatOffset;
              const interval = (60000 / beat) / 4;
              const fullBeat = Math.floor(offset / interval);
              const nextBeat = (fullBeat + 1) * interval + beatOffset;
              Toxen.musicPlayer.media.currentTime = nextBeat / 1000;
            }}
          >
            Snap to Beat
          </Button>
        </div>
      </div>
      
      <div className="canvas-container">
        <div className="timeline-info">
          <TimelineMarker />
          <div className="time-marker">
            BPM: {bpm} | Offset: {(bpmOffset/1000).toFixed(3)}s
          </div>
        </div>
        <canvas ref={canvasRef} width={1920} height={200} />
      </div>
      
      <div className="help-overlay visible">
        <h4>Quick Controls</h4>
        <div className="shortcut">
          <span>Left Click + Drag</span>
          <span className="key">Select/Create</span>
        </div>
        <div className="shortcut">
          <span>Right Click</span>
          <span className="key">Set Time</span>
        </div>
        <div className="shortcut">
          <span>Middle Click + Drag</span>
          <span className="key">Move Event</span>
        </div>
        <div className="shortcut">
          <span>Numpad 1-9</span>
          <span className="key">Corner Events</span>
        </div>
        <div className="shortcut">
          <span>Mouse Wheel</span>
          <span className="key">Scrub Time</span>
        </div>
      </div>
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
  requestAnimationFrame((t) => storyboardRenderer(ctx, config, modals, t));
  if (!song) return;

  const bpm = config.bpm ?? 120;
  const bpmOffset = config.bpmOffset ?? 0;
  const songTime = (Toxen.musicPlayer.media.currentTime) * 1000;
  const duration = Toxen.musicPlayer.media.duration * 1000;

  const w = ctx.canvas.width, h = ctx.canvas.height;
  const indicatorPos = w * 0.25;
  
  // Enhanced canvas background with subtle gradient and grid
  const bgGradient = ctx.createLinearGradient(0, 0, 0, h);
  bgGradient.addColorStop(0, "rgba(8, 8, 12, 0.1)");
  bgGradient.addColorStop(0.5, "rgba(12, 12, 18, 0.05)");
  bgGradient.addColorStop(1, "rgba(8, 8, 12, 0.1)");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, w, h);
  
  // Subtle grid pattern for better visual alignment
  ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
  ctx.lineWidth = 1;
  ctx.setLineDash([1, 3]);
  
  // Vertical grid lines every 100px
  for (let x = 0; x < w; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  
  // Horizontal grid lines every 40px
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  
  ctx.setLineDash([]); // Reset line dash
  
  // Subtle border with accent color
  ctx.strokeStyle = "rgba(var(--accent-color-rgb, 255, 64, 129), 0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, w, h);

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

  
  // Display intervals based on BPM with enhanced styling
  const intervalFull = 60000 / bpm;
  const intervalsFull = (w / intervalFull) + 2;
  const intervalQuarter = intervalFull / 4;
  const intervalsQuarter = (w / intervalQuarter) + 2;
  const offset = (songTime - bpmOffset) % intervalFull;
  const offsetPos = indicatorPos % intervalFull;
  
  const quarterBeatPositions: number[] = [];
  
  // Quarter beat markers (subtle)
  ctx.save();
  for (let i = 1; i < intervalsQuarter; i++) {
    const pos = offsetPos + i * intervalQuarter - offset - (intervalQuarter * 2);
    if (pos >= 0 && pos <= w) {
      // Gradient for quarter beats
      const gradient = ctx.createLinearGradient(pos, 0, pos, h * 0.3);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(pos - 0.5, 0, 1, h * 0.3);
      quarterBeatPositions.push(pos);
    }
  }
  
  // Full beat markers (more prominent)
  for (let i = 1; i < intervalsFull; i++) {
    const pos = offsetPos + i * intervalFull - offset - (intervalFull * 2);
    if (pos >= 0 && pos <= w) {
      // Enhanced gradient for full beats
      const gradient = ctx.createLinearGradient(pos, 0, pos, h * 0.4);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
      gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.2)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0.1)");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(pos - 1, 0, 2, h * 0.4);
      
      // Beat number indicator
      const beatNumber = Math.floor((songTime - bpmOffset + i * intervalFull) / intervalFull) + 1;
      if (beatNumber > 0) {
        ctx.font = "600 10px 'Segoe UI', system-ui, sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.textAlign = "center";
        ctx.fillText(beatNumber.toString(), pos, 16);
      }
    }
  }
  ctx.restore();

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
  
  // Enhanced selection area rendering
  if (selectStart && !selectedEvent.event) {
    const end = selectEnd ?? currentMousePos;
    const selectionWidth = end.x - selectStart.x;
    const selectionHeight = end.y - selectStart.y;
    
    if (Math.abs(selectionWidth) > 5) { // Only show if meaningful selection
      ctx.save();
      
      // Selection background with gradient
      const selectionGradient = ctx.createLinearGradient(selectStart.x, selectStart.y, end.x, end.y);
      selectionGradient.addColorStop(0, "rgba(64, 169, 255, 0.2)");
      selectionGradient.addColorStop(1, "rgba(64, 169, 255, 0.1)");
      
      ctx.fillStyle = selectionGradient;
      ctx.fillRect(selectStart.x, selectStart.y, selectionWidth, selectionHeight);
      
      // Selection border with animated dashes
      ctx.strokeStyle = "rgba(64, 169, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.lineDashOffset = -(Date.now() / 50) % 12; // Animated dash offset
      ctx.strokeRect(selectStart.x, selectStart.y, selectionWidth, selectionHeight);
      
      // Corner indicators
      const cornerSize = 6;
      ctx.fillStyle = "rgba(64, 169, 255, 0.9)";
      ctx.fillRect(selectStart.x - cornerSize/2, selectStart.y - cornerSize/2, cornerSize, cornerSize);
      ctx.fillRect(end.x - cornerSize/2, end.y - cornerSize/2, cornerSize, cornerSize);
      
      ctx.restore();
    }
  }

  // Draw all events on the timeline at the appropriate time
  const visibleEvents: [StoryboardParser.SBEvent, number, number, number, number][] = [];
  let hPosOffset = 0;
  const visibleStoryboard = config.storyboard.filter((event) => {
    const startTime = event.startTime * 1000;
    const endTime = event.endTime * 1000;
    return startTime - songTime <= 2000 && endTime - songTime >= -2000;
  });
  const eventH = Math.max(24, h / (visibleStoryboard.length + 1)); // Minimum height for readability
  const eventMargin = 2;
  const cornerRadius = 6;
  
  ctx.save();
  visibleStoryboard.forEach((event, i) => {
    const startTime = event.startTime * 1000;
    const endTime = event.endTime * 1000;
    if (startTime - songTime > 2000) return;
    if (endTime - songTime < -2000) return;
    
    const xStart = indicatorPos + (startTime - songTime);
    const yStart = i * eventH + eventMargin;
    const xEnd = xStart + endTime - startTime;
    const yEnd = yStart + eventH - (eventMargin * 2);
    const width = Math.max(20, xEnd - xStart); // Minimum width for visibility
    const height = eventH - (eventMargin * 2);

    // Determine event color based on component type with more sophisticated mapping
    let primaryColor = [255, 64, 129]; // Default pink/accent color
    let alpha = 0.8;
    
    if (event.component === "visualizerColor") {
      const color = (event.data.color ?? [255, 255, 255]) as [number, number, number];
      primaryColor = color;
    } else if (event.component?.includes("corner")) {
      primaryColor = [124, 77, 255]; // Purple for corner events
    } else if (event.component?.includes("flash") || event.component?.includes("strobe")) {
      primaryColor = [255, 193, 7]; // Yellow for flash events
    } else if (event.component?.includes("background") || event.component?.includes("bg")) {
      primaryColor = [76, 175, 80]; // Green for background events
    } else if (event.component?.includes("fade") || event.component?.includes("transition")) {
      primaryColor = [33, 150, 243]; // Blue for transition events
    } else if (event.component?.includes("pulse") || event.component?.includes("beat")) {
      primaryColor = [255, 87, 34]; // Orange for pulse/beat events
    } else if (event.component?.includes("particle") || event.component?.includes("effect")) {
      primaryColor = [156, 39, 176]; // Deep purple for particle effects
    } else if (event.component?.includes("text") || event.component?.includes("subtitle")) {
      primaryColor = [0, 188, 212]; // Cyan for text events
    }

    // Check if event is hovered
    const isHovered = currentMousePos.y >= yStart && currentMousePos.y <= yEnd + (eventMargin * 2) && 
                     currentMousePos.x >= xStart - eventBorderSelectSize && currentMousePos.x <= xEnd + eventBorderSelectSize;
    const isEdgeHovered = isHovered && (Math.abs(xStart - currentMousePos.x) < eventBorderSelectSize || Math.abs(xEnd - currentMousePos.x) < eventBorderSelectSize);

    // Create gradient for event bar
    const gradient = ctx.createLinearGradient(xStart, yStart, xStart, yStart + height);
    if (isHovered) {
      gradient.addColorStop(0, `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, ${alpha + 0.2})`);
      gradient.addColorStop(0.5, `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, ${alpha})`);
      gradient.addColorStop(1, `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, ${alpha - 0.2})`);
    } else {
      gradient.addColorStop(0, `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, ${alpha - 0.2})`);
      gradient.addColorStop(0.5, `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, ${alpha - 0.4})`);
      gradient.addColorStop(1, `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, ${alpha - 0.2})`);
    }

    // Drop shadow
    ctx.shadowColor = `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, 0.4)`;
    ctx.shadowBlur = isHovered ? 12 : 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isHovered ? 4 : 2;

    // Draw rounded rectangle
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(xStart, yStart, width, height, cornerRadius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Border styling
    if (isHovered) {
      ctx.strokeStyle = isEdgeHovered ? 
        `rgba(64, 169, 255, 0.9)` : // Blue for edge resize
        `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, 1)`;
      ctx.lineWidth = isEdgeHovered ? 3 : 2;
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.roundRect(xStart, yStart, width, height, cornerRadius);
      ctx.stroke();
      
      // Edge indicators for resizing
      if (isEdgeHovered) {
        ctx.fillStyle = `rgba(64, 169, 255, 0.9)`;
        if (Math.abs(xStart - currentMousePos.x) < eventBorderSelectSize) {
          // Left edge indicator
          ctx.beginPath();
          ctx.roundRect(xStart - 2, yStart, 4, height, 2);
          ctx.fill();
        }
        if (Math.abs(xEnd - currentMousePos.x) < eventBorderSelectSize) {
          // Right edge indicator
          ctx.beginPath();
          ctx.roundRect(xEnd - 2, yStart, 4, height, 2);
          ctx.fill();
        }
      }
    } else {
      // Subtle border for non-hovered events
      ctx.strokeStyle = `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, 0.3)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(xStart, yStart, width, height, cornerRadius);
      ctx.stroke();
    }

    visibleEvents.push([event, xStart, xEnd, yStart, yEnd + (eventMargin * 2)]);

    // Enhanced text rendering
    const componentName = StoryboardParser.components?.[event.component]?.name ?? event.component;
    const maxFontSize = Math.min(height - 6, 14);
    const fontSize = Math.max(10, maxFontSize);
    
    ctx.font = `600 ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // Text with better contrast
    const textX = xStart + 8;
    const textY = yStart + height / 2;
    
    // Text shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(componentName, textX, textY);
    
    // Reset text shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Duration indicator for longer events
    if (width > 80) {
      const duration = (endTime - startTime) / 1000;
      const durationText = duration >= 1 ? `${duration.toFixed(1)}s` : `${(duration * 1000).toFixed(0)}ms`;
      
      ctx.font = `400 ${Math.max(9, fontSize - 2)}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'right';
      
      const durationX = xStart + width - 8;
      ctx.fillText(durationText, durationX, textY);
    }
    
    // Type indicator badge for events with sufficient width
    if (width > 120) {
      let categoryText = '';
      if (event.component?.includes("corner")) categoryText = 'CORNER';
      else if (event.component?.includes("flash")) categoryText = 'FLASH';
      else if (event.component?.includes("background")) categoryText = 'BG';
      else if (event.component?.includes("fade")) categoryText = 'FADE';
      else if (event.component?.includes("pulse")) categoryText = 'PULSE';
      else if (event.component?.includes("particle")) categoryText = 'FX';
      else if (event.component?.includes("text")) categoryText = 'TEXT';
      
      if (categoryText) {
        ctx.save();
        const badgeX = xStart + 8;
        const badgeY = yStart + 4;
        const badgeWidth = 32;
        const badgeHeight = 12;
        
        // Badge background
        ctx.fillStyle = `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, 0.8)`;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
        ctx.fill();
        
        // Badge text
        ctx.font = '700 7px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(categoryText, badgeX + badgeWidth/2, badgeY + badgeHeight/2);
        
        ctx.restore();
      }
    }
    
    // Reset text alignment
    ctx.textAlign = 'left';
  });
  ctx.restore();

  // Enhanced current time indicator
  ctx.save();
  
  // Main indicator line with gradient
  const indicatorGradient = ctx.createLinearGradient(indicatorPos, 0, indicatorPos, h);
  indicatorGradient.addColorStop(0, "rgba(255, 64, 129, 1)"); // Accent color
  indicatorGradient.addColorStop(0.7, "rgba(255, 64, 129, 0.8)");
  indicatorGradient.addColorStop(1, "rgba(255, 64, 129, 0.4)");
  
  ctx.fillStyle = indicatorGradient;
  ctx.fillRect(indicatorPos - 1, 0, 2, h);
  
  // Indicator head (triangle at top)
  ctx.fillStyle = "rgba(255, 64, 129, 1)";
  ctx.beginPath();
  ctx.moveTo(indicatorPos, 0);
  ctx.lineTo(indicatorPos - 6, -12);
  ctx.lineTo(indicatorPos + 6, -12);
  ctx.closePath();
  ctx.fill();
  
  // Subtle glow effect
  ctx.shadowColor = "rgba(255, 64, 129, 0.6)";
  ctx.shadowBlur = 8;
  ctx.fillRect(indicatorPos - 0.5, 0, 1, h);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  
  ctx.restore();

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
            StoryboardParser.setStoryboard(config, song);
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

// Real-time timeline marker component that updates frequently
function TimelineMarker() {
  const [currentTime, setCurrentTime] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  
  React.useEffect(() => {
    const updateCurrentTime = () => {
      if (Toxen.musicPlayer?.media) {
        const newTime = Toxen.musicPlayer.media.currentTime;
        const newIsPlaying = !Toxen.musicPlayer.media.paused;
        
        setCurrentTime(newTime);
        setIsPlaying(newIsPlaying);
      }
    };
    
    // Update immediately
    updateCurrentTime();
    
    // Set up frequent updates (60fps for smooth timeline updates when playing)
    let interval: NodeJS.Timeout;
    const startInterval = () => {
      interval = setInterval(updateCurrentTime, 16);
    };
    
    // Only update frequently when playing, less frequently when paused
    const updateInterval = () => {
      if (interval) clearInterval(interval);
      
      if (Toxen.musicPlayer?.media && !Toxen.musicPlayer.media.paused) {
        startInterval();
      } else {
        // Update every 100ms when paused (still responsive but less CPU intensive)
        interval = setInterval(updateCurrentTime, 100);
      }
    };
    
    updateInterval();
    
    // Listen to play/pause events to adjust update frequency
    const mediaElement = Toxen.musicPlayer?.media;
    if (mediaElement) {
      mediaElement.addEventListener('timeupdate', updateCurrentTime);
      mediaElement.addEventListener('play', updateInterval);
      mediaElement.addEventListener('pause', updateInterval);
      mediaElement.addEventListener('seeked', updateCurrentTime);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (mediaElement) {
        mediaElement.removeEventListener('timeupdate', updateCurrentTime);
        mediaElement.removeEventListener('play', updateInterval);
        mediaElement.removeEventListener('pause', updateInterval);
        mediaElement.removeEventListener('seeked', updateCurrentTime);
      }
    };
  }, []);
  
  const formattedTime = currentTime ? 
    new Time(currentTime * 1000).toTimestamp(Time.FORMATS.STANDARD_WITH_MS) 
    : "00:00.000";
  
  return (
    <div className="time-marker">
      <span className="playback-indicator">
        {isPlaying ? '▶️' : '⏸️'}
      </span>
      Timeline: {formattedTime}
    </div>
  );
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
          <BackgroundFileSelector
            label={dataName + (required ? " *" : "")}
            defaultValue={value as string}
            sourceDir={Toxen.editingSong?.dirname()}
            description={description}
            onChange={(selectedValue) => {
              setValue(event.data[dataId] = selectedValue as string);
            }}
          />
        </div>
      </>
    );

    default:
      return (<></>);
  }
}
