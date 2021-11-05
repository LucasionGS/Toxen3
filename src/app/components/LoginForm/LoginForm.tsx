import React from "react";
import Settings from "../../toxen/Settings";
import User from "../../toxen/User";
import { Toxen } from "../../ToxenApp";
import Form from "../Form/Form";
import FormInput from "../Form/FormInputFields/FormInput";

let attemptedInitialLogin = false;
export default function LoginForm() {
  // if (!Settings.isRemote()) return <>Connect to a server to login.</>
  const [loggedIn, setLoggedIn] = React.useState(false);
  const user = Settings.getUser();
  if (!attemptedInitialLogin && user) {
    User.removeCurrentUser();
    attemptedInitialLogin = true;
    User.login(user.token).then(loggedInUser => {
      if (loggedInUser) {
        User.setCurrentUser(loggedInUser);
        setLoggedIn(true);
        Toxen.sidePanel.reloadSection();
        if (Settings.isRemote()) Toxen.loadSongs();
      }
    }).catch(e => {
      console.error(e);
      Toxen.error("Unable to reach Toxen server");
      Toxen.sidePanel.reloadSection();
    });
  }
  const template = () => ({
    username: user?.username || "",
    password: ""
  });
  return (
    user ? (<button onClick={() => {
      User.removeCurrentUser();
      Toxen.loadSongs();
      setLoggedIn(false);
      Toxen.reloadSection();
    }} className="tx-btn tx-btn-warning">Log out of <b>{user.username}</b></button>) : (<Form onSubmit={async (e, values) => {
      User.login(values.username as string, values.password as string).then(loggedInUser => {
        if (loggedInUser) {
          User.setCurrentUser(loggedInUser);
          Toxen.log("Logged in user: " + loggedInUser.username, 2000);
          setLoggedIn(true);
          Toxen.sidePanel.reloadSection();
          if (Settings.isRemote()) Toxen.loadSongs();
        }
        else Toxen.error("Login failed");
      }).catch(e => {
        Toxen.error("Unable to reach Toxen server");
        console.error(e);
      });
    }} saveButtonText="Login">
      <FormInput name="username*string" displayName="Username" type="text" getValueTemplateCallback={template} />
      <FormInput name="password*string" displayName="Password" type="password" getValueTemplateCallback={template} />
    </Form>)
  )
}
