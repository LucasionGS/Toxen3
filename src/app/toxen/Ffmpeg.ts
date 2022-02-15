import ffmpeg from "fluent-ffmpeg";
import { Toxen } from "../ToxenApp";
import Settings from "./Settings";

namespace Ffmpeg {
  export const path = Settings.toxenDataPath + "/ffmpeg.exe";

  
}

export default Ffmpeg;