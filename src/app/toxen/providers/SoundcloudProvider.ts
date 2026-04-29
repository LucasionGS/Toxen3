import type Song from "../Song";
import Settings from "../Settings";
import User from "../User";
import { Toxen } from "../../ToxenApp";
import Provider from "./Provider";
import type { ProviderAudioSource, ProviderConfigurationField, ProviderSearchResult } from "./Provider";

interface SoundCloudUser {
  username?: string;
}

interface SoundCloudTranscoding {
  url: string;
  preset?: string;
  format?: {
    protocol?: string;
    mime_type?: string;
  };
}

interface SoundCloudTrack {
  id: number;
  title?: string;
  duration?: number;
  permalink_url?: string;
  artwork_url?: string;
  stream_url?: string;
  user?: SoundCloudUser;
  media?: {
    transcodings?: SoundCloudTranscoding[];
  };
}

interface SoundCloudSearchResponse {
  collection?: SoundCloudTrack[];
}

interface SoundCloudClientIdResponse {
  clientId?: string;
}

export default class SoundcloudProvider extends Provider {
  public readonly id = "soundcloud";
  public readonly displayName = "SoundCloud";
  public readonly description = "Direct streaming from public SoundCloud tracks.";

  private static readonly apiBase = "https://api-v2.soundcloud.com";
  private clientIdDiscovery: Promise<string> | null = null;

  public getConfigurationFields(): ProviderConfigurationField[] {
    return [
      {
        key: "clientId",
        label: "Client ID",
        placeholder: "Auto-detected when empty",
        type: "text",
      },
    ];
  }

  public async search(query: string): Promise<ProviderSearchResult[]> {
    const clientId = await this.getClientId();

    if (this.shouldUseProxy()) {
      const data = await this.fetchProxyJson<SoundCloudSearchResponse>("/search/tracks", {
        q: query,
        client_id: clientId,
        limit: 20,
        app_locale: "en",
      }, "SoundCloud search failed");

      return (data.collection ?? [])
        .filter(track => track?.id && track.title)
        .map(track => this.trackToSearchResult(track));
    }

    const searchUrl = new URL(`${SoundcloudProvider.apiBase}/search/tracks`);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("client_id", clientId);
    searchUrl.searchParams.set("limit", "20");
    searchUrl.searchParams.set("app_locale", "en");

    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      throw new Error(`SoundCloud search failed (${response.status}).`);
    }

