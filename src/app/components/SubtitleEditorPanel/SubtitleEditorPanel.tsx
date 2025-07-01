import React from 'react';
import { Button, Stack, Text, Alert } from '@mantine/core';
import { IconEdit, IconFileText, IconPlayerPlay } from '@tabler/icons-react';
import { Toxen } from '../../ToxenApp';
import Song from '../../toxen/Song';
import ToxenInteractionMode from '../../toxen/ToxenInteractionMode';

const SubtitleEditorPanel: React.FC = () => {
  const currentSong = Song.getCurrent();
  const hasSubtitles = currentSong?.subtitleFile();

  const handleOpenEditor = () => {
    if (!currentSong) {
      Toxen.error("No song is currently playing");
      return;
    }

    // Check if we're already in subtitle editor mode
    if (Toxen.isMode(ToxenInteractionMode.SubtitlesEditor)) {
      Toxen.sendModeError(ToxenInteractionMode.SubtitlesEditor);
      return;
    }

    // Set mode to subtitle editor
    Toxen.setMode(ToxenInteractionMode.SubtitlesEditor, currentSong);
  };

  const handlePlayWithSubtitles = () => {
    if (!currentSong) {
      Toxen.error("No song is currently playing");
      return;
    }

    if (!hasSubtitles) {
      Toxen.error("Current song has no subtitles");
      return;
    }

    // Close sidepanel and show subtitles
    Toxen.sidePanel.show(false);
  };

  return (
    <Stack gap="md" p="md">
      <Text size="lg" fw={600}>Subtitle Editor</Text>

      {!currentSong ? (
        <Alert color="yellow" icon={<IconFileText size={16} />}>
          No song is currently playing. Play a song to edit its subtitles.
        </Alert>
      ) : (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Current Song: {currentSong.getDisplayName()}
          </Text>

          {hasSubtitles ? (
            <Alert color="blue" icon={<IconFileText size={16} />}>
              This song has subtitles loaded.
            </Alert>
          ) : (
            <Alert color="gray" icon={<IconFileText size={16} />}>
              This song has no subtitles. Create new ones with the editor.
            </Alert>
          )}

          <Stack gap="xs">
            <Button
              leftSection={<IconEdit size={16} />}
              onClick={handleOpenEditor}
              variant="filled"
              fullWidth
            >
              Open Subtitle Editor
            </Button>

            {hasSubtitles && (
              <Button
                leftSection={<IconPlayerPlay size={16} />}
                onClick={handlePlayWithSubtitles}
                variant="light"
                fullWidth
              >
                Play with Subtitles
              </Button>
            )}
          </Stack>

          <Text size="xs" c="dimmed" style={{ marginTop: '1rem' }}>
            The subtitle editor supports SRT, VTT, TST (Toxen Subtitle), and LRC formats.
            TST format supports advanced features like custom colors and fonts.
          </Text>
        </Stack>
      )}
    </Stack>
  );
};

export default SubtitleEditorPanel;
