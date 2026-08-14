import { EDGE_NONE, VisualizerRenderer } from "./types";

const SidesVisualizer: VisualizerRenderer = {
  id: "sides",
  name: "Sides",
  draw({ dataArray, len, dataSize, vWidth, vHeight, opacity, getMaxWidth, setBarShadowBlur, setRainbowIfEnabled, useAlpha }) {
    const maxWidth = getMaxWidth(0.15);
    const unitH = vHeight / (dataSize / 2);
    const unitW = maxWidth / len;

    for (let i = 0; i < len; i++) {
      const data = dataArray[i];
      let _barWidth = (data * unitW);
      _barWidth += _barWidth / 2;
      const [barX, barY, barWidth, barHeight] = [
        0,
        (i * unitH),
        _barWidth,
        unitH
      ];

      useAlpha(opacity, ctx => {
        setBarShadowBlur(barWidth);

        if (i % 2 === 0) {
          setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, EDGE_NONE);
          ctx.fillRect(barX, barY / 2, barWidth, barHeight); // Left
        }
        else {
          setRainbowIfEnabled(ctx, barX + barWidth, barY, barWidth, barHeight, i, null, EDGE_NONE);
          ctx.fillRect(vWidth - barWidth, barY / 2, barWidth, barHeight); // Right
        }
      });
    }
  }
};

export default SidesVisualizer;
