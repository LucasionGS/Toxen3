import { Alert, Button, TextInput } from "@mantine/core";
import React from "react";
import Settings from "../../toxen/Settings";
import User from "../../toxen/User";
import { Toxen } from "../../ToxenApp";
import Form from "../Form/Form";
import FormInput from "../Form/FormInputFields/FormInput";

let attemptedInitialLogin = false;
export default function LoginForm(props: { onSuccessfulLogin?: () => void }) {
  const { onSuccessfulLogin } = props;
  async function handleLogin(loginPromise: Promise<User>) {
    setLoading(true);
    return loginPromise.then(loggedInUser => {
      if (loggedInUser) {
        if (onSuccessfulLogin) onSuccessfulLogin();
        User.setCurrentUser(loggedInUser);
        setLoading(false);
        setError(null);
        setLoggedIn(true);
        Toxen.sidePanel.reloadSection();
        if (Settings.isRemote()) Toxen.loadSongs();
      }
      else {
        setLoading(false);
        setLoggedIn(false);
        Toxen.error("Login failed", 5000);
        setError("Login failed");
      }
    }).catch(e => {
      Toxen.error("Unable to reach Toxen server", 5000);
      setError("Unable to reach Toxen server");
      setLoading(false);
    });
  }

  // if (!Settings.isRemote()) return <>Connect to a server to login.</>
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>(null);
  const user = Settings.getUser();
  if (!attemptedInitialLogin && user) {
    User.logout();
    attemptedInitialLogin = true;
    handleLogin(User.login(user.token));
  }

  const [username, setUsername] = React.useState(user?.username || "");
  const [password, setPassword] = React.useState("");

  const login = () => handleLogin(User.login(username as string, password as string));
  
  return (
    user ? (
      <Button onClick={() => {
        User.logout();
        Toxen.loadSongs();
        setLoggedIn(false);
        Toxen.reloadSection();
      }} color="yellow">Log out of <b>{user.username}</b></Button>
    ) : (
      <>
        <h2>Toxen login</h2>
        <Alert color="red" title="Error" hidden={!error}>{error}</Alert>
        <TextInput label="Username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} onSubmit={login} />
        <TextInput label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onSubmit={login} />
        <br />
        <Button loading={loading} onClick={login}>
          {loading ? "Logging in..." : "Login"}
        </Button>
      </>
    )
  )
}