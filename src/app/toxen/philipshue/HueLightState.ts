export interface HueLightState {
  on?: boolean;
  bri?: number;
  hue?: number;
  sat?: number;
  xy?: number[];
  ct?: number;
  alert?: string;
  effect?: string;
  colormode?: string;
  reachable?: boolean;
}
