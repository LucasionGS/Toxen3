import { remote } from "electron";
import React, { Component } from "react";
import { Toxen } from "../../ToxenApp";
import "./AppBar.scss";

interface AppBarProps { }
interface AppBarState { }

export default class AppBar extends Component<AppBarProps, AppBarState> {
  constructor(props: AppBarProps) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div className="appBar">
        <AppBarTitle />
        {/* Minimize button */}
        <div className="appBarButton appBar__minimizeButton"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            remote.getCurrentWindow().minimize();
          }}>
          <i className="fas fa-window-minimize"></i>
        </div>

        {/* Maximize */}
        <div className="appBarButton appBar__maximizeButton"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const win = remote.getCurrentWindow();
            const isMaximized = win.isMaximized();
            if (isMaximized) {
              win.unmaximize();
            }
            else {
              win.maximize();
            }
          }}>
          <i className="fas fa-window-maximize"></i>
        </div>

        {/* Close button */}
        <div className="appBarButton appBar__closeButton"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            remote.getCurrentWindow().close();
          }}>
          <i className="fas fa-times"></i>
        </div>
      </div>
    )
  }
}

function AppBarTitle() {
  const [title, setTitle] = React.useState("Toxen");

  Toxen.setTitleBarText = setTitle;
  return (
    <div className="appBarTitle">
      <h2>{title}</h2>
    </div>
  )
}