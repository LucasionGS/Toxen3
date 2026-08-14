import { EDGE_BOTTOM, VisualizerRenderer } from "./types";

const BottomVisualizer: VisualizerRenderer = {
  id: "bottom",
  name: "Bottom",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, opacity, getMaxHeight, setBarShadowBlur, setRainbowIfEnabled, useAlpha }) {
    const maxHeight = getMaxHeight(0.30);
    const unitW = vWidth / len;
    const unitH = maxHeight / dataSize;

    for (let i = 0; i < len; i++) {
      const data = dataArray[i];
      const _barHeight = (data * unitH);
      const [barX, barY, barWidth, barHeight] = [
        (i * unitW),
        vHeight - _barHeight,
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

export default BottomVisualizer;
