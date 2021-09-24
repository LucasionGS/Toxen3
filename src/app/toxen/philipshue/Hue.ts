import { HueLight } from "./HueLight";
const dtls: typeof import("./dtls").default = require("@nodertc/dtls");

dtls;

export default class HueEntertainment {
  private bridge: HueBridge;
  private lights: HueLight[];
  // private scenes: HueScene[];
  // private scenesByName: { [name: string]: HueScene };
  // private groups: HueGroup[];

  constructor(bridge: HueBridge) {
    this.bridge = bridge;
    this.lights = [];
    // this.scenes = [];
    // this.scenesByName = {};
    // this.groups = [];
  }

  public async init() {
    // await this.updateLights();
    // await this.updateGroups();
    // await this.updateScenes();
  }
}

class HueBridge {
  private ip: string;
  private username: string;
  private psk: string;

  constructor(ip: string, username: string, psk: string) {
    this.ip = ip;
    this.username = username;
    this.psk = psk;
  }
}