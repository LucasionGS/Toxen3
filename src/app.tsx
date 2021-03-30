import React from "react";
import ReactDOM from "react-dom";
import ToxenApp, { Toxen } from "./app/ToxenApp";
// import Settings from "./app/toxen/Settings";
import "@fortawesome/fontawesome-free/js/all"; // Import FA

// Render app
const toxenApp = <ToxenApp /> as React.ClassicElement<ToxenApp>;
ReactDOM.render(toxenApp, document.querySelector("app-root"));