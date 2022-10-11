import { Button, Group } from "@mantine/core";
import React, { useMemo, useState } from "react";
import "./BPMFinder.scss";

interface BPMFinderProps { }

// Tab BPM to find the bpm of a song
// This will have a clear button and will start from the first tab and calculate bpm on the fly.
export default function BPMFinder(props: BPMFinderProps) {
  const [initialTabTime, setInitialTabTime] = useState<number>(null);
  const [latestTabTime, setLatestTabTime] = useState<number>(null);
  const [tabCount, setTabCount] = useState<number>(0);

  const bpm = useMemo(() => {
    if (initialTabTime === null) return 0;
    if (latestTabTime === null) return 0;

    const timeDiff = (latestTabTime - initialTabTime) / 1000;
    const tabPerSecond = tabCount / timeDiff;
    const bpm = tabPerSecond * 60;
    return bpm;
  }, [initialTabTime, latestTabTime]);



  return (
    <div className="bpm-finder" style={{
      width: "min-content",
    }}>
      <Group className="bpm-finder__bpm" position="center">
        <h1 style={{ textAlign: "center" }}>
          {bpm.toFixed(2)}
        </h1>
      </Group>
      <Group noWrap>
        <Button onClick={() => {
          if (initialTabTime === null) {
            setInitialTabTime(Date.now());
          } else {
            setLatestTabTime(Date.now());
          }
          setTabCount(tabCount + 1);
        }}>Tab BPM</Button>
        <Button onClick={() => {
          setInitialTabTime(null);
          setLatestTabTime(null);
          setTabCount(0);
        }}>Clear</Button>

      </Group>
    </div>
  )
}
