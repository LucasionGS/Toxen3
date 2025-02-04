import { Button, Group, Image, Modal, Spoiler } from "@mantine/core";
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


        {
          toxenapi.isDesktop() && (
            <>
              {/* Toxen Action button */}
              <div className="appBarButton appBar__actionButton"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const btnBox = e.currentTarget.getBoundingClientRect();
                  if (toxenapi.isDesktop()) {
                    toxenapi.remote.Menu.getApplicationMenu().popup({
                      x: btnBox.left,
                      y: btnBox.bottom
                    });
                  }
                  else {
                    Toxen.notify({
                      title: "Toxen",
                      content: "Not implemented on web version yet.",
                      expiresIn: 5000
                    });
                  }
                }}>
                {/* Arrow down icon */}
                <i className="fas fa-caret-down"></i>
              </div>
              {/* Minimize button */}
              <div className="appBarButton appBar__minimizeButton"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toxenapi.remote.getCurrentWindow().minimize();
                }}>
                <i className="fas fa-window-minimize"></i>
              </div>

              {/* Maximize */}
              <div className="appBarButton appBar__maximizeButton"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const win = toxenapi.remote.getCurrentWindow();
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
                  toxenapi.remote.getCurrentWindow().close();
                }}>
                <i className="fas fa-times"></i>
              </div>
            </>
          )
        }
      </div>
    )
  }
}

function AppBarTitle() {
  const [title, setTitle] = React.useState("Toxen");

  Toxen.setAppBarText = setTitle;
  return (
    <div className="appBarTitle">
      <Group grow>
        <h2>
          <img src={txnLogo} height={30} width={30} style={{ display: "inline-block" }} />
          &nbsp;
          <span style={{ marginLeft: 2 }}>
            {title}
          </span>
        </h2>
      </Group>
    </div>
  )
}

export function bytesToString(bytes: number, unit?: "B" | "KB" | "MB" | "GB" | "TB") {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = sizes.indexOf(unit);
  const maxIndex = unitIndex >= 0 ? unitIndex : sizes.length;
  let sizeIndex = 0;
  while (bytes >= 1024 && sizeIndex < maxIndex) {
    bytes /= 1024;
    sizeIndex++;
  }
  return bytes.toFixed(2) + sizes[sizeIndex];
}

function UserManage() {
  const [opened, setOpened] = useState(false);
  const [user, setUser] = useState(User.getCurrentUser());

  Toxen.setAppBarUser = setUser;

  const usedQuota = React.useMemo(() => {
    if (!user) return "0B/0B used (0%)";
    return bytesToString(user.storage_used) + "/" + bytesToString(user.storage_quota) + " used (" + (user.storage_used / user.storage_quota * 100).toFixed(2) + "%)";
  }, [user, user?.storage_used, user?.storage_quota]);
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
              <h2>{user.name}</h2>
              <p><b>Premium Status</b>: {user.premium ? <>Expires <code>{user.premium_expire.toDateString()}</code></> : "No premium"}</p>
              <p>{usedQuota}</p>
              <Button.Group>
                <Button
                  onClick={() => {
                    User.refreshUser();
                    Toxen.reloadSection();
                  }}
                >
                  Refresh
                </Button>

                
                <Button
                  color="red"
                  onClick={() => {
                    User.logout();
                    setUser(null);
                  }}
                >Logout</Button>
              </Button.Group>
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