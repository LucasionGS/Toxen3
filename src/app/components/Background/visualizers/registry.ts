import Bottom from "./Bottom";
import Center from "./Center";
import Clock from "./Clock";
import DNA from "./DNA";
import FluidOrb from "./FluidOrb";
import Heart from "./Heart";
import Jellyfish from "./Jellyfish";
import { MirroredSingularityVisualizer, MirroredSingularityWithLogoVisualizer } from "./MirroredSingularity";
import Orb from "./Orb";
import ProgressBar from "./ProgressBar";
import PulseWave from "./PulseWave";
import Rings from "./Rings";
import Sides from "./Sides";
import { SingularityVisualizer, SingularityWithLogoVisualizer } from "./Singularity";
import Spiral from "./Spiral";
import Top from "./Top";
import TopAndBottom from "./TopAndBottom";
import { VisualizerRenderer } from "./types";
import Waveform from "./Waveform";
import WaveformCircle from "./WaveformCircle";

const renderers: VisualizerRenderer[] = [
  ProgressBar,
  Bottom,
  Top,
  TopAndBottom,
  Sides,
  Center,
  SingularityVisualizer,
  SingularityWithLogoVisualizer,
  MirroredSingularityVisualizer,
  MirroredSingularityWithLogoVisualizer,
  PulseWave,
  Waveform,
  Orb,
  FluidOrb,
  WaveformCircle,
  Heart,
  DNA,
  Rings,
  Spiral,
  Clock,
  Jellyfish,
];

export const builtInVisualizers: Map<string, VisualizerRenderer> = new Map(
  renderers.map(renderer => [renderer.id, renderer])
);

/**
 * The style used when the configured one is unknown. Matches the `default:` arm of the original
 * switch, which fell through into ProgressBar.
 */
export const fallbackVisualizer = ProgressBar;

export function getBuiltInVisualizer(styleId: string): VisualizerRenderer | undefined {
  return builtInVisualizers.get(styleId);
}
