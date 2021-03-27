"use strict";
exports.__esModule = true;
var node_path_1 = require("node:path");
var Song = /** @class */ (function () {
    function Song() {
    }
    /**
     * Return the full path of the song folder.
     */
    Song.prototype.dirname = function () {
        return node_path_1.resolve(this.paths.dirname);
    };
    /**
     * Return the full path of the media file.
     */
    Song.prototype.mediaFile = function () {
        return node_path_1.resolve(this.dirname(), this.paths.media);
    };
    return Song;
}());
exports["default"] = Song;
//# sourceMappingURL=Song.js.map