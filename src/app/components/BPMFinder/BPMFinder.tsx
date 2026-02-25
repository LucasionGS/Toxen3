import { Button, Group, Text } from "@mantine/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toxen } from "../../ToxenApp";
import StoryboardParser from "../../toxen/StoryboardParser";
import "./BPMFinder.scss";

interface BPMFinderProps {
  config?: StoryboardParser.StoryboardConfig;
  onBpmChange?: (bpm: number) => void;
  onOffsetChange?: (offsetMs: number) => void;
}

export default function BPMFinder(props: BPMFinderProps) {
  const { config, onBpmChange, onOffsetChange } = props;
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const tapTimesRef = useRef<number[]>([]);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    tapTimesRef.current = tapTimes;
  }, [tapTimes]);

  const bpm = useMemo(() => {
    if (tapTimes.length < 2) return 0;
    const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
    if (intervals.length === 0) return 0;
    // Use median interval for robustness against outlier taps
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median <= 0) return 0;
    return 60000 / median;
  }, [tapTimes]);

  const firstTapOffset = tapTimes.length > 0 ? tapTimes[0] : null;

  const handleTap = useCallback(() => {
    // Use song audio time if available and playing, otherwise fall back to Date.now()
    let tapTime: number;
    const media = Toxen.musicPlayer?.media;
    if (media && !media.paused && media.currentTime > 0) {
      tapTime = media.currentTime * 1000;
    } else {
      tapTime = Date.now();
    }

    const newTaps = [...tapTimesRef.current, tapTime];
    setTapTimes(newTaps);

    // Reset auto-clear timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => {
      setTapTimes([]);
    }, 10000);
  }, []);

  const handleClear = useCallback(() => {
    setTapTimes([]);
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  // Keyboard shortcut: T key to tap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        handleTap();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleTap]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const roundedBpm = Math.round(bpm);
  const hasBpm = bpm > 0;

  return (
    <div className="bpm-finder">
      <div className="bpm-finder__display">
        <span className="bpm-finder__value">
          {hasBpm ? roundedBpm : "--"}
        </span>
        <span className="bpm-finder__unit">BPM</span>
      </div>

      <div className="bpm-finder__info">
        <Text size="xs" c="dimmed">
          {tapTimes.length} tap{tapTimes.length !== 1 ? "s" : ""}
          {firstTapOffset !== null && (
            <> | Offset: {(firstTapOffset / 1000).toFixed(3)}s</>
          )}
        </Text>
        <Text size="xs" c="dimmed">
          Press <kbd>T</kbd> or click to tap
        </Text>
      </div>

      <Group gap="xs" wrap="nowrap">
        <Button size="sm" onClick={handleTap}>
          Tap
        </Button>
        <Button size="sm" variant="light" onClick={handleClear}>
          Clear
        </Button>
      </Group>

      {hasBpm && (onBpmChange || onOffsetChange) && (
        <Group gap="xs" mt="xs" wrap="nowrap">
          {onBpmChange && (
            <Button
              size="xs"
              variant="filled"
              color="green"
              onClick={() => onBpmChange(roundedBpm)}
            >
              Apply BPM ({roundedBpm})
            </Button>
          )}
          {onOffsetChange && firstTapOffset !== null && (
            <Button
              size="xs"
              variant="filled"
              color="blue"
              onClick={() => onOffsetChange(firstTapOffset)}
            >
              Apply Offset ({(firstTapOffset / 1000).toFixed(3)}s)
            </Button>
          )}
        </Group>
      )}
    </div>
  );
}
