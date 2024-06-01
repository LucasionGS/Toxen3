import * as remote from "@electron/remote";
import React, { useEffect, useState } from 'react'
import Stats from '../toxen/Statistics';
import Time from '../toxen/Time';
import { Toxen } from '../ToxenApp';
import ExternalUrl from './ExternalUrl/ExternalUrl';
import SidepanelSection from './Sidepanel/SidepanelSection';
import SidepanelSectionHeader from './Sidepanel/SidepanelSectionHeader';
import packageJson from '../../../package.json';
import { Tabs } from "@mantine/core";

export default function AboutSection() {
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
          <p>{Toxen.songList.length} total songs</p>
          <p>{Stats.get("songsPlayed")} songs played</p>
          <TimePlayed />
        </Tabs.Panel>
        <Tabs.Panel value="Technical Details">
          <h2>Technical Details</h2>
          {
            [
              ["Toxen Version", remote.app.getVersion()],
              ["Node Version", remote.process.versions.node],
            ].map(([name, value]) => (
              <p key={name}>{name}: <code>{value}</code></p>
            ))
          }

          Toxen is an open source project.
          You can find the source code on <ExternalUrl href="https://github.com/LucasionGS/Toxen3">GitHub</ExternalUrl>.
        </Tabs.Panel>
        <Tabs.Panel value="Credits">
          <h2>Credits</h2>
          <p>Developed by <ExternalUrl href="https://github.com/LucasionGS">Lucasion</ExternalUrl></p>
          <p>Toxen logo designed by <ExternalUrl href="https://www.instagram.com/xrutoma">xrutoma</ExternalUrl></p>
        </Tabs.Panel>

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