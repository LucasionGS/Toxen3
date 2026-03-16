import { Alert, Anchor, Button, TextInput } from "@mantine/core";
import React from "react";
import Settings from "../../toxen/Settings";
import User from "../../toxen/User";
import { Toxen } from "../../ToxenApp";
import { friendSocket } from "../../toxen/FriendSocket";

let attemptedInitialLogin = false;
export default function LoginForm(props: { onSuccessfulLogin?: () => void }) {
  const { onSuccessfulLogin } = props;

  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>(null);
  const user = Settings.getUser();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(user?.email || "");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  async function handleAuthResult(authPromise: Promise<User>, notify = true) {
    setLoading(true);
    setError(null);
    return authPromise.then(loggedInUser => {
      if (loggedInUser) {
        if (onSuccessfulLogin) onSuccessfulLogin();
        User.setCurrentUser(loggedInUser);
        setLoading(false);
        setError(null);
        setLoggedIn(true);
        Toxen.sidePanel.reloadSection();
        if (Settings.isRemote()) Toxen.loadSongs();
        // Connect real-time friends socket after login
        friendSocket.connect();

        if (notify) {
          Toxen.notify({
            title: mode === "register" ? "Registration successful" : "Log in successful",
            content: `Welcome, ${loggedInUser.name}!`,
            expiresIn: 2500,
            type: "normal",
          });
        }
      }
      else {
        setLoading(false);
        setLoggedIn(false);
        setError(mode === "register" ? "Registration failed" : "Login failed");
      }
    }).catch(e => {
      setLoading(false);
      setError(e.message || "Unable to reach Toxen server");
    });
  }

  if (!attemptedInitialLogin && user) {
    attemptedInitialLogin = true;
    handleAuthResult(User.refreshUser(), false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register") {
      if (!name.trim()) {
        setError("Display name is required.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      handleAuthResult(User.register(name.trim(), email, password));
    } else {
      handleAuthResult(User.login(email, password));
    }
  }

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
        <h2>{mode === "register" ? "Create account" : "Toxen login"}</h2>
        <sub>
          {mode === "register"
            ? "Create a new Toxen Stream account."
            : "Log in to your Toxen account to access your songs and settings."
          }
        </sub>
        <Alert color="red" title="Error" hidden={!error}>{error}</Alert>
        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <TextInput label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "register" && (
            <TextInput label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          )}
          <Button loading={loading} type="submit" mt="sm">
            {loading
              ? (mode === "register" ? "Creating account..." : "Logging in...")
              : (mode === "register" ? "Create account" : "Login")
            }
          </Button>
        </form>
        <sub style={{ marginTop: 8, display: "block" }}>
          {mode === "login" ? (
            <>Don't have an account? <Anchor component="button" type="button" size="xs" onClick={() => { setMode("register"); setError(null); }}>Create one</Anchor></>
          ) : (
            <>Already have an account? <Anchor component="button" type="button" size="xs" onClick={() => { setMode("login"); setError(null); }}>Log in</Anchor></>
          )}
        </sub>
      </>
    )
  )
}
