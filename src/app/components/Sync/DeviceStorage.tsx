import React, { useEffect, useState } from "react";
import { Alert, Button, Group, Progress, Text } from "@mantine/core";
import { IconAlertTriangle, IconShieldCheck } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import { DeviceFs } from "../../toxen/storage/device/DeviceFs";
import { DeviceSongStorage } from "../../toxen/storage/DeviceSongStorage";
import { formatBytes } from "./format";

/**
 * Settings > Sync on the web: how many songs are kept on this device, the space they use, and whether the browser
 * may clear them. Renders nothing on desktop or in browsers without device storage.
 */
export default function DeviceStorage() {
  const [estimate, setEstimate] = useState<DeviceFs.StorageEstimate | null>(null);
  const [asking, setAsking] = useState(false);
  const available = DeviceSongStorage.isAvailable();
  const songs = (Toxen.songList ?? []).filter(song => song.location?.local).length;

  useEffect(() => {
    if (!available) return;
    DeviceFs.estimate().then(setEstimate).catch(error => console.warn("Unable to read the device storage use.", error));
  }, [available, songs]);

  if (!available) return null;

  const keep = async () => {
    setAsking(true);
    const persisted = await DeviceFs.persist();
    setEstimate(await DeviceFs.estimate());
    setAsking(false);
    if (!persisted) Toxen.warn("The browser said no. On iPhone and iPad, add Toxen to your home screen and try again.", 6000);
  };

  const share = estimate?.usage != null && estimate.quota ? estimate.usage / estimate.quota : null;
  return (
    <div>
      <h3>On this device</h3>
      <Text size="sm" mb={6}>
        {songs === 1 ? "1 song is" : `${songs} songs are`} kept on this device and play offline.
      </Text>
      {share !== null && (
        <>
          <Progress value={Math.min(100, share * 100)} color={share >= 0.9 ? "var(--warning-color)" : "var(--accent-color)"} size="md" radius="xl" />
          <Text size="sm" mt={6}>{formatBytes(estimate.usage)} used of {formatBytes(estimate.quota)} the browser allows</Text>
        </>
      )}
      {estimate && (estimate.persisted ? (
        <Group gap={6} mt="xs" wrap="nowrap">
          <IconShieldCheck size="1em" color="var(--success-color)" />
          <Text size="sm">The browser keeps these songs until you clear Toxen's site data.</Text>
        </Group>
      ) : (
        <Alert mt="xs" color="yellow" icon={<IconAlertTriangle size="1em" />}>
          <Text size="sm">
            The browser may clear songs on this device when space runs low or Toxen isn't used for a while. On iPhone
            and iPad, add Toxen to your home screen. Songs that are also in the cloud are never lost.
          </Text>
          <Button size="xs" mt="xs" loading={asking} onClick={keep}>Ask to keep them</Button>
        </Alert>
      ))}
    </div>
  );
}
