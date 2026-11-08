import Settings from "../Settings";
import Song from "../Song";
import type { ISong } from "../Song";
import { Toxen } from "../../ToxenApp";
import Provider from "./Provider";
import type { ProviderAudioSource, ProviderSearchResult } from "./Provider";
import SoundcloudProvider from "./SoundcloudProvider";
import { SongStorage } from "../storage/SongStorage";
import { StorageSelector } from "../storage/StorageSelector";

export default class ProviderManager {
  private static providers = new Map<string, Provider>();

  public static register(provider: Provider): Provider {
    ProviderManager.providers.set(provider.id, provider);
    return provider;
  }

  public static get(providerId: string): Provider | null {
    return ProviderManager.providers.get(providerId) ?? null;
  }

  public static getAll(): Provider[] {
    return Array.from(ProviderManager.providers.values());
  }

  public static isProviderSong(song: Pick<ISong, "provider"> | Song): boolean {
    return Boolean(song?.provider?.id);
  }

  public static async getAudioSource(song: Song): Promise<ProviderAudioSource> {
    const provider = ProviderManager.get(song.provider?.id);
    if (!provider) {
      throw new Error(`Unknown song provider: ${song.provider?.id ?? "<missing>"}`);
    }

    if (!provider.isEnabled()) {
      throw new Error(`${provider.displayName} integration is disabled.`);
    }

    return await provider.getAudioSource(song);
  }

  public static async addSongFromSearchResult(providerId: string, result: ProviderSearchResult): Promise<Song> {
    const provider = ProviderManager.get(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);
    if (!provider.isEnabled()) throw new Error(`${provider.displayName} integration is disabled.`);
    if (StorageSelector.forLibrary().kind !== SongStorage.Kind.Local && !Settings.getUser()) throw new Error("Log in before adding provider songs to the remote library.");

    const uid = Song.generateUID();
    const dirname = await ProviderManager.createSongDirectory(uid, provider, result);
    const songData = await provider.getInitialSongData(result);

    const song = Song.create({
      ...songData,
      uid,
      paths: {
        dirname,
        media: "",
        background: "",
        subtitles: "",
        storyboard: "",
        ...(songData.paths ?? {}),
      },
      provider: {
        id: provider.id,
        trackId: result.trackId,
        url: result.url,
        title: result.title,
        artist: result.artist,
        artworkUrl: result.artworkUrl,
        duration: result.duration,
        ...(songData.provider ?? {}),
      },
    });

    await ProviderManager.trySaveArtwork(song, result.artworkUrl);
    await song.saveInfo();

    if (!Toxen.songList) Toxen.songList = [];
    Toxen.songList.push(song);
    Song.sortSongs(Toxen.songList);
    Toxen.updateSongPanels();

    return song;
  }

  private static async createSongDirectory(uid: string, provider: Provider, result: ProviderSearchResult): Promise<string> {
    if (!toxenapi.isDesktop() || StorageSelector.forLibrary().kind !== SongStorage.Kind.Local) return uid;

    const libraryDirectory = Settings.get("libraryDirectory");
    if (!libraryDirectory) throw new Error("No music library folder is configured.");

    const baseName = ProviderManager.safePathSegment(`${result.artist ? `${result.artist} - ` : ""}${result.title}`)
      || ProviderManager.safePathSegment(`${provider.id}-${result.trackId}`)
      || uid;

    let dirname = baseName;
    let fullPath = toxenapi.path.resolve(libraryDirectory, dirname);
    let increment = 0;
    while (await ProviderManager.pathExists(fullPath)) {
      dirname = `${baseName} (${++increment})`;
      fullPath = toxenapi.path.resolve(libraryDirectory, dirname);
    }

    await toxenapi.fs.promises.mkdir(fullPath, { recursive: true });
    return dirname;
  }

  private static safePathSegment(value: string): string {
    return (value ?? "")
      .replace(/[^a-z0-9\(\)\[\]\{\}\.\-\_\s]/gi, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  private static async pathExists(path: string): Promise<boolean> {
    if (!toxenapi.isDesktop()) return false;
    return await toxenapi.fs.promises.stat(path).then(() => true).catch(() => false);
  }

  private static async trySaveArtwork(song: Song, artworkUrl?: string): Promise<void> {
    if (!artworkUrl) return;

    try {
      const response = await fetch(artworkUrl);
      if (!response.ok) return;

      const blob = await response.blob();
      const ext = ProviderManager.getArtworkExtension(artworkUrl);
      const fileName = `provider-artwork${ext}`;

      await song.storage.writeFile(song, fileName, blob);
      song.paths.background = fileName;
    } catch (error) {
      console.warn("Unable to save provider artwork", error);
    }
  }

  private static getArtworkExtension(artworkUrl: string): string {
    try {
      const ext = toxenapi.getFileExtension(new URL(artworkUrl).pathname).toLowerCase();
      if (Toxen.getSupportedImageFiles().includes(ext)) return ext;
    } catch {
      // Fall through to jpg.
    }
    return ".jpg";
  }
}

ProviderManager.register(new SoundcloudProvider());
