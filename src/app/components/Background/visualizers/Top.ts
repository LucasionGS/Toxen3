import { EDGE_TOP, VisualizerRenderer } from "./types";

const TopVisualizer: VisualizerRenderer = {
  id: "top",
  name: "Top",
  draw({ ctx, dataArray, len, dataSize, vWidth, opacity, getMaxHeight, setBarShadowBlur, setRainbowIfEnabled, useAlpha }) {
    const maxHeight = getMaxHeight(0.30);
    const unitW = vWidth / len;
    const unitH = maxHeight / dataSize;

    for (let i = 0; i < len; i++) {
      const data = dataArray[i];
      const _barHeight = (data * unitH);
      const [barX, barY, barWidth, barHeight] = [
        (i * unitW),
        0,
        unitW,
        _barHeight
      ];

      setBarShadowBlur(barHeight);

      setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, EDGE_TOP);

      useAlpha(opacity, ctx => {
        ctx.fillRect(barX, barY, barWidth, barHeight);
      });
    }
  }
};

export default TopVisualizer;