    const data = await response.json() as SoundCloudSearchResponse;
    return (data.collection ?? [])
      .filter(track => track?.id && track.title)
      .map(track => this.trackToSearchResult(track));
  }

  public async getAudioSource(song: Song): Promise<ProviderAudioSource> {
    const clientId = await this.getClientId();
    const reference = song.provider;
    let track: SoundCloudTrack | null = null;

    if (reference?.trackId) {
      track = await this.getTrack(reference.trackId, clientId);
    }
    else if (reference?.url) {
      track = await this.resolveTrack(reference.url, clientId);
    }

    if (!track) {
      throw new Error("SoundCloud track information is missing.");
    }

    const url = await this.getStreamUrl(track, clientId);
    return {
      url,
      crossOrigin: "anonymous",
    };
  }

  private async getClientId(): Promise<string> {
    const configured = this.getOption<string>("clientId", "")?.trim();
    if (configured) return configured;

    if (!this.clientIdDiscovery) {
      this.clientIdDiscovery = this.discoverClientId().then(async clientId => {
        if (clientId) {
          await this.setOption("clientId", clientId);
        }
        return clientId;
      });
    }

    const discovered = await this.clientIdDiscovery;
    if (!discovered) {
      throw new Error("SoundCloud requires a client ID. Add one in the integration settings.");
    }

    return discovered;
  }

  private async discoverClientId(): Promise<string> {
    if (this.shouldUseProxy()) {
      const data = await this.fetchProxyJson<SoundCloudClientIdResponse>("/client-id", undefined, "Unable to auto-detect SoundCloud client ID");
      return data.clientId ?? "";
    }

    try {
      const homepage = await fetch("https://soundcloud.com/").then(res => res.text());
      const scriptUrls = Array.from(homepage.matchAll(/<script[^>]+src="([^"]+\.js)"/g))
        .map(match => match[1])
        .map(src => src.startsWith("http") ? src : `https://soundcloud.com${src}`)
        .reverse()
        .slice(0, 12);

      for (const scriptUrl of scriptUrls) {
        const script = await fetch(scriptUrl).then(res => res.ok ? res.text() : "").catch(() => "");
        const match = script.match(/client_id\s*[:=]\s*["']([a-zA-Z0-9_-]{32})["']/)
          ?? script.match(/[?&]client_id=([a-zA-Z0-9_-]{32})/);
        if (match?.[1]) return match[1];
      }
    } catch (error) {
      console.warn("Unable to auto-detect SoundCloud client ID", error);
    }

    return "";
  }

  private async getTrack(trackId: string, clientId: string): Promise<SoundCloudTrack> {
    if (this.shouldUseProxy()) {
      return await this.fetchProxyJson<SoundCloudTrack>(`/tracks/${encodeURIComponent(trackId)}`, {
        client_id: clientId,
      }, "Unable to load SoundCloud track");
    }

    const url = new URL(`${SoundcloudProvider.apiBase}/tracks/${encodeURIComponent(trackId)}`);
    url.searchParams.set("client_id", clientId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Unable to load SoundCloud track (${response.status}).`);
    }

    return await response.json() as SoundCloudTrack;
  }

  private async resolveTrack(trackUrl: string, clientId: string): Promise<SoundCloudTrack> {
    if (this.shouldUseProxy()) {
      return await this.fetchProxyJson<SoundCloudTrack>("/resolve", {
        url: trackUrl,
        client_id: clientId,
      }, "Unable to resolve SoundCloud URL");
    }

    const url = new URL(`${SoundcloudProvider.apiBase}/resolve`);
    url.searchParams.set("url", trackUrl);
    url.searchParams.set("client_id", clientId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Unable to resolve SoundCloud URL (${response.status}).`);
    }

    return await response.json() as SoundCloudTrack;
  }

  private async getStreamUrl(track: SoundCloudTrack, clientId: string): Promise<string> {
    if (this.shouldUseProxy()) {
      return User.appendAuth(this.getProxyUrl("/stream", {
        track_id: track.id ? String(track.id) : undefined,
        url: track.id ? undefined : track.permalink_url,
        client_id: clientId,
      }));
    }

    const transcodings = track.media?.transcodings ?? [];
    const progressive = transcodings.find(item => (
      item.format?.protocol === "progressive"
      && (item.format?.mime_type?.includes("mpeg") || item.preset?.includes("mp3"))
    )) ?? transcodings.find(item => item.format?.protocol === "progressive");

    if (progressive?.url) {
      const response = await fetch(this.withClientId(progressive.url, clientId));
      if (!response.ok) {
        throw new Error(`Unable to fetch SoundCloud stream (${response.status}).`);
      }
      const data = await response.json() as { url?: string };
      if (data.url) return data.url;
    }

    if (track.stream_url) {
      return this.withClientId(track.stream_url, clientId);
    }

    throw new Error("This SoundCloud track does not expose a direct stream.");
  }

  private withClientId(url: string, clientId: string): string {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}client_id=${encodeURIComponent(clientId)}`;
  }

  private shouldUseProxy(): boolean {
    return !toxenapi.isDesktop();
  }

  private getProxyUrl(path: string, params?: Record<string, string | number | undefined>): string {
    const url = new URL(`${Settings.getServer()}/providers/soundcloud${path}`);
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  private async fetchProxyJson<ResponseType>(
    path: string,
    params: Record<string, string | number | undefined> | undefined,
    fallbackMessage: string
  ): Promise<ResponseType> {
    const response = await Toxen.fetch(this.getProxyUrl(path, params));
    if (!response.ok) {
      const body = await response.json().catch((): null => null);
      throw new Error(body?.error || `${fallbackMessage} (${response.status}).`);
    }
    return await response.json() as ResponseType;
  }

  private trackToSearchResult(track: SoundCloudTrack): ProviderSearchResult {
    return {
      providerId: this.id,
      trackId: String(track.id),
      title: track.title ?? "Unknown Title",
      artist: track.user?.username ?? "Unknown Artist",
      url: track.permalink_url,
      artworkUrl: this.getArtworkUrl(track.artwork_url),
      duration: track.duration,
      sourceData: track,
    };
  }

  private upgradeArtwork(artworkUrl?: string): string | undefined {
    if (!artworkUrl) return artworkUrl;
    return artworkUrl.replace("-large", "-t500x500");
  }

  private getArtworkUrl(artworkUrl?: string): string | undefined {
    const upgraded = this.upgradeArtwork(artworkUrl);
    if (!upgraded || !this.shouldUseProxy()) return upgraded;
    return User.appendAuth(this.getProxyUrl("/artwork", { url: upgraded }));
  }
}
