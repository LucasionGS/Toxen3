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
  async function handleLogin(loginPromise: Promise<User>, notify = true) {
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

        if (notify) {
          Toxen.notify({
            title: "Log in successful",
            content: `Welcome, ${loggedInUser.name}!`,
            expiresIn: 2500,
            type: "normal",
          });
        }
          
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

  const [loggedIn, setLoggedIn] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>(null);
  const user = Settings.getUser();
  if (!attemptedInitialLogin && user) {
    attemptedInitialLogin = true;
    handleLogin(User.refreshUser(), false);
  }

  const [email, setEmail] = React.useState(user?.email || "");
  const [password, setPassword] = React.useState("");
  
  return (
    user ? (
      <Button onClick={async () => {
        await Settings.apply({ isRemote: false });
        User.logout();
        Toxen.loadSongs();
        setLoggedIn(false);
        Toxen.reloadSection();
      }} color="yellow">Log out</Button>
    ) : (
      <>
        <h2>Toxen login</h2>
        <sub>
          Log in to your Toxen account to access your songs and settings.
          <br />
          <b>Note</b> - Toxen Stream is not open for registration. Only select users have access.
        </sub>
        <Alert color="red" title="Error" hidden={!error}>{error}</Alert>
        <form onSubmit={e => {
          e.preventDefault();
          handleLogin(User.login(email as string, password as string));
        }}>
          <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button loading={loading} type="submit">
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </>
    )
  )
}