import { HueLightState } from "./HueLightState";

export class HueLight {
  public id: number;
  public name: string;
  public type: string;
  public state: HueLightState;

  constructor(id: number, name: string, type: string, state: HueLightState) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.state = state;
  }
}
