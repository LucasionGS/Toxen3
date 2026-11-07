import { io, Socket } from "socket.io-client";
import Settings from "./Settings";
import { SyncV2 } from "./sync/SyncApi";

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
  // Sync v2: a track of this user changed on the server (from any device, this one included)
  [SyncV2.SocketEvent.TrackChanged]: (event: SyncV2.TrackChangedEvent) => void;
  // The socket (re)connected; `reconnect` is `false` for the first connection
  connected: (reconnect: boolean) => void;
};

class FriendSocket {
  private socket: Socket | null = null;
  private _presences = new Map<number, FriendPresence>();
  private _listeners = new Map<keyof SocketEventMap, Map<symbol, Function>>();

  private _emit<E extends keyof SocketEventMap>(event: E, ...args: Parameters<SocketEventMap[E]>) {
    const bucket = this._listeners.get(event);
    if (bucket) {
      for (const fn of bucket.values()) {
        (fn as any)(...args);
      }
    }
  }

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

    // Websocket first: the server is websocket only. Reconnects never give up, because sync relies on the socket
    // to hear about changes from other devices (with a slow backoff, so a server that is down isn't hammered).
    this.socket = io(serverUrl, {
      auth: { token },
      reconnectionDelayMax: 60 * 1000,
      transports: ["websocket", "polling"],
    });

    let connectedBefore = false;
    this.socket.on("connect", () => {
      console.log("[FriendSocket] Connected");
      this._emit("connected", connectedBefore);
      connectedBefore = true;
    });

    this.socket.on(SyncV2.SocketEvent.TrackChanged, (event: SyncV2.TrackChangedEvent) => {
      this._emit(SyncV2.SocketEvent.TrackChanged, event);
    });

    this.socket.on("connect_error", (err) => {
      console.warn("[FriendSocket] Connection error:", err.message);
    });

    this.socket.on("friends_presence", (presences: FriendPresence[]) => {
      for (const p of presences) {
        this._presences.set(p.userId, p);
      }
      this._emit("friends_presence", presences);
    });

    this.socket.on("friend_presence", (presence: FriendPresence) => {
      this._presences.set(presence.userId, presence);
      this._emit("friend_presence", presence);
    });

    this.socket.on("friend_request", (friendship: IFriendship) => {
      this._emit("friend_request", friendship);
    });

    this.socket.on("friend_accepted", (friendship: IFriendship) => {
      this._emit("friend_accepted", friendship);
    });

    this.socket.on("disconnect", () => {
      console.log("[FriendSocket] Disconnected");
    });
  }

  /**
   * Disconnect (logout). Subscriptions stay, so they keep working after the next `connect`.
   */
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

  /**
   * Subscribe to a socket event. Returns an unsubscribe function.
   */
  public on<E extends keyof SocketEventMap>(event: E, handler: SocketEventMap[E]): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Map());
    }
    const key = Symbol();
    this._listeners.get(event)!.set(key, handler as Function);
    return () => this._listeners.get(event)?.delete(key);
  }

  public off(event: keyof SocketEventMap) {
    this._listeners.delete(event);
  }
}

export const friendSocket = new FriendSocket();
export default FriendSocket;
