import { Toxen as Toxen_ } from "../ToxenApp";
import _Song from "./Song";
import _Playlist from "./Playlist";
import _Theme from "./Theme";
_Theme

declare global {
  var Toxen: typeof Toxen_;
  var Song: typeof _Song;
  var Playlist: typeof _Playlist;
  var Theme: typeof _Theme;
}

global.Toxen = Toxen_;
global.Song = _Song;
global.Playlist = _Playlist;
global.Theme = _Theme;