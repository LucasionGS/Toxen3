"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var react_1 = __importDefault(require("react"));
var Sidepanel_1 = __importDefault(require("./components/Sidepanel"));
require("./index.css");
function Index() {
    return (react_1["default"].createElement("div", null,
        react_1["default"].createElement(Sidepanel_1["default"], { direction: "left", toggle: true },
            react_1["default"].createElement("p", null, "Suck")),
        "Welcome to Toxen"));
}
exports["default"] = Index;
//# sourceMappingURL=index.js.map