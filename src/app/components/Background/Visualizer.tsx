import React, { Component } from 'react';
import Settings, { VisualizerStyle } from '../../toxen/Settings';
import { Toxen } from '../../ToxenApp';
import Path from "path";
import "./Visualizer.scss";
import System from '../../toxen/System';
//@ts-expect-error 
import txnLogo from "../../../icons/toxen.png";
import { hexToRgb, rgbToHex } from '../Form/FormInputFields/FormInputColorPicker';
import StoryboardParser from '../../toxen/StoryboardParser';
import HueManager from '../../toxen/philipshue/HueManager';
import MathX from '../../toxen/MathX';
import { ISong } from '../../toxen/Song';

const imgSize = 256;
const toxenLogo = new Image(imgSize, imgSize);
toxenLogo.src = txnLogo;

interface VisualizerProps { }

interface VisualizerState { }

export default class Visualizer extends Component<VisualizerProps, VisualizerState> {
  constructor(props: VisualizerProps) {
    super(props);
    this.state = {};
  }

  private lastColor: string = "";
  private lastBackground: string = "";
  private curLen: number = 0;
  /**
   * Dynamic dim for the background of the visualizer.
   */
  private dynamicDim = 0;
  public getDynamicDim() {
    return this.dynamicDim;
  }
  private loop(time: number) {
    if (!this.stopped) requestAnimationFrame(this.loop.bind(this));
    if (!this.ctx) return console.log("No ctx exist!");
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!Toxen.musicPlayer || !Toxen.musicPlayer.media) return console.log("Player or media missing");

    const ctx = this.ctx;

    const storyboardCallbacks = StoryboardParser.drawStoryboard(ctx, {
      currentSongTime: Toxen.musicPlayer.media.currentTime,
      songDuration: Toxen.musicPlayer.media.duration,
      isPaused: Toxen.musicPlayer.media.paused,
    });

