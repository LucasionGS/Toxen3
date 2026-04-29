import { Alert, Badge, Button, Checkbox, Group, Loader, Stack, Text, TextInput } from "@mantine/core";
import React from "react";
import { Toxen } from "../../../../ToxenApp";
import type Provider from "../../../../toxen/providers/Provider";
import type { ProviderSearchResult } from "../../../../toxen/providers/Provider";
import ProviderManager from "../../../../toxen/providers/ProviderManager";

export default function ProviderIntegrations() {
  const [version, setVersion] = React.useState(0);
  const providers = ProviderManager.getAll();
  const refresh = () => setVersion(value => value + 1);

  if (providers.length === 0) {
    return <Text>No providers available.</Text>;
  }

  return (
    <Stack gap="md" key={version}>
      {providers.map(provider => (
        <ProviderIntegration key={provider.id} provider={provider} onChange={refresh} />
      ))}
    </Stack>
  );
}


function ProviderIntegration(props: {
  provider: Provider;
  onChange: () => void;
}) {
  const { provider, onChange } = props;
  const fields = provider.getConfigurationFields();
  const [enabled, setEnabled] = React.useState(provider.isEnabled());
  const [busy, setBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<ProviderSearchResult[]>([]);
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    fields.forEach(field => {
      values[field.key] = String(provider.getOption(field.key, "") ?? "");
    });
    return values;
  });

  const setProviderEnabled = async (value: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await provider.setEnabled(value);
      setEnabled(provider.isEnabled());
      onChange();
    } catch (err) {
      setEnabled(provider.isEnabled());
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveConfiguration = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const field of fields) {
        await provider.setOption(field.key, fieldValues[field.key]?.trim() ?? "");
      }
      onChange();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const authenticate = async () => {
    setBusy(true);
    setError(null);
    try {
      await provider.authenticate();
      onChange();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const search = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) return;

    setSearching(true);
    setError(null);
    try {
      setResults(await provider.search(nextQuery));
    } catch (err) {
      setResults([]);
      setError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const addSong = async (result: ProviderSearchResult) => {
    setBusy(true);
    setError(null);
    try {
      const song = await ProviderManager.addSongFromSearchResult(provider.id, result);
      Toxen.notify({
        title: "Song added",
        content: song.getDisplayName(),
        expiresIn: 3000,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: 12 }}>
      <Group justify="space-between" align="flex-start" gap="md">
        <div>
          <Text fw={700}>{provider.displayName}</Text>
          {provider.description && <Text size="sm" opacity={0.7}>{provider.description}</Text>}
        </div>
        <Badge color={enabled ? "green" : "gray"}>{enabled ? "Enabled" : "Disabled"}</Badge>
      </Group>

      <Stack gap="xs" mt="sm">
        <Checkbox
          checked={enabled}
          disabled={busy}
          label="Enabled"
          onChange={event => setProviderEnabled(event.currentTarget.checked)}
        />

        {provider.requiresAuthentication && (
          <Group gap="xs">
            <Badge color={provider.isAuthenticated() ? "green" : "yellow"}>
              {provider.isAuthenticated() ? "Authenticated" : "Authentication required"}
            </Badge>
            <Button size="xs" disabled={busy} onClick={authenticate}>Authenticate</Button>
          </Group>
        )}

        {fields.map(field => (
          <React.Fragment key={field.key}>
            <TextInput
              type={field.type ?? "text"}
              label={field.label}
              placeholder={field.placeholder}
              value={fieldValues[field.key] ?? ""}
              onChange={event => setFieldValues(values => ({ ...values, [field.key]: event.currentTarget.value }))}
              onBlur={saveConfiguration}
              onKeyDown={event => {
                if (event.key === "Enter") saveConfiguration();
              }}
            />
            {field.description && <sup>{field.description}</sup>}
          </React.Fragment>
        ))}

        {error && <Alert color="red">{error}</Alert>}

        {enabled && provider.canSearch() && (
          <form onSubmit={search}>
            <Group gap="xs" align="end">
              <TextInput
                style={{ flex: 1 }}
                label="Search"
                value={query}
                onChange={event => setQuery(event.currentTarget.value)}
                rightSection={searching ? <Loader size="xs" /> : null}
              />
              <Button type="submit" disabled={searching || !query.trim()}>Search</Button>
            </Group>
          </form>
        )}

        {results.length > 0 && (
          <Stack gap="xs">
            {results.map(result => (
              <Group key={result.trackId} justify="space-between" align="center" gap="sm" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
                <Group gap="sm" style={{ minWidth: 0, flex: 1 }}>
                  {result.artworkUrl && (
                    <img src={result.artworkUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>{result.title}</Text>
                    <Text size="sm" opacity={0.7} truncate>{result.artist ?? provider.displayName}</Text>
                  </div>
                </Group>
                <Button size="xs" disabled={busy} onClick={() => addSong(result)}>Add</Button>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}