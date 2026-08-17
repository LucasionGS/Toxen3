import { Alert, Badge, Button, Checkbox, Group, Loader, NumberInput, Select, Slider, Stack, Text, TextInput } from "@mantine/core";
import { IconBulb, IconRefresh, IconSearch } from "@tabler/icons-react";
import React from "react";
import { Toxen } from "../../../../ToxenApp";
import Settings from "../../../../toxen/Settings";
import type { HueBridgeDevice, HueEntertainmentArea } from "../../../../toxen/desktop/hue/HueAPI";
import type { HueStatus } from "../../../../toxen/desktop/hue/HueManager";

const STATUS_LABELS: Record<HueStatus, { label: string; color: string }> = {
  disabled: { label: "Disabled", color: "gray" },
  unconfigured: { label: "Not configured", color: "gray" },
  connecting: { label: "Connecting…", color: "yellow" },
  connected: { label: "Connected", color: "cyan" },
  streaming: { label: "Streaming", color: "green" },
  error: { label: "Error", color: "red" },
};

const REGISTER_ATTEMPTS = 15;
const REGISTER_INTERVAL_MS = 2000;

/**
 * Settings > Hue: bridge pairing, entertainment area selection, and light-sync
 * options. Desktop-only (the tab itself is gated); all Hue access goes through
 * `Toxen.hue` so this file never pulls the desktop module graph into web builds.
 */
