import { Toxen } from "../ToxenApp";
import Settings from "./Settings";

export default class User {
  constructor() { }

  public getUserDirectory() {
    return Settings.get("libraryDirectory") + "/" + this.token;
  }
  
  public getUserDirectoryCollection() {
    return Settings.get("libraryDirectory") + "/" + this.token + "/collection";
  }

  public static async login(token: string): Promise<User>;
  public static async login(username: string, password: string): Promise<User>;
  public static async login(username: string, password?: string) {
    if (!Settings.isRemote()) return null;
    let data: any;
    if (username && password) data = {
      username: username,
      password: password
    };
    else if (username && !password) data = {
      token: username
    };
    return await Toxen.fetch(Settings.get("libraryDirectory") + "/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }).then(async response => {
      if (response.ok) {
        let user = User.create(await response.json() as IUser);
        User.setCurrentUser(user);
        return user;
      }
      return null;
    });
  }

  public static getCurrentUser() {
    let userJson = window.localStorage.getItem("user");

    if (userJson) {
      try {
        return User.create(JSON.parse(userJson));
      } catch (error) {
        console.error("Error parsing User");
        console.error(error);
        return null;
      }
    }
    return null;
  }
  
  public static setCurrentUser(user: User) {
    window.localStorage.setItem("user", JSON.stringify(user));
  }

  public static create(info: IUser) {
    let user = new User();

    // Assign properties
    user.token = info.token;

    return user;
  }
  
  token: string;
}

interface IUser {
  token: string;
}