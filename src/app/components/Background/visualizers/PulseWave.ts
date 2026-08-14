import { VisualizerRenderer } from "./types";

const PulseWaveVisualizer: VisualizerRenderer = {
  id: "pulsewave",
  name: "PulseWave",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, opacity, getMaxHeight, setRainbowIfEnabled, useAlpha }) {
    const maxHeight = getMaxHeight(0.25);
    const unitW = vWidth / len;
    const unitH = maxHeight / dataSize;
    const centerY = (vHeight / 2);

    for (let i = 0; i < len; i++) {
      const data = dataArray[i];
      const _barHeight = Math.max(1, data * unitH);
      const [barX, barY, barWidth, barHeight] = [
        (i * unitW),
        centerY - _barHeight,
        unitW,
        _barHeight * 2
      ];

      const nextData = dataArray[i + 1];
      if (typeof nextData !== "number") continue;

      const nextBarHeight = (nextData * unitH);
      const nextBarY = centerY - nextBarHeight;
      const nextBarX = ((i + 1) * unitW);
      const nextBarWidth = unitW;

      setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i);

      ctx.save();
      ctx.beginPath();
      useAlpha(opacity, ctx => {
        ctx.moveTo(barX, barY);
        ctx.lineTo(nextBarX, nextBarY);
        ctx.lineTo(nextBarX + nextBarWidth, nextBarY);
        ctx.lineTo(barX + barWidth, barY);

        const _barY = centerY + _barHeight;
        const _nextBarY = centerY + nextBarHeight;
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
};

export default PulseWaveVisualizer;
