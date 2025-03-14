// import * as remote from "@electron/remote";
import React, { useEffect, useState } from 'react'
import Stats from '../toxen/Statistics';
import Time from '../toxen/Time';
import { Toxen } from '../ToxenApp';
import ExternalUrl from './ExternalUrl/ExternalUrl';
import SidepanelSection from './Sidepanel/SidepanelSection';
import SidepanelSectionHeader from './Sidepanel/SidepanelSectionHeader';
// import packageJson from '../../../package.json';
import { Tabs, Button } from "@mantine/core";
import Song from '../toxen/Song';

export default function AboutSection() {
  const packageJson = toxenapi.packageJson;
  
  return (
    <div style={{ whiteSpace: "normal" }}>
      {/* <SidepanelSectionHeader>
      </SidepanelSectionHeader> */}
      <h1>Toxen About {"&"} Statistics</h1>
      <Tabs defaultValue="Statistics">
        <Tabs.List>
          <Tabs.Tab value="Statistics">Statistics</Tabs.Tab>
          <Tabs.Tab value="Technical Details">Technical Details</Tabs.Tab>
          <Tabs.Tab value="Credits">Credits</Tabs.Tab>
          <Tabs.Tab value="Dependencies">Dependencies</Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="Statistics">
          <h2>Statistics</h2>
          <p>Toxen launched {Stats.get("timesOpened")} times</p>
          <p>{Toxen.getAllSongs().length} total tracks</p>
          <p>{Stats.get("songsPlayed") ?? 0} tracks played</p>
          <TimePlayed />
          <TotalDuration />
        </Tabs.Panel>
        {
          toxenapi.isDesktop() && (
            <Tabs.Panel value="Technical Details">
              <h2>Technical Details</h2>
              {
                [
                  ["Toxen Version", toxenapi.remote.app.getVersion()],
                  ["Node Version", toxenapi.remote.process.versions.node],
                ].map(([name, value]) => (
                  <p key={name}>{name}: <code>{value}</code></p>
                ))
              }

              Toxen is an open source project.
              You can find the source code on <ExternalUrl href="https://github.com/LucasionGS/Toxen3">GitHub</ExternalUrl>.
            </Tabs.Panel>
          )
        }
        <Tabs.Panel value="Credits">
          <h2>Credits</h2>
          <p>Developed by <ExternalUrl href="https://github.com/LucasionGS">Lucasion</ExternalUrl></p>
          <p>Toxen logo designed by <ExternalUrl href="https://x.com/rubberducky1332">Rubberducky</ExternalUrl></p>
        </Tabs.Panel>

        {
          toxenapi.isDesktop() && (
            <Tabs.Panel value="Dependencies">
              <h2>Packages used</h2>
              <h3>Dependencies</h3>
              {Object.keys(packageJson.dependencies).map((key, index) => {
                return <p key={index}>{key}: <code>{(packageJson.dependencies as any)[key]}</code></p>
              })}
              <h3>Developer dependencies</h3>
              {Object.keys(packageJson.devDependencies).map((key, index) => {
                return <p key={index}>{key}: <code>{(packageJson.devDependencies as any)[key]}</code></p>
              })}
            </Tabs.Panel>
          )
        }
      </Tabs>
    </div>
  );
}
function TimePlayed() {
  const [secondsPlayed, setSecondsPlayed] = useState(Stats.get("secondsPlayed"));
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsPlayed(Stats.get("secondsPlayed"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (<p>{new Time(secondsPlayed * 1000).toTimestamp()} time played</p>);
}
function TotalDuration() {
  const [totalDuration, setTotalDuration] = useState(0);
  const [canLoadDurations, setCanLoadDurations] = useState(false);
  const [loadingDurations, setLoadingDurations] = useState(Song.isCalculatingFullDuration());
  const [loadMessage, setLoadMessage] = useState("");
  const [missingDurations, setMissingDurations] = useState(0);

  useEffect(() => {
    let _missingDurations = 0;
    const totalDuration = Toxen.songList.reduce((prev, curr) => {
      if (isNaN(curr.duration)) {
        _missingDurations++;
        return prev;
      }
      return prev + curr.duration;
    }, 0);
    setTotalDuration(totalDuration);
    setMissingDurations(_missingDurations);
    setCanLoadDurations(_missingDurations > 0);
  }, []);

  return (
    <>
      <p>{new Time(totalDuration ?? 0).toTimestampLiteral()} total track duration</p>
      {
        canLoadDurations && (
          <Button loading={loadingDurations} onClick={() => {
            Song.calculateFullDuration(Toxen.getAllSongs(), (song, duration, i, total) => {
              console.log(`Calculated ${i}/${total} durations`);
              setLoadMessage(`Calculated ${i}/${total} durations`);

              if (i + 1 === total) {
                setLoadMessage("");
                setTotalDuration(Toxen.getAllSongs().reduce((prev, curr) => {
                  return prev + curr.duration;
                }, 0));
              }
            }).then(() => {
              setLoadingDurations(false);
            });
            setLoadingDurations(true);
          }}>{loadingDurations ? "Loading..." : `Load ${missingDurations} missing durations`}</Button>
        )
      }
      {
        loadMessage && <p>{loadMessage}</p>
      }
    </>
  );
}