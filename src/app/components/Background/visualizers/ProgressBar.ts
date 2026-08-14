import { EDGE_BOTTOM, VisualizerRenderer } from "./types";

const ProgressBarVisualizer: VisualizerRenderer = {
  id: "progressbar",
  name: "ProgressBar",
  draw(frame) {
    const { ctx, dataArray, len, dataSize, setBarShadowBlur, setRainbowIfEnabled, useAlpha, opacity } = frame;

    // The original assigns these onto the frame rather than local copies: getMaxHeight reads
    // vHeight, and the floating title is laid out against them after the style has run.
    frame.vHeight = frame.progressBarTop;
    frame.vLeft = frame.progressBarLeft;

    const { vWidth, vHeight, vLeft, vTop } = frame;
    const maxHeight = frame.getMaxHeight(0.30);
    const unitW = ((vWidth - 20 /* Progress bar curve */) - (vLeft * 2)) / len;
    const unitH = maxHeight / dataSize;

    for (let i = 0; i < len; i++) {
      const data = dataArray[i];
      const _barHeight = (data * unitH);
      const [barX, barY, barWidth, barHeight] = [
        (i * unitW) + vLeft + 10 /* Progress bar curve */,
        vHeight - _barHeight - vTop,
        unitW,
        _barHeight
      ];

      setBarShadowBlur(barHeight);

      setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, EDGE_BOTTOM);

      useAlpha(opacity, ctx => {
        ctx.fillRect(barX, barY, barWidth, barHeight);
      });
    }
  }
};

export default ProgressBarVisualizer;
