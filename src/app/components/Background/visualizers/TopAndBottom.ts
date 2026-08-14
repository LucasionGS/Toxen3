import { EDGE_BOTTOM, EDGE_TOP, VisualizerRenderer } from "./types";

const TopAndBottomVisualizer: VisualizerRenderer = {
  id: "topbottom",
  name: "TopAndBottom",
  draw({ dataArray, len, dataSize, vWidth, vHeight, opacity, getMaxHeight, setBarShadowBlur, setRainbowIfEnabled, useAlpha }) {
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

      useAlpha(opacity, ctx => {
        setRainbowIfEnabled(ctx, barX, 0, barWidth, barHeight, i, null, EDGE_TOP);
        ctx.fillRect(barX, 0, barWidth, barHeight);
        setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, EDGE_BOTTOM);
        ctx.fillRect(barX, barY, barWidth, barHeight);
      });
    }
  }
};

export default TopAndBottomVisualizer;
