import { io, Socket } from "socket.io-client";
import Settings from "./Settings";

export interface PresenceNowPlaying {
  title?: string;
  artist?: string;
  album?: string;
  uid?: string;
  duration?: number;
}

export interface FriendPresence {
  userId: number;
  status: "online" | "offline";
  nowPlaying?: PresenceNowPlaying | null;
}

export interface IFriendUser {
  id: number;
  name: string;
  email: string;
}

export interface IFriendship {
  id: number;
  status: "pending" | "accepted" | "declined";
  requester: IFriendUser;
  addressee: IFriendUser;
  createdAt: string;
}

type SocketEventMap = {
  friend_presence: (presence: FriendPresence) => void;
  friends_presence: (presences: FriendPresence[]) => void;
  friend_request: (friendship: IFriendship) => void;
  friend_accepted: (friendship: IFriendship) => void;
};

class FriendSocket {
  private socket: Socket | null = null;
  private _presences = new Map<number, FriendPresence>();
  private _handlers: Partial<SocketEventMap> = {};

  /** Connect to the realtime socket server using the current user's token. */
  public connect() {
    if (this.socket?.connected) return;

    // Read token directly from localStorage (avoids circular import with User)
    let token: string | null = null;
    try {
      const stored = window.localStorage.getItem("user");
      token = stored ? JSON.parse(stored)?.token ?? null : null;
    } catch {
      return;
    }
    if (!token) return;

    // Strip /api suffix from server URL to get the socket root
    const serverUrl = Settings.getServer().replace(/\/api\/?$/, "");

    this.socket = io(serverUrl, {
      auth: { token },
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      console.log("[FriendSocket] Connected");
    });

    this.socket.on("connect_error", (err) => {
      console.warn("[FriendSocket] Connection error:", err.message);
    });

    this.socket.on("friends_presence", (presences: FriendPresence[]) => {
      for (const p of presences) {
        this._presences.set(p.userId, p);
      }
      this._handlers.friends_presence?.(presences);
    });

    this.socket.on("friend_presence", (presence: FriendPresence) => {
      this._presences.set(presence.userId, presence);
      this._handlers.friend_presence?.(presence);
    });

    this.socket.on("friend_request", (friendship: IFriendship) => {
      this._handlers.friend_request?.(friendship);
    });

    this.socket.on("friend_accepted", (friendship: IFriendship) => {
      this._handlers.friend_accepted?.(friendship);
    });

    this.socket.on("disconnect", () => {
      console.log("[FriendSocket] Disconnected");
    });
  }

  public disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this._presences.clear();
  }

  public isConnected() {
    return this.socket?.connected ?? false;
  }

  /** Broadcast what is currently playing to friends. Pass null to clear. */
  public sendNowPlaying(data: PresenceNowPlaying | null) {
    if (!this.socket?.connected) return;
    this.socket.emit("now_playing", data);
  }

  public getPresence(userId: number): FriendPresence | undefined {
    return this._presences.get(userId);
  }

  public getAllPresences(): FriendPresence[] {
    return Array.from(this._presences.values());
  }

  public on<E extends keyof SocketEventMap>(event: E, handler: SocketEventMap[E]) {
    this._handlers[event] = handler as any;
  }

  public off(event: keyof SocketEventMap) {
    delete this._handlers[event];
  }
}

export const friendSocket = new FriendSocket();
export default FriendSocket;
