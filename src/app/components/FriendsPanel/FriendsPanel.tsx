import React, { useCallback, useEffect, useRef, useState } from "react";
import { friendSocket, IFriendship, FriendPresence } from "../../toxen/FriendSocket";


/** Badge shown on the Friends sidebar icon with the count of online friends. */
export function FriendsIconBadge() {
  const [onlineCount, setOnlineCount] = useState(() =>
    friendSocket.getAllPresences().filter((p) => p.status === "online").length
  );

  useEffect(() => {
    const update = () => {
      setOnlineCount(
        friendSocket.getAllPresences().filter((x) => x.status === "online").length
      );
    };
    const offPresence = friendSocket.on("friend_presence", update);
    const offPresences = friendSocket.on("friends_presence", update);
    return () => {
      offPresence();
      offPresences();
    };
  }, []);

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <i className="fas fa-user-friends" />
      {onlineCount > 0 && (
        <span style={{
          position: "absolute",
          top: "-6px",
          right: "-8px",
          background: "var(--accent-color, #5b8af5)",
          color: "#fff",
          borderRadius: "50%",
          minWidth: "16px",
          height: "16px",
          fontSize: "10px",
          fontWeight: 700,
          lineHeight: "16px",
          textAlign: "center",
          padding: "0 3px",
          boxSizing: "border-box",
          pointerEvents: "none",
        }}>
          {onlineCount > 99 ? "99+" : onlineCount}
        </span>
      )}
    </span>
  );
}
import {
  ActionIcon,
  Button,
  Divider,
  Loader,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconCheck,
  IconMusic,
  IconUserMinus,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import User from "../../toxen/User";
import { Toxen } from "../../ToxenApp";
import "./FriendsPanel.scss";

function avatarLetter(name: string) {
  return (name?.[0] ?? "?").toUpperCase();
}

export default function FriendsPanel() {
  const [friends, setFriends] = useState<IFriendship[]>([]);
  const [pending, setPending] = useState<IFriendship[]>([]);
  const [presences, setPresences] = useState<Map<number, FriendPresence>>(new Map());
  const [addEmail, setAddEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const presencesRef = useRef(presences);
  presencesRef.current = presences;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await User.getFriends();
      setFriends(data.friends);
      setPending(data.pending);
    } catch (err: any) {
      Toxen.error(err?.message ?? "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Setup real-time handlers
    const offFriendsPresence = friendSocket.on("friends_presence", (list) => {
      setPresences((prev) => {
        const next = new Map(prev);
        for (const p of list) next.set(p.userId, p);
        return next;
      });
    });

    const offFriendPresence = friendSocket.on("friend_presence", (p) => {
      setPresences((prev) => new Map(prev).set(p.userId, p));
    });

    const offFriendRequest = friendSocket.on("friend_request", (fs) => {
      setPending((prev) => {
        if (prev.some((x) => x.id === fs.id)) return prev;
        return [...prev, fs];
      });
      Toxen.log(`Friend request from ${fs.requester.name}`);
    });

    const offFriendAccepted = friendSocket.on("friend_accepted", (fs) => {
      setFriends((prev) => {
        if (prev.some((x) => x.id === fs.id)) return prev;
        return [...prev, fs];
      });
      Toxen.log(`${fs.addressee.name} accepted your friend request`);
    });

    return () => {
      offFriendsPresence();
      offFriendPresence();
      offFriendRequest();
      offFriendAccepted();
    };
  }, [refresh]);

  // Merge real-time presences from socket into the map on mount
  useEffect(() => {
    const all = friendSocket.getAllPresences();
    if (all.length > 0) {
      const map = new Map<number, FriendPresence>();
      for (const p of all) map.set(p.userId, p);
      setPresences(map);
    }
  }, []);

  const handleAddFriend = async () => {
    const email = addEmail.trim();
    if (!email) return;
    setAddLoading(true);
    try {
      const fs = await User.sendFriendRequest(email);
      setAddEmail("");
      if (fs.status === "accepted") {
        setFriends((prev) => [...prev, fs]);
        Toxen.log("You are now friends!");
      } else {
        Toxen.log(`Friend request sent to ${fs.addressee.name}`);
      }
    } catch (err: any) {
      Toxen.error(err?.message ?? "Failed to send friend request");
    } finally {
      setAddLoading(false);
    }
  };

  const handleAccept = async (fs: IFriendship) => {
    try {
      const accepted = await User.acceptFriendRequest(fs.id);
      setPending((prev) => prev.filter((x) => x.id !== fs.id));
      setFriends((prev) => [...prev, accepted]);
      Toxen.log(`You are now friends with ${accepted.requester.name}`);
    } catch (err: any) {
      Toxen.error(err?.message ?? "Failed to accept request");
    }
  };

  const handleDecline = async (fs: IFriendship) => {
    try {
      await User.declineFriendRequest(fs.id);
      setPending((prev) => prev.filter((x) => x.id !== fs.id));
    } catch (err: any) {
      Toxen.error(err?.message ?? "Failed to decline request");
    }
  };

  const handleRemove = async (fs: IFriendship, currentUserId: number) => {
    const friendUser =
      fs.requester.id === currentUserId ? fs.addressee : fs.requester;
    try {
      await User.removeFriend(friendUser.id);
      setFriends((prev) => prev.filter((x) => x.id !== fs.id));
      Toxen.log(`Removed ${friendUser.name} from friends`);
    } catch (err: any) {
      Toxen.error(err?.message ?? "Failed to remove friend");
    }
  };

  const currentUser = User.getCurrentUser();
  const currentUserId = currentUser?.id ?? -1;

  // Sort: online first, then offline
  const sortedFriends = [...friends].sort((a, b) => {
    const aFriendId =
      a.requester.id === currentUserId ? a.addressee.id : a.requester.id;
    const bFriendId =
      b.requester.id === currentUserId ? b.addressee.id : b.requester.id;
    const aOnline = presences.get(aFriendId)?.status === "online" ? 0 : 1;
    const bOnline = presences.get(bFriendId)?.status === "online" ? 0 : 1;
    return aOnline - bOnline;
  });

  return (
    <div className="friends-panel">
      <h2>Add Friend</h2>
      <div className="add-friend-form">
        <TextInput
          placeholder="friend@example.com"
          value={addEmail}
          onChange={(e) => setAddEmail(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
          style={{ flex: 1 }}
          size="sm"
        />
        <Button
          size="sm"
          leftSection={<IconUserPlus size={15} />}
          onClick={handleAddFriend}
          loading={addLoading}
          disabled={!addEmail.trim()}
        >
          Add
        </Button>
      </div>

      {pending.length > 0 && (
        <>
          <Divider my="sm" />
          <h2>Pending Requests — {pending.length}</h2>
          {pending.map((fs) => (
            <div key={fs.id} className="friend-item">
              <div className="avatar">{avatarLetter(fs.requester.name)}</div>
              <div className="friend-info">
                <div className="friend-name">{fs.requester.name}</div>
                <div className="friend-activity">{fs.requester.email}</div>
              </div>
              <div className="friend-actions">
                <Tooltip label="Accept">
                  <ActionIcon
                    color="green"
                    variant="light"
                    size="sm"
                    onClick={() => handleAccept(fs)}
                  >
                    <IconCheck size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Decline">
                  <ActionIcon
                    color="red"
                    variant="light"
                    size="sm"
                    onClick={() => handleDecline(fs)}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Tooltip>
              </div>
            </div>
          ))}
        </>
      )}

      <Divider my="sm" />
      <h2>
        Friends{loading ? " " : ` — ${friends.length}`}
        {loading && <Loader size="xs" ml="xs" />}
      </h2>

      {!loading && sortedFriends.length === 0 && (
        <div className="empty-state">No friends yet. Add someone!</div>
      )}

      {sortedFriends.map((fs) => {
        const friendUser =
          fs.requester.id === currentUserId ? fs.addressee : fs.requester;
        const presence = presences.get(friendUser.id);
        const isOnline = presence?.status === "online";
        const nowPlaying = presence?.nowPlaying;

        return (
          <div key={fs.id} className="friend-item">
            <div className="avatar">
              {avatarLetter(friendUser.name)}
              <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
            </div>
            <div className="friend-info">
              <div className="friend-name">{friendUser.name}</div>
              <div className="friend-activity">
                {nowPlaying ? (
                  <>
                    <span className="playing-icon">
                      <IconMusic size={10} />
                    </span>
                    {[nowPlaying.artist, nowPlaying.title]
                      .filter(Boolean)
                      .join(" — ") || "Listening to music"}
                  </>
                ) : isOnline ? (
                  "Online"
                ) : (
                  "Offline"
                )}
              </div>
            </div>
            <div className="friend-actions">
              <Tooltip label="Remove friend">
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="sm"
                  onClick={() => handleRemove(fs, currentUserId)}
                >
                  <IconUserMinus size={14} />
                </ActionIcon>
              </Tooltip>
            </div>
          </div>
        );
      })}

      <Divider my="sm" />
      <Text size="xs" c="dimmed" ta="center">
        Friends see what you&apos;re listening to in real time
      </Text>
    </div>
  );
}
