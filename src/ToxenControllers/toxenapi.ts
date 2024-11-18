import DesktopController from "./DesktopController";
import ToxenController from "./ToxenController";
window.toxenapi = false ? new DesktopController() : new ToxenController();

export default window.toxenapi;