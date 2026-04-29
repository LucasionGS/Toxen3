import Settings from "../Settings";
import type Song from "../Song";
import type { ISong } from "../Song";

export type ProviderCrossOrigin = "anonymous" | "use-credentials" | "";

export interface ProviderAudioSource {
  url: string;
  crossOrigin?: ProviderCrossOrigin;
  revoke?: () => void;
}

export interface ProviderSongReference {
  id: string;
  trackId?: string;
  url?: string;
  title?: string;
  artist?: string;
  artworkUrl?: string;
  duration?: number;
  data?: Record<string, unknown>;
}

export interface ProviderSearchResult {
  providerId: string;
  trackId: string;
  title: string;
  artist?: string;
  album?: string;
  url?: string;
  artworkUrl?: string;
  duration?: number;
  sourceData?: unknown;
}

export interface ProviderSettings {
  enabled?: boolean;
  auth?: Record<string, unknown> | null;
  options?: Record<string, unknown>;
}

export type ProviderSettingsMap = Record<string, ProviderSettings>;

export interface ProviderConfigurationField {
  key: string;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  type?: "text" | "password";
}

export default abstract class Provider {
  public abstract readonly id: string;
  public abstract readonly displayName: string;
  public readonly description?: string;
  public readonly requiresAuthentication = false;

  public getSettings(): ProviderSettings {
    return Settings.get("providers", {} as ProviderSettingsMap)?.[this.id] ?? {};
  }

  public async saveSettings(settings: ProviderSettings): Promise<void> {
    const providers = { ...(Settings.get("providers", {} as ProviderSettingsMap) ?? {}) };
    providers[this.id] = {
      ...(providers[this.id] ?? {}),
      ...settings,
      options: {
        ...(providers[this.id]?.options ?? {}),
        ...(settings.options ?? {}),
      },
      auth: settings.auth === undefined
        ? providers[this.id]?.auth
        : settings.auth,
    };

    await Settings.apply({ providers }, true);
  }

  public isEnabled(): boolean {
    return this.getSettings().enabled ?? false;
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    if (enabled && this.requiresAuthentication && !this.isAuthenticated()) {
      await this.authenticate();
    }

    if (enabled && this.requiresAuthentication && !this.isAuthenticated()) {
      throw new Error(`${this.displayName} requires authentication before it can be enabled.`);
    }

    await this.saveSettings({ enabled });
  }

  public isAuthenticated(): boolean {
    return !this.requiresAuthentication || Boolean(this.getSettings().auth);
  }

  public async authenticate(): Promise<void> {
    throw new Error(`${this.displayName} does not define an authentication flow yet.`);
  }

  public async clearAuthentication(): Promise<void> {
    await this.saveSettings({ auth: null });
  }

  public getOption<ValueType = unknown>(key: string, fallback?: ValueType): ValueType {
    const value = this.getSettings().options?.[key];
    return (value ?? fallback) as ValueType;
  }

  public async setOption(key: string, value: unknown): Promise<void> {
    await this.saveSettings({ options: { [key]: value } });
  }

  public getConfigurationFields(): ProviderConfigurationField[] {
    return [];
  }

  public canSearch(): boolean {
    return true;
  }

  public async getInitialSongData(result: ProviderSearchResult): Promise<Partial<ISong>> {
    return {
      artist: result.artist,
      title: result.title,
      album: result.album,
      source: this.displayName,
      url: result.url,
      duration: result.duration,
      provider: {
        id: this.id,
        trackId: result.trackId,
        url: result.url,
        title: result.title,
        artist: result.artist,
        artworkUrl: result.artworkUrl,
        duration: result.duration,
      },
    };
  }

  public abstract search(query: string): Promise<ProviderSearchResult[]>;
  public abstract getAudioSource(song: Song): Promise<ProviderAudioSource>;
}
