import React from "react";
import ReactDOM from "react-dom";
import ToxenApp, { Toxen } from "./app/ToxenApp";
import Settings from "./app/toxen/Settings";
import "@fortawesome/fontawesome-free/js/all"; // Import FA

Settings.load();

// Render app
const toxenApp = <ToxenApp/> as React.ClassicElement<ToxenApp>;
setTimeout(() => {
  console.log(toxenApp);
}, 1000);

ReactDOM.render(toxenApp, document.querySelector("app-root"));