import { VisualizerRenderer } from "./types";

const CenterVisualizer: VisualizerRenderer = {
  id: "center",
  name: "Center",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, opacity, getMaxHeight, setBarShadowBlur, setRainbowIfEnabled, useAlpha }) {
    const maxHeight = getMaxHeight(0.25);
    const unitW = vWidth / len;
    const unitH = maxHeight / dataSize;

    for (let i = 0; i < len; i++) {
      const data = dataArray[i];
      const _barHeight = (data * unitH);
      const [barX, barY, barWidth, barHeight] = [
        (i * unitW),
        (vHeight / 2) - _barHeight,
        unitW,
        _barHeight * 2
      ];

      setBarShadowBlur(barHeight);

      setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i);

      useAlpha(opacity, ctx => {
        ctx.fillRect(barX, barY, barWidth, barHeight);
      });
    }
  }
};

export default CenterVisualizer;
