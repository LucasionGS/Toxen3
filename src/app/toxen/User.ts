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
    let loginUrl = Settings.isRemote() ? Settings.get("libraryDirectory") : "https://toxen.net/stream";
    while (loginUrl.endsWith("/")) {
      loginUrl = loginUrl.substring(0, loginUrl.length - 1);
    }

    let data: any;
    if (username && password) data = {
      username: username,
      password: password
    };
    else if (username && !password) data = {
      token: username
    };
    return await Toxen.fetch(loginUrl + "/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }).then(async response => {
      if (response.ok) {
        let user = User.create(await response.json() as IUser);
        User.setCurrentUser(user);
        console.log(`Logged in as ${user.username}`);
        
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
  
  public static removeCurrentUser() {
    window.localStorage.removeItem("user");
  }

  public static create(info: IUser) {
    let user = new User();

    // Assign properties
    user.id = info.id;
    user.username = info.username;
    user.token = info.token;
    user.premium = info.premium;
    user.premium_expire = (info.premium_expire ? new Date(info.premium_expire) : null);
    user.remote_max_size = info.remote_max_size;

    return user;
  }
  
  id: number;
  username: string;
  token: string;
  premium: boolean;
  premium_expire: Date;
  remote_max_size: number;
}

interface IUser {
  id: number;
  username: string;
  token: string;
  premium: boolean;
  premium_expire: string;
  remote_max_size: number;
}