import { Button, Group, Image, Modal, Spoiler } from "@mantine/core";
import { remote } from "electron";
import React, { Component, useState } from "react";
import { Toxen } from "../../ToxenApp";
//@ts-expect-error 
// import txnLogo from "../../../icons/toxen.png";
import txnLogo from "../../../icons/tox128.png";
import "./AppBar.scss";
import User from "../../toxen/User";
import LoginForm from "../LoginForm/LoginForm";

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
        {/* User manage */}
        <UserManage />

        {/* Toxen Action button */}
        <div className="appBarButton appBar__actionButton"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const btnBox = e.currentTarget.getBoundingClientRect();
            remote.Menu.getApplicationMenu().popup({
              x: btnBox.left,
              y: btnBox.bottom
            });
          }}>
          {/* Arrow down icon */}
          <i className="fas fa-caret-down"></i>
        </div>

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

  Toxen.setAppBarText = setTitle;
  return (
    <div className="appBarTitle">
      <Group>
        <h2>
          <Image src={txnLogo} height={24} width={24} style={{ display: "inline-block" }} />
          &nbsp;
          <span style={{ marginLeft: 2 }}>
            {title}
          </span>
        </h2>
      </Group>
    </div>
  )
}

function UserManage() {
  const [opened, setOpened] = useState(false);
  const [user, setUser] = useState(User.getCurrentUser());

  Toxen.setAppBarUser = setUser;
  return (
    <>
      <div className="appBarButton appBar__userButton"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpened(true);
        }}>
        {/* User icon */}
        <i className="fas fa-user-circle" />
      </div>
      <Modal opened={opened} onClose={() => setOpened(false)}>
        {
          user ? (
            <div>
              <h2>{user.username}</h2>
              <p><b>Premium Status</b>: {user.premium ? <>Expires <code>{user.premium_expire.toDateString()}</code></> : "No premium"}</p>
              <p>{user.tracks}/{user.maxTracks}</p>

              
              <Button onClick={() => {
                User.logout();
                setUser(null);
              }}>Logout</Button>
            </div>
          ) : (
            <div>
              <h2>Not logged in</h2>
              <LoginForm />
            </div>
          )
        }
      </Modal>
    </>
  );
}