    let storedColor = Toxen.background.storyboard.getVisualizerColor();
    const baseBackgroundDim = (Toxen.background.storyboard.getBackgroundDim() ?? 50) / 100; // Base opacity of the background.
    const storedColorAsRGB = hexToRgb(storedColor);
    let usedDimColor: string;
    if (Toxen.background.storyboard.getDynamicLighting()) {
      this.ctx.fillStyle = usedDimColor = this.dynamicDim >= 0 ? `rgba(0,0,0,${this.dynamicDim})`
        : `rgba(${storedColorAsRGB.r},${storedColorAsRGB.g},${storedColorAsRGB.b},${-this.dynamicDim / 2})`;
      // this.ctx.fillStyle = `rgba(0,0,0,${this.dynamicDim >= 0 ? this.dynamicDim : baseBackgroundDim})` // Disable dynamic lighting for now.
    }
    else {
      this.ctx.fillStyle = usedDimColor = `rgba(0,0,0,${baseBackgroundDim})`;
    }
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); // Background dim

    storedColor = Toxen.background.storyboard.getVisualizerColor();
    if (this.lastColor !== storedColor) {
      Toxen.musicControls.progressBar.setFillColor(storedColor);
    }
    this.lastColor = storedColor ?? this.lastColor;
    const backgroundFile = Toxen.background.storyboard.getBackground();
    if (this.lastBackground !== backgroundFile) {
      this.lastBackground = backgroundFile;
      if (backgroundFile) {
        const img = new Image();
        const fullFile = Toxen.background.storyboard.getBackground(true);
        img.src = fullFile;
        img.onload = () => {
          Toxen.background.setBackground(img.src);
        }
      }
      else {
        Toxen.background.setBackground(null);
      }
    }

    const style = Toxen.background.storyboard.getVisualizerStyle();
    const intensityMultiplier = Toxen.background.storyboard.getVisualizerIntensity();

    ctx.fillStyle = ctx.strokeStyle = storedColor;
    // let dimLowHigh = 1.25 - this.dynamicDim;
    // ctx.fillStyle = ctx.strokeStyle = rgbToHex({
    //   r: Math.min(255, Math.round(storedColorAsRGB.r * dimLowHigh)),
    //   g: Math.min(255, Math.round(storedColorAsRGB.g * dimLowHigh)),
    //   b: Math.min(255, Math.round(storedColorAsRGB.b * dimLowHigh)),
    // });
    let [vWidth, vHeight, vLeft, vTop] = [
      this.canvas.width,
      this.canvas.height,
      this.left,
      this.top
    ];

    const dataSize = 255;

    let dataArray = this.getFrequencyData(
      Settings.get("fftSize") ? Math.pow(2, Settings.get("fftSize") + 4) : Visualizer.DEFAULT_FFTSIZE
    ).reverse();
    // dataArray = dataArray.filter((_, i) => i >= (dataArray.length / 2));
    dataArray = dataArray.slice(dataArray.length / 2);


    // Shuffle the array to make it look more random.
    if (
      (Settings.get("visualizerShuffle") ?? false) &&
      Settings.get("visualizerStyle") !== VisualizerStyle.Waveform
    ) {
      let seed = 1;
      // Seeded pseudo-random number generator.
      function random() {
        var x = Math.sin(seed++) * dataArray.length;
        return x - Math.floor(x);
      }
      for (let i = dataArray.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [dataArray[i], dataArray[j]] = [dataArray[j], dataArray[i]];
      }
    }

    const len = this.curLen = dataArray.length;
    const power = (1 / (Settings.get("volume") / 100));
    const getMaxHeight = (multipler?: number) => (intensityMultiplier * vHeight * (multipler ?? 1)) ^ power ^ power
    const getMaxWidth = (multipler?: number) => (intensityMultiplier * vWidth * (multipler ?? 1)) ^ power ^ power


    const opacity = 0.7; // Opacity of the visualizer bars.

    const dynLight = (() => {
      const maxHeight = getMaxHeight(0.3) || 1;
      const unitH = maxHeight / dataSize;
      let averageHeight = 0;
      for (let i = 0; i < len; i++) {
        const data = dataArray[i];
        averageHeight += (data * unitH);
      }

      averageHeight /= len;
      averageHeight = Math.min(averageHeight, maxHeight);
      return (averageHeight / maxHeight);
    })();;

    this.dynamicDim = baseBackgroundDim - dynLight;

    const pulseEnabled = Toxen.background.storyboard.getVisualizerPulseBackground();

    Toxen.background.updateDimScale(pulseEnabled ? dynLight : 0);

    try { HueManager.transition(); } catch (error) { }

    // if (style === VisualizerStyle.None && !Settings.get("backgroundDynamicLighting")) return;
    if (style !== VisualizerStyle.None) {
      let useLogo = false;
      switch (style) {
        default:
        case VisualizerStyle.ProgressBar: { // Progress bar is default.
          vHeight = Toxen.musicControls.progressBar.progressBarObject.getBoundingClientRect().top;
          vLeft = Toxen.musicControls.progressBar.progressBarObject.getBoundingClientRect().left;
          const maxHeight = getMaxHeight(0.30);
          const unitW = ((vWidth - 20 /* Progress bar curve */) - (vLeft * 2)) / len;
          const unitH = maxHeight / dataSize;
          for (let i = 0; i < len; i++) {
            const data = dataArray[i];
            const _barHeight = (data * unitH);
            // Position and size
            const [barX, barY, barWidth, barHeight] = [
              (i * unitW) + vLeft + 10 /* Progress bar curve */, // barX
              vHeight - _barHeight - vTop, // barY
              unitW, // barWidth
              _barHeight // barHeight
            ];

            // If rainbow:
            this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
              top: false,
              bottom: true
            });

            this.ctxAlpha(opacity, ctx => {
              ctx.fillRect(barX, barY, barWidth, barHeight); // Draw basic visualizer
            });
          }
          break;
        }

        case VisualizerStyle.Bottom: {
          const maxHeight = getMaxHeight(0.30);
          const unitW = vWidth / len;
          const unitH = maxHeight / dataSize;
          for (let i = 0; i < len; i++) {
            const data = dataArray[i];
            const _barHeight = (data * unitH);
            // Position and size
            const [barX, barY, barWidth, barHeight] = [
              (i * unitW), // barX
              vHeight - _barHeight, // barY
              unitW, // barWidth
              _barHeight // barHeight
            ];

            // If rainbow:
            this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
              top: false,
              bottom: true
            });

            this.ctxAlpha(opacity, ctx => {
              ctx.fillRect(barX, barY, barWidth, barHeight); // Bottom visuals
            });
          }
          break;
        }

        case VisualizerStyle.Top: {
          const maxHeight = getMaxHeight(0.30);
          const unitW = vWidth / len;
          const unitH = maxHeight / dataSize;
          for (let i = 0; i < len; i++) {
            const data = dataArray[i];
            const _barHeight = (data * unitH);
            // Position and size
            const [barX, barY, barWidth, barHeight] = [
              (i * unitW), // barX
              0, // barY
              unitW, // barWidth
              _barHeight // barHeight
            ];

            // If rainbow:
            this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
              top: true,
              bottom: false
            });

            this.ctxAlpha(opacity, ctx => {
              ctx.fillRect(barX, barY, barWidth, barHeight); // Top visuals
            });
          }
          break;
        }

        // Visualizer on the top and bottom
        case VisualizerStyle.TopAndBottom: {
          const maxHeight = getMaxHeight(0.30);
          const unitW = vWidth / len;
          const unitH = maxHeight / dataSize;
          for (let i = 0; i < len; i++) {
            const data = dataArray[i];
            const _barHeight = (data * unitH);
            // Position and size
            const [barX, barY, barWidth, barHeight] = [
              (i * unitW), // barX
              vHeight - _barHeight, // barY
              unitW, // barWidth
              _barHeight // barHeight
            ];

            this.ctxAlpha(opacity, ctx => {
              this.setRainbowIfEnabled(ctx, barX, 0, barWidth, barHeight, i, null, {
                top: true,
                bottom: false
              });
              ctx.fillRect(barX, 0, barWidth, barHeight); // Top visuals
              this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
                top: false,
                bottom: true
              });
              ctx.fillRect(barX, barY, barWidth, barHeight); // Bottom visuals
            });
          }
          break;
        }

        // Visualizer on the left and right
        case VisualizerStyle.Sides: {
          const maxWidth = getMaxWidth(0.15);
          const unitH = vHeight / (dataSize / 2);
          const halfLen = len / 2;
          const unitW = maxWidth / len;

          for (let i = 0; i < len; i++) {
            const data = dataArray[i];
            let _barWidth = (data * unitW);
            _barWidth += _barWidth / 2;
            // Position and size
            const [barX, barY, barWidth, barHeight] = [
              0, // barX
              (i * unitH), // barY
              _barWidth, // barWidth
              unitH // barHeight
            ];

            this.ctxAlpha(opacity, ctx => {

              if (i % 2 === 0) {
                this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
                  top: false,
                  bottom: false
                });
                ctx.fillRect(barX, barY / 2, barWidth, barHeight); // Left
              }
              else {
                this.setRainbowIfEnabled(ctx, barX + barWidth, barY, barWidth, barHeight, i, null, {
                  top: false,
                  bottom: false
                });
                ctx.fillRect(vWidth - barWidth, barY / 2, barWidth, barHeight); // Right
              }
            });
          }
        }
          break;

        case VisualizerStyle.Center: {
          const maxHeight = getMaxHeight(0.25);
          const unitW = vWidth / len;
          const unitH = maxHeight / dataSize;
          for (let i = 0; i < len; i++) {
            const data = dataArray[i];
            const _barHeight = (data * unitH);
            // Position and size
            const [barX, barY, barWidth, barHeight] = [
              (i * unitW), // barX
              (vHeight / 2) - _barHeight, // barY
              unitW, // barWidth
              _barHeight * 2 // barHeight
            ];

            // If rainbow:
            this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i);


            this.ctxAlpha(opacity, ctx => {
              ctx.fillRect(barX, barY, barWidth, barHeight); // Draw basic visualizer
            });
          }
          break;
        }

        case VisualizerStyle.SingularityWithLogo:
          // Use logo if SingularityWithLogo is selected, and fall through into the regular Singularity.
          useLogo = true;
        case VisualizerStyle.Singularity: {
          let cycleIncrementer = 360 / len;
          const maxHeight = getMaxHeight(0.50);
          // let smallestHeight = maxHeight;
          let smallestHeight = 0;
          const unitH = maxHeight / dataSize;
          const unitW = (vWidth * 1.25 + unitH) / len;
          // const unitW = unitH * 5;
          for (let i = 0; i < len; i++) {
            const data = dataArray[i];
            const _barHeight = (data * unitH);
            // Position and size
            const [barX, barY, barWidth, barHeight] = this.getBar(
              (vWidth / 2) - (unitW / 2) /* Progress bar curve */, // barX
              (vHeight / 2), // barY
              unitW, // barWidth
              _barHeight // barHeight
            );

            smallestHeight += barHeight;
            // If rainbow:
            this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, cycleIncrementer);

            this.ctxAlpha(opacity, ctx => {
              ctx.save();
              // ctx.setTransform(1, 0, 0, 1, barX + 11, barY - 132);
              ctx.setTransform(1, 0, 0, 1, barX, barY);
              ctx.rotate((cycleIncrementer * i + (time / 20000)) * Math.PI);
              // ctx.fillRect(-(unitW / 2), 128, barWidth, barHeight); // Draw basic visualizer
              ctx.fillRect(-(unitW / 2), 0, barWidth, barHeight); // Draw basic visualizer
              ctx.restore();
            });
          }

          if (useLogo) {
            smallestHeight /= len;
            smallestHeight *= 1.5;
            // smallestHeight += 128;
            this.ctxAlpha(opacity, ctx => {
              if (toxenLogo.complete) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, (vWidth / 2) - imgSize, (vHeight / 2) - imgSize);
                ctx.drawImage(toxenLogo,
                  0,
                  0,

                  imgSize,
                  imgSize,

                  imgSize - smallestHeight / 2,
                  imgSize - smallestHeight / 2,

                  smallestHeight,
                  smallestHeight
                );
                ctx.restore();
              }
            })
          }
          break;
        }

        case VisualizerStyle.MirroredSingularityWithLogo:
          // Use logo if MirroredSingularityWithLogo is selected, and fall through into the regular MirroredSingularity.
          useLogo = true;
        case VisualizerStyle.MirroredSingularity: {
          let newData = dataArray.filter(d => d > 0);
          const len = newData.length;
          let cycleIncrementer = 180 / len;
          const maxHeight = getMaxHeight(0.50);
          // let smallestHeight = maxHeight;
          let smallestHeight = 0;
          const unitH = maxHeight / dataSize;
          const unitW = (vWidth * 1.25 + unitH) / len;
          // const unitW = unitH * 5;
          for (let i = 0; i < len; i++) {
            const data = newData[i];
            const _barHeight = (data * unitH);
            // Position and size
            const [barX, barY, barWidth, barHeight] = this.getBar(
              (vWidth / 2) - (unitW / 2) /* Progress bar curve */, // barX
              (vHeight / 2), // barY
              unitW, // barWidth
              _barHeight // barHeight
            );

            smallestHeight += barHeight;
            // If rainbow:
            this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, cycleIncrementer);

            this.ctxAlpha(opacity, ctx => {
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, barX, barY);
              ctx.rotate(((cycleIncrementer * (Math.PI / 180)) * i));
              ctx.fillRect(-(unitW / 2), 0, barWidth, barHeight); // Draw basic visualizer
              ctx.restore();
            });
            this.ctxAlpha(opacity, ctx => {
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, barX, barY);
              ctx.rotate(0 - ((cycleIncrementer * (Math.PI / 180)) * i));
              ctx.fillRect(-(unitW / 2), 0, barWidth, barHeight); // Draw basic visualizer
              ctx.restore();
            });
          }

          if (useLogo) {
            smallestHeight /= len;
            smallestHeight *= 1.5;
            // smallestHeight += 128;
            this.ctxAlpha(opacity, ctx => {
              if (toxenLogo.complete) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, (vWidth / 2) - imgSize, (vHeight / 2) - imgSize);
                ctx.drawImage(toxenLogo,
                  0,
                  0,

                  imgSize,
                  imgSize,

                  imgSize - smallestHeight / 2,
                  imgSize - smallestHeight / 2,

                  smallestHeight,
                  smallestHeight
                );
                ctx.restore();
              }
            })
          }
          break;
        }
        case VisualizerStyle.Waveform: {
          // Generate a smooth waveform between the higest points of each bar.
          const maxHeight = getMaxHeight(0.25);
          const unitW = vWidth / len;
          const unitH = maxHeight / dataSize;
          // const centerY = (vHeight / 4) * 3;
          const centerY = (vHeight / 2);
          for (let i = 0; i < len; i++) {
            const data = dataArray[i];
            const _barHeight = Math.max(1, data * unitH);
            // Position and size
            const [barX, barY, barWidth, barHeight] = [
              (i * unitW), // barX
              centerY - _barHeight, // barY
              unitW, // barWidth
              _barHeight * 2 // barHeight
            ];

            const nextData = dataArray[i + 1];

            if (typeof nextData === "number") {
              const nextBarHeight = (nextData * unitH);
              const nextBarY = centerY - nextBarHeight;
              const nextBarX = ((i + 1) * unitW);
              const nextBarWidth = unitW;

              // If rainbow:
              this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i);

              ctx.save();
              ctx.beginPath();
              this.ctxAlpha(opacity, ctx => {
                ctx.moveTo(barX, barY);
                ctx.lineTo(nextBarX, nextBarY);
                ctx.lineTo(nextBarX + nextBarWidth, nextBarY);
                ctx.lineTo(barX + barWidth, barY);
                // ctx.closePath();
                // ctx.fill();
                // ctx.restore();
                // Downward
                const _barY = centerY + _barHeight;
                const _nextBarY = centerY + nextBarHeight;
                // ctx.save();
                // ctx.beginPath();
                ctx.moveTo(barX, _barY);
                ctx.lineTo(nextBarX, _nextBarY);
                ctx.lineTo(nextBarX + nextBarWidth, _nextBarY);
                ctx.lineTo(barX + barWidth, _barY);
              });
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
          }
          break;
        }
        // case VisualizerStyle.WaveformCircle: {
        //   // Combination of Waveform and singularity. Generates a smooth waveform between the higest points of each bar.
        //   const cycleIncrementer = 360 / len;
        //   const uniteLength = len / 360;
        //   const maxHeight = getMaxHeight(0.50);
        //   // let smallestHeight = maxHeight;
        //   const unitH = maxHeight / dataSize;
        //   const unitW = (vWidth * 1.25 + unitH) / len;
        //   const centerY = (vHeight / 2);
        //   for (let i = 0; i < len; i++) {
        //     const data = dataArray[i];
        //     const _barHeight = (data * unitH);
        //     // Position and size
        //     const [barX, barY, barWidth, barHeight] = this.getBar(
        //       (vWidth / 2) - (unitW / 2) /* Progress bar curve */, // barX
        //       (vHeight / 2), // barY
        //       unitW, // barWidth
        //       _barHeight // barHeight
        //     );

        //     // If rainbow:
        //     this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, cycleIncrementer);

        //     this.ctxAlpha(opacity, ctx => {
        //       const radian = (cycleIncrementer * i) * (Math.PI / 180);
        //       ctx.save();
        //       // ctx.setTransform(1, 0, 0, 1, barX + 11, barY - 132);
        //       ctx.setTransform(1, 0, 0, 1, barX, barY);
        //       ctx.rotate(radian + (time / 20000));
        //       // ctx.fillRect(-(unitW / 2), 128, barWidth, barHeight); // Draw basic visualizer
        //       ctx.fillRect(-(unitW / 2), 0, barWidth, barHeight); // Draw basic visualizer
        //       ctx.restore();
        //     });
        //   }
        //   break;
        // }
      }
    }

    // Add floating title if enabled
    const enabled = Toxen.background.storyboard?.getFloatingTitle();
    const underline = Toxen.background.storyboard?.getFloatingTitleUnderline();
    const reactive = Toxen.background.storyboard?.getFloatingTitleReactive();
    const overrideVisualizer = Toxen.background.storyboard?.getFloatingTitleOverrideVisualizer();
    const song = Toxen.background.storyboard?.getSong();
    if (enabled && song) {
      let shouldOverride = overrideVisualizer;
      const title = Toxen.background.storyboard?.getFloatingTitleText();
      const _fontSize = 48 * (vWidth / 1280);
      const fontSize = MathX.clamp(reactive ? _fontSize + (_fontSize - (_fontSize * this.dynamicDim * 2)) : _fontSize, _fontSize, _fontSize * 2);
      // const font = `${fontSize}px Calibri`;
      const font = `${fontSize}px Calibri Light`; // TODO: Make this a setting and customizable font
      const fontColor = this.lastColor ?? '#fff';
      const textWidth = ctx.measureText(title).width;
      const textHeight = fontSize;

      let textX: number;
      let textY: number;
      // let boxY: number;

      type TextPosition = ISong["floatingTitlePosition"];

      const position: TextPosition = Toxen.background.storyboard?.getFloatingTitlePosition() ?? "center";
      const isCenterType = style === VisualizerStyle.Center || style === VisualizerStyle.Waveform;
      const margin = 16;
      switch (position) {
        default: // Also center
          textX = (vWidth / 2) - (textWidth / 2);
          textY = (vHeight / 2) + (textHeight / 4); // It works don't touch
          // boxY = (vHeight / 2) - (textHeight / 2);

          shouldOverride = isCenterType;
          break;

        case "left":
          textX = margin;
          textY = (vHeight / 2) + (textHeight / 4);
          // boxY = (vHeight / 2) - (textHeight / 2);

          shouldOverride = isCenterType || style === VisualizerStyle.Sides;
          break;

        case "right":
          textX = vWidth - textWidth - margin;
          textY = (vHeight / 2) + (textHeight / 4);
          // boxY = (vHeight / 2) - (textHeight / 2);

          shouldOverride = isCenterType || style === VisualizerStyle.Sides;
          break;

        case "top":
          textX = (vWidth / 2) - (textWidth / 2);
          textY = textHeight;
          // boxY = 0;

          shouldOverride = style === VisualizerStyle.Top || style === VisualizerStyle.TopAndBottom;
          break;

        case "bottom":
          textX = (vWidth / 2) - (textWidth / 2);
          textY = vHeight - (textHeight / 2);
          // boxY = vHeight - textHeight;

          shouldOverride = style === VisualizerStyle.Bottom || style === VisualizerStyle.TopAndBottom || style === VisualizerStyle.ProgressBar;
          break;

        case "top-left":
          textX = margin;
          textY = textHeight;
          // boxY = 0;

          shouldOverride = style === VisualizerStyle.Top || style === VisualizerStyle.TopAndBottom || style === VisualizerStyle.Sides;
          break;

        case "top-right":
          textX = vWidth - textWidth - margin;
          textY = textHeight;
          // boxY = 0;

          shouldOverride = style === VisualizerStyle.Top || style === VisualizerStyle.TopAndBottom || style === VisualizerStyle.Sides;
          break;

        case "bottom-left":
          textX = margin;
          textY = vHeight - (textHeight / 2);
          // boxY = vHeight - textHeight;

          shouldOverride = style === VisualizerStyle.Bottom || style === VisualizerStyle.TopAndBottom || style === VisualizerStyle.ProgressBar || style === VisualizerStyle.Sides;
          break;

        case "bottom-right":
          textX = vWidth - textWidth - margin;
          textY = vHeight - (textHeight / 2);
          // boxY = vHeight - textHeight;

          shouldOverride = style === VisualizerStyle.Bottom || style === VisualizerStyle.TopAndBottom || style === VisualizerStyle.ProgressBar || style === VisualizerStyle.Sides;
          break;
      }

      // Before drawing, clear the area
      if (overrideVisualizer && shouldOverride) {
        ctx.fillStyle = usedDimColor;
        ctx.clearRect(
          Math.ceil(textX - 5),
          0,
          Math.ceil(textWidth + 10),
          Math.ceil(vHeight)
        );
        ctx.fillRect(
          Math.ceil(textX - 5),
          0,
          Math.ceil(textWidth + 10),
          Math.ceil(vHeight)
        );
      }

      this.ctxAlpha(opacity, ctx => {
        ctx.font = font;
        if (underline) {
          // Add underline
          ctx.strokeStyle = fontColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(textX, textY + 10);
          ctx.lineTo(textX + textWidth, textY + 10);
          ctx.stroke();
        }
        // Add text
        ctx.fillStyle = fontColor;
        ctx.fillText(title, textX, textY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "white";
        ctx.strokeText(title, textX, textY);
      });
    }

    if (storyboardCallbacks.length > 0) {
      for (const callback of storyboardCallbacks) {
        callback();
      }
    }

    // Reset storyboard specifics after drawing.
    Toxen.background.storyboard.resetData();
  }

  /**
   * Gets the bar array object.
   */
  private getBar(barX: number, barY: number, barWidth: number, barHeight: number): [number, number, number, number] {
    return [
      barX,
      barY,
      barWidth,
      barHeight // Should adjust height appropriately depending on visualizer intensity. Not yet implemented.
    ];
  }

  private getCycleIncrementer() {
    return 360 / this.curLen;
  }

  private setRainbow(ctx: CanvasRenderingContext2D, barX: number, barY: number, barWidth: number, barHeight: number, i: number, cycleIncrementer?: number, options?: {
    top?: boolean;
    bottom?: boolean;
  }) {
    const rainbowColor = `hsl(${(cycleIncrementer ?? this.getCycleIncrementer()) * i + (Toxen.musicPlayer.media.currentTime * 50)}, 100%, 50%)`;

    const grd = ctx.createLinearGradient(barX, barY, barX + barWidth, barY + barHeight);
    if (!options) {
      grd.addColorStop(0, rainbowColor);
    }
    else {
      if (options.top) {
        grd.addColorStop(0, "white");
        grd.addColorStop(0.35, rainbowColor);
      }
      else {
        grd.addColorStop(0, rainbowColor);
      }
      if (options.bottom) {
        grd.addColorStop(0.65, rainbowColor);
        grd.addColorStop(1, "white");
      }
      else {
        grd.addColorStop(1, rainbowColor);
      }
    }
    ctx.fillStyle = grd;
    ctx.strokeStyle = grd;
  }

  /**
   * Toggles on Rainbow colors only if `Settings.get("visualizerRainbowMode")` is `true`
   */
  private setRainbowIfEnabled(ctx: CanvasRenderingContext2D, barX: number, barY: number, barWidth: number, barHeight: number, i: number, cycleIncrementer?: number, options?: {
    top?: boolean;
    bottom?: boolean;
  }) {
    if (Toxen.background.storyboard.getSong()?.visualizerForceRainbowMode || Settings.get("visualizerRainbowMode")) this.setRainbow(ctx, barX, barY, barWidth, barHeight, i, cycleIncrementer, options);
  }

  /**
   * Change the globalAlpha value temporarily on a Context2D object and revert back to normal when finished.
   * @param alpha Alpha to use temporarily
   * @param callback Code to execute using the temporary alpha.
   * @param ctx Context to use. If omitted, uses `this.ctx`.
   */
  private ctxAlpha(alpha: number, callback: (ctx: CanvasRenderingContext2D) => void, ctx: CanvasRenderingContext2D = this.ctx) {
    let oldAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    callback(ctx);
    ctx.globalAlpha = oldAlpha;
  }

  private initializeAudioAnalyser() {
    const audioFile = Toxen.musicPlayer.media;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioFile);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = Visualizer.DEFAULT_FFTSIZE;
    source.connect(audioContext.destination);
    source.connect(analyser);
    this.audioData = analyser;
  }


  public static readonly DEFAULT_FFTSIZE = 1024;
  private getFrequencyData(fftSize?: number) {
    if (fftSize && this.audioData.fftSize != fftSize) this.audioData.fftSize = fftSize;
    const bufferLength = this.audioData.frequencyBinCount;
    const amplitudeArray = new Uint8Array(bufferLength);
    this.audioData.getByteFrequencyData(amplitudeArray);

    return amplitudeArray;
  }

  private audioData: AnalyserNode;

  private stopped = true;
  public stop() {
    this.stopped = true;
  }

  public start() {
    this.update();
    this.initializeAudioAnalyser();
    this.stopped = false;
    this.loop(0);
  }

  public static readonly DEFAULT_COLOR: string = "#ffffff";
  // public color: string = Visualizer.DEFAULT_COLOR;
  // public setColor(color: string) {
  //   this.color = color || Visualizer.DEFAULT_COLOR;
  // }

  public canvas: HTMLCanvasElement;
  public width: number = 0;
  public height: number = 0;
  public left: number = 0;
  public top: number = 0;
  public ctx: CanvasRenderingContext2D;

  public length: Uint8Array;

  componentDidMount() {
    window.addEventListener("resize", this.updateThis);
  }

  componentDidUpdate() { }

  componentWillUnmount() {
    this.stop();
    window.removeEventListener("resize", this.updateThis);
  }

  update() {
    this.setState({});
  }

  updateThis: Visualizer["update"] = this.update.bind(this);

  render() {
    return (
      <div>
        <canvas className="audio-visualizer" ref={ref => {
          this.canvas = ref;
          if (ref && Toxen.musicControls && Toxen.musicControls.progressBar && Toxen.musicControls.progressBar.progressBarObject) {
            this.ctx = ref.getContext("2d");
            let box = ref.getBoundingClientRect();

            this.width = ref.width = box.width;
            this.height = ref.height = box.height;

            this.left = box.left;
            this.top = box.top;
          }
        }}>

        </canvas>
      </div>
    )
  }
}