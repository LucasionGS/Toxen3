import { Toxen } from "../ToxenApp";
import Settings from "./Settings";

export default class User {
  constructor() { }

  // public getUserDirectoryPath() {
  //   return Settings.getServer() + "/" + this.token;
  // }
  
  public getCollectionPath(append?: string) {
    return Settings.getServer() + "/track" + (append ? "/" + append : "");
  }
  
  public getPlaylistsPath() {
    return Settings.getServer() + "/playlist";
  }

  public static async login(token: string): Promise<User>;
  public static async login(username: string, password: string): Promise<User>;
  public static async login(username: string, password?: string) {
    const loginUrl = Settings.getServer();

    let data: any;
    if (username && password) data = {
      username: username,
      password: password
    };
    else if (username && !password) data = {
      token: username
    };
    return await Toxen.fetch(loginUrl + "/user/login", {
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
      // If server couldn't be reached
      if (response.status === 0 || response.status === 502 || response.status === 503) {
        throw new Error("Could not reach Toxen server");
      }

      if (password) Toxen.error(`Failed to login as ${username}`, 3000);
      else Toxen.error(`Failed to login. Token invalid`, 3000);
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

    if (!user) return User.logout();
    
    Toxen.setAppBarUser(user);
    window.localStorage.setItem("user", JSON.stringify(user));
  }
  
  public static logout() {
    Toxen.setAppBarUser(null);
    window.localStorage.removeItem("user");
    Toxen.fetch(Settings.getServer() + "/user/logout", {
      method: "POST"
    });
  }

  public static refreshUser() {
    let user = User.getCurrentUser();
    if (!user) return;
    User.login(user.token).then(user => {
      if (user) User.setCurrentUser(user);
    });
  }

  public static create(info: IUser) {
    let user = new User();

    // Assign properties
    user.id = info.id;
    user.username = info.username;
    user.email = info.email;
    user.token = info.token;
    user.premium = info.premium;
    user.premium_expire = (info.premium_expire ? new Date(info.premium_expire) : null);
    user.storageUsed = info.storageUsed;
    user.storageQuota = info.storageQuota;

    return user;
  }

  public static userSessionRefresh: Date;
  
  id: number;
  username: string;
  email: string;
  token: string;
  premium: boolean;
  premium_expire: Date;
  storageUsed: number;
  storageQuota: number;
}

setInterval(() => {
  if (!User.userSessionRefresh || User.userSessionRefresh < new Date()) {
    User.userSessionRefresh = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
    User.refreshUser();
  }
}, 5000);

interface IUser {
  id: number;
  username: string;
  email: string;
  token: string;
  premium: boolean;
  premium_expire: string;
  storageUsed: number;
  storageQuota: number;
}