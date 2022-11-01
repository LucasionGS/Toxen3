import Settings from "./Settings";
import Song from "./Song";
import User from "./User";

export default class Remote {
  public static getUser() {
    const userData = window.localStorage.getItem("user");
    if (!userData) return null;
    const user = User.create(JSON.parse(userData));

    return user;
  }

  public static getToken() {
    return Remote.getUser()?.token || null
  }

  public static async compareLocalAndRemote() {
    const songs = {
      local: await Song.loadLocalSongs(),
      remote: await Song.loadRemoteSongs()
    };

    const localSongs = songs.local;
    const remoteSongs = songs.remote;

    const localSongIds = localSongs.map(song => song.uid);
    const remoteSongIds = remoteSongs.map(song => song.uid);

    const localSongIdsToDelete = localSongIds.filter(
      localSongId => !remoteSongIds.includes(localSongId)
    );

    const remoteSongIdsToDelete = remoteSongIds.filter(
      remoteSongId => !localSongIds.includes(remoteSongId)
    );

    const localSongIdsToUpdate = localSongIds.filter(
      localSongId => remoteSongIds.includes(localSongId)
    );

    const remoteSongIdsToUpdate = remoteSongIds.filter(
      remoteSongId => localSongIds.includes(remoteSongId)
    );

    const localSongIdsToUpload = localSongIds.filter(
      localSongId => !remoteSongIds.includes(localSongId)
    );

    const remoteSongIdsToDownload = remoteSongIds.filter(
      remoteSongId => !localSongIds.includes(remoteSongId)
    );

    return {
      localSongs,
      remoteSongs,
      localSongIds,
      remoteSongIds,
      localSongIdsToDelete,
      remoteSongIdsToDelete,
      localSongIdsToUpdate,
      remoteSongIdsToUpdate,
      localSongIdsToUpload,
      remoteSongIdsToDownload
    };
  }
}