import { Toxen as Toxen_ } from "../ToxenApp";
import _Song from "./Song";
import _Playlist from "./Playlist";

declare global {
  var Toxen: typeof Toxen_;
  var Song: typeof _Song;
  var Playlist: typeof _Playlist;
}

global.Toxen = Toxen_;
global.Song = _Song;
global.Playlist = _Playlist;