export default function HueSettings() {
  const hue = Toxen.hue;
  const [status, setStatus] = React.useState<HueStatus>(hue?.status ?? "disabled");
  const [lastError, setLastError] = React.useState<string | null>(hue?.lastError ?? null);
  const [bridges, setBridges] = React.useState<HueBridgeDevice[] | null>(null);
  const [discovering, setDiscovering] = React.useState(false);
  const [registeringIp, setRegisteringIp] = React.useState<string | null>(null);
  const [registerAttempt, setRegisterAttempt] = React.useState(0);
  const [areas, setAreas] = React.useState<HueEntertainmentArea[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [diagnosticsReport, setDiagnosticsReport] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [manualIp, setManualIp] = React.useState(Settings.get("hueBridgeIp") ?? "");

  const registered = !!(Settings.get("hueUsername") && Settings.get("hueClientkey"));

  // Keep the status badge live while the panel is open.
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!Toxen.hue) return;
      setStatus(Toxen.hue.status);
      setLastError(Toxen.hue.lastError);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAreas = React.useCallback(async () => {
    if (!Toxen.hue) return;
    try {
      setError(null);
      setAreas(await Toxen.hue.getEntertainmentAreas());
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }, []);

  React.useEffect(() => {
    if (registered) void fetchAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discover = async () => {
    setDiscovering(true);
    setError(null);
    try {
      setBridges(await hue.discoverBridges());
    } catch (err: any) {
      setBridges([]);
      setError(`Bridge discovery failed (${err?.message ?? err}). If your network blocks it, enter the bridge IP manually.`);
    } finally {
      setDiscovering(false);
    }
  };

  /** Press-link-button pairing: retries registration until the button is pressed. */
  const register = async (ip: string, bridgeId?: string) => {
    if (!ip) {
      setError("Enter or discover a bridge IP first.");
      return;
    }
    setRegisteringIp(ip);
    setError(null);
    Toxen.log("Press the link button on your Hue bridge…", REGISTER_ATTEMPTS * REGISTER_INTERVAL_MS);
    try {
      for (let attempt = 1; attempt <= REGISTER_ATTEMPTS; attempt++) {
        setRegisterAttempt(attempt);
        try {
          const credentials = await hue.registerBridge(ip);
          await Settings.apply({
            hueBridgeIp: ip,
            hueBridgeId: bridgeId ?? Settings.get("hueBridgeId") ?? "",
            hueUsername: credentials.username,
            hueClientkey: credentials.clientkey,
          }, true);
          Toxen.log("Hue bridge registered!", 3000);
          void fetchAreas();
          return;
        } catch (err: any) {
          const message: string = err?.message ?? String(err);
          // "link button not pressed" is the expected wait state; anything else is fatal.
          if (!/link button/i.test(message)) throw err;
          await new Promise(resolve => setTimeout(resolve, REGISTER_INTERVAL_MS));
        }
      }
      setError("The link button was not pressed in time. Try again.");
    } catch (err: any) {
      setError(`Registration failed: ${err?.message ?? err}`);
    } finally {
      setRegisteringIp(null);
      setRegisterAttempt(0);
    }
  };

  const identify = async () => {
    setBusy(true);
    setError(null);
    try {
      await hue.identify();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const runDiagnostics = async () => {
    setBusy(true);
    setDiagnosticsReport(null);
    try {
      setDiagnosticsReport(await hue.runDiagnostics());
    } finally {
      setBusy(false);
    }
  };

  if (!hue) return null; // web build — the tab is not rendered there anyway

  const statusInfo = STATUS_LABELS[status];

  return (
    <>
      <h2>Philips Hue</h2>
      <Checkbox
        onClick={(e) => Settings.apply({ hueEnabled: e.currentTarget.checked }, true)}
        defaultChecked={Settings.get("hueEnabled")}
        name="hueEnabled"
        label="Enable Hue light sync"
      />
      <sup>
        Streams your music to a Hue entertainment area in real time using the low-latency Hue Entertainment API.
        Lights follow the visualizer color and pulse with the audio, and storyboards can script them per song.
      </sup>

      <Group gap="xs" mt="sm" mb="sm">
        <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
        {status === "error" && lastError && <Text size="sm" c="red">{lastError}</Text>}
      </Group>

      <h3>Bridge</h3>
      {registered && (
        <Text size="sm">
          Registered with bridge at <b>{Settings.get("hueBridgeIp")}</b>
        </Text>
      )}
      <Stack gap="xs" mt="xs">
        <Group gap="xs" align="end">
          <TextInput
            style={{ flex: 1 }}
            label="Bridge IP"
            placeholder="e.g. 192.168.1.100"
            value={manualIp}
            onChange={(e) => setManualIp(e.currentTarget.value)}
            onBlur={() => {
              const ip = manualIp.trim();
              if (ip && ip !== Settings.get("hueBridgeIp")) void Settings.apply({ hueBridgeIp: ip }, true);
            }}
          />
          <Button
            leftSection={discovering ? <Loader size="xs" /> : <IconSearch size="1em" />}
            disabled={discovering || !!registeringIp}
            onClick={discover}
          >
            Discover
          </Button>
        </Group>
        <sup>Enter your bridge's IP manually, or discover bridges on your network automatically.</sup>

        {bridges?.length === 0 && !error && <Text size="sm">No bridges found on the network.</Text>}
        {bridges?.map(bridge => (
          <Group key={bridge.id} justify="space-between" gap="sm">
            <div>
              <Text fw={600}>{bridge.internalipaddress}</Text>
              <Text size="sm" opacity={0.7}>{bridge.id}</Text>
            </div>
            <Button
              size="xs"
              disabled={!!registeringIp}
              onClick={() => register(bridge.internalipaddress, bridge.id)}
            >
              {registeringIp === bridge.internalipaddress ? `Registering… (${registerAttempt}/${REGISTER_ATTEMPTS})` : "Register"}
            </Button>
          </Group>
        ))}

        <Group gap="xs">
          <Button
            disabled={!!registeringIp || !manualIp.trim()}
            onClick={() => register(manualIp.trim())}
          >
            {registeringIp && !bridges?.some(b => b.internalipaddress === registeringIp)
              ? `Registering… (${registerAttempt}/${REGISTER_ATTEMPTS})`
              : registered ? "Re-register" : "Register"}
          </Button>
        </Group>
        <sup>Press the link button on the bridge, then click Register.</sup>
      </Stack>

      {registered && (
        <>
          <h3>Entertainment area</h3>
          <Group gap="xs" align="end">
            <Select
              style={{ flex: 1 }}
              label="Area"
              allowDeselect={false}
              placeholder={areas ? (areas.length ? "Select an area" : "No areas found — create one in the Hue app") : "Loading…"}
              value={Settings.get("hueEntertainmentAreaId") || null}
              data={(areas ?? []).map(area => ({
                value: area.id,
                label: `${area.metadata?.name ?? area.id} (${area.channels?.length ?? 0} channels)`,
              }))}
              onChange={(value) => {
                if (value) void Settings.apply({ hueEntertainmentAreaId: value }, true);
              }}
            />
            <Button variant="subtle" leftSection={<IconRefresh size="1em" />} onClick={fetchAreas}>
              Refresh
            </Button>
            <Button leftSection={<IconBulb size="1em" />} disabled={busy} onClick={identify}>
              Identify
            </Button>
          </Group>
          <sup>
            The entertainment area Toxen streams to, set up in the official Hue app.
            Identify blinks every light in the area so you can verify the selection.
          </sup>

          <h3>Sync</h3>
          <Text size="sm">Brightness</Text>
          <Slider
            min={0}
            max={100}
            step={1}
            label={(v) => `${v}%`}
            defaultValue={Settings.get("hueBrightness", 100)}
            onChangeEnd={(value) => Settings.apply({ hueBrightness: value }, true)}
          />
          <sup>Master brightness for the lights. Also adjustable with Ctrl+Shift+↑ / Ctrl+Shift+↓.</sup>

          <Select
            label="Sync mode"
            allowDeselect={false}
            defaultValue={Settings.get("hueSyncMode", "uniform")}
            data={[
              { value: "uniform", label: "Uniform — all lights follow the music together" },
              { value: "spectrum", label: "Spectrum — bass, mids and treble across the room" },
            ]}
            onChange={(value) => {
              if (value) void Settings.apply({ hueSyncMode: value as "uniform" | "spectrum" }, true);
            }}
          />
          <sup>
            Spectrum mode maps lights by their position in the entertainment area:
            leftmost lights react to bass, middle to mids, rightmost to treble.
          </sup>

          <Text size="sm" mt="xs">Sync intensity</Text>
          <Slider
            min={0.1}
            max={2}
            step={0.1}
            label={(v) => `${v.toFixed(1)}×`}
            defaultValue={Settings.get("hueSyncIntensity", 1)}
            onChangeEnd={(value) => Settings.apply({ hueSyncIntensity: value }, true)}
          />
          <sup>How strongly the lights react to the audio.</sup>
          <br />

          <Checkbox
            onClick={(e) => Settings.apply({ hueRainbowSpread: e.currentTarget.checked }, true)}
            defaultChecked={Settings.get("hueRainbowSpread", true)}
            name="hueRainbowSpread"
            label="Rainbow spread across lights"
          />
          <sup>
            When the visualizer's rainbow mode is active, each light takes its own part of the color
            wheel — spread across the room by light position — all cycling at the visualizer's pace.
            When off, all lights share one color and cycle through the wheel together.
          </sup>

          {Settings.isAdvanced() && (
            <>
              <NumberInput
                label="Update rate (Hz)"
                min={10}
                max={60}
                defaultValue={Settings.get("hueUpdateRate", 50)}
                onChange={(value) => {
                  if (typeof value === "number") void Settings.apply({ hueUpdateRate: value }, true);
                }}
              />
              <sup>How many light updates are streamed per second. 50 is recommended; lower it if your network struggles.</sup>

              <h3>Diagnostics</h3>
              <Checkbox
                onClick={(e) => Settings.apply({ hueDebug: e.currentTarget.checked }, true)}
                defaultChecked={Settings.get("hueDebug")}
                name="hueDebug"
                label="Verbose Hue logging"
              />
              <sup>
                Logs connection and DTLS handshake detail to the developer console. Takes effect on the next connect.
              </sup>
              <br />
              <Button disabled={busy} onClick={runDiagnostics} leftSection={busy ? <Loader size="xs" /> : null}>
                Run diagnostics
              </Button>
              <sup>Tests the bridge connection, firmware, and streaming handshake, then restores the previous state.</sup>
              {diagnosticsReport && (
                <Alert mt="xs" title="Diagnostics report">
                  <Text size="sm" style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{diagnosticsReport}</Text>
                </Alert>
              )}
            </>
          )}
        </>
      )}

      {error && <Alert color="red" mt="sm">{error}</Alert>}
    </>
  );
}
