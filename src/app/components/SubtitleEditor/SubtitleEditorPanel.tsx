import React, { useState } from "react";
import { Alert, Badge, Button, Group, NumberInput, Stack, Text } from "@mantine/core";
import { IconBadgeCc, IconClock, IconEdit, IconFileText } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import Song from "../../toxen/Song";
import ToxenInteractionMode from "../../toxen/ToxenInteractionMode";

export default function SubtitleEditorPanel() {
  const currentSong = Song.getCurrent();
  const subtitleFile = currentSong?.paths?.subtitles;
  const [delay, setDelay] = useState<number>(currentSong?.subtitleDelay ?? 0);

  const openEditor = () => {
    if (!currentSong) {
      Toxen.error("No song is currently playing.");
      return;
    }
    if (!Toxen.isMode(ToxenInteractionMode.Player)) {
      Toxen.sendModeError(Toxen.getMode());
      return;
    }
    Toxen.setMode(ToxenInteractionMode.SubtitlesEditor, currentSong);
  };

  return (
    <Stack gap="md" p="md">
      <Text size="lg" fw={600}>Subtitles</Text>

      {!currentSong ? (
        <Alert color="yellow" icon={<IconFileText size="1em" />}>
          No song is currently playing. Play a song to edit its subtitles.
        </Alert>
      ) : (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Current song: {currentSong.getDisplayName()}
          </Text>

          {subtitleFile ? (
            <Group gap="xs">
              <Badge leftSection={<IconBadgeCc size="1em" />}>
                {toxenapi.getFileExtension(subtitleFile).replace(".", "").toUpperCase()}
              </Badge>
              <Text size="sm">{subtitleFile}</Text>
            </Group>
          ) : (
            <Alert color="gray" icon={<IconFileText size="1em" />}>
              This song has no subtitles yet. The editor will create a new .tst file.
            </Alert>
          )}

          <Button
            leftSection={<IconEdit size="1em" />}
            onClick={openEditor}
            variant="filled"
            fullWidth
          >
            Open Subtitle Editor
          </Button>

          {subtitleFile && (
            <NumberInput
              leftSection={<IconClock size="1em" />}
              label="Subtitle Offset (ms)"
              description="Delays the subtitles relative to the music. Negative shows them earlier."
              value={delay}
              step={50}
              onChange={v => {
                const value = +v || 0;
                setDelay(value);
                currentSong.subtitleDelay = value;
              }}
              onBlur={() => currentSong.saveInfo()}
            />
          )}

          <Text size="xs" c="dimmed">
            Supports SRT, VTT, TST (Toxen Subtitles), and LRC files.
            The TST format also stores styling like colors, fonts, and positioning.
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
