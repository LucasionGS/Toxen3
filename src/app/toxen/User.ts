import { Toxen } from "../ToxenApp";
import Settings from "./Settings";
import type { IFriendship } from "./FriendSocket";
import { friendSocket } from "./FriendSocket";

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

  public getBackgroundsPath() {
    return Settings.getServer() + "/backgrounds";
  }

  /**
   * Append the user's auth token as a query parameter to a URL.
   * Used for URLs loaded directly by the browser (e.g. `<audio src>`, `<img src>`)
   * where custom headers can't be set.
   */
  public static appendAuth(url: string): string {
    if (!url) return url;
    const user = User.getCurrentUser();
    if (!user?.token) return url;
    // Avoid appending if already present
    if (url.includes("token=")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}token=${user.token}`;
  }

  // public static async login(token: string): Promise<User>;
  // public static async login(email: string, password: string): Promise<User>;
  public static async login(email: string, password: string) {
    const loginUrl = Settings.getServer();

    const data = {
      email: email,
      password: password
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
        return user;
      }
      // If server couldn't be reached
      if (response.status === 0 || response.status === 502 || response.status === 503) {
        throw new Error("Could not reach Toxen server");
      }

      const errorBody = await response.json().catch((): null => null);
      throw new Error(errorBody?.error || `Failed to login as ${email}`);
    });
  }

  public static async register(name: string, email: string, password: string) {
    const serverUrl = Settings.getServer();

    return await Toxen.fetch(serverUrl + "/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, email, password })
    }).then(async response => {
      if (response.ok) {
        let user = User.create(await response.json() as IUser);
        User.setCurrentUser(user);
        return user;
      }

      if (response.status === 0 || response.status === 502 || response.status === 503) {
        throw new Error("Could not reach Toxen server");
      }

      const errorBody = await response.json().catch((): null => null);
      throw new Error(errorBody?.error || "Registration failed");
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
    Toxen.appRenderer?.forceUpdate();
  }
  
  public static logout() {
    Toxen.setAppBarUser(null);
    window.localStorage.removeItem("user");
    friendSocket.disconnect();
    Toxen.fetch(Settings.getServer() + "/logout");
    Toxen.appRenderer?.forceUpdate();
  }

  public static async refreshUser() {
    let user = User.getCurrentUser();
    if (!user) return;
    return Toxen.fetch(Settings.getServer() + "/authenticated").then(async response => {
      if (response.ok) {
        let newUser = User.create(await response.json() as IUser);
        User.setCurrentUser(newUser);
        return newUser;
      }
      else {
        User.logout();
        Toxen.error("Failed to refresh user", 3000);
      }
      return null;
    });
  }

  public static create(info: IUser) {
    let user = new User();

    // Assign properties
    user.id = info.id;
    user.name = info.name;
    user.email = info.email;
    user.token = info.token;
    user.premium = info.premium;
    user.premium_tier = info.premium_tier ?? null;
    user.premium_expire = (info.premium_expire ? new Date(info.premium_expire) : null);
    user.storage_used = info.storage_used;
    user.storage_quota = info.storage_quota;
    user.roles = info.roles || [];

    return user;
  }

  public static userSessionRefresh: Date;
  
  id: number;
  name: string;
  email: string;
  token: string;
  premium: boolean;
  premium_tier: string | null;
  premium_expire: Date;
  storage_used: number;
  storage_quota: number;
  roles: string[];

  public hasRole(role: string): boolean {
    return this.roles?.includes(role) ?? false;
  }

  public isAdmin(): boolean {
    return this.hasRole("admin");
  }

  // ---- Friend API ----

  public static async getFriends(): Promise<{ friends: IFriendship[]; pending: IFriendship[] }> {
    const res = await Toxen.fetch(Settings.getServer() + "/friends");
    if (!res.ok) throw new Error("Failed to fetch friends");
    return res.json();
  }

  public static async sendFriendRequest(email: string): Promise<IFriendship> {
    const res = await Toxen.fetch(Settings.getServer() + "/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error ?? "Failed to send friend request");
    return body;
  }

  public static async acceptFriendRequest(friendshipId: number): Promise<IFriendship> {
    const res = await Toxen.fetch(
      `${Settings.getServer()}/friends/${friendshipId}/accept`,
      { method: "PUT" }
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error ?? "Failed to accept request");
    return body;
  }

  public static async declineFriendRequest(friendshipId: number): Promise<void> {
    const res = await Toxen.fetch(
      `${Settings.getServer()}/friends/${friendshipId}/decline`,
      { method: "PUT" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? "Failed to decline request");
    }
  }

  public static async removeFriend(friendUserId: number): Promise<void> {
    const res = await Toxen.fetch(
      `${Settings.getServer()}/friends/${friendUserId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? "Failed to remove friend");
    }
  }
}

setInterval(() => {
  if (!User.userSessionRefresh || User.userSessionRefresh < new Date()) {
    User.userSessionRefresh = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
    User.refreshUser();
  }
}, 5000);

interface IUser {
  id: number;
  name: string;
  email: string;
  token: string;
  premium: boolean;
  premium_tier: string | null;
  premium_expire: string;
  storage_used: number;
  storage_quota: number;
  roles: string[];
}