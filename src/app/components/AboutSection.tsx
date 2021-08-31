import { remote } from 'electron';
import React from 'react'
import Stats from '../toxen/Statistics';
import Time from '../toxen/Time';
import { Toxen } from '../ToxenApp';
import ExternalUrl from './ExternalUrl/ExternalUrl';
import SidepanelSection from './Sidepanel/SidepanelSection';
import SidepanelSectionHeader from './Sidepanel/SidepanelSectionHeader';
import packageJson from '../../../package.json';

export default function AboutSection() {
  return (
    <div style={{ whiteSpace: "normal" }}>
      <SidepanelSectionHeader>
        <h1>Toxen About {"&"} Statistics</h1>
      </SidepanelSectionHeader>
      <h2>Statistics</h2>
      <p>Toxen launched {Stats.get("timesOpened")} times</p>
      <p>{Toxen.songList.length} total songs</p>
      <p>{Stats.get("songsPlayed")} songs played</p>
      <p>{new Time(Stats.get("secondsPlayed") * 1000).toTimestamp()} Time played</p>

      <hr />
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

      <hr />
      <h2>Credits</h2>
      <p>Developed by <ExternalUrl href="https://github.com/LucasionGS">Lucasion</ExternalUrl></p>
      <p>Toxen logo designed by <ExternalUrl href="https://www.instagram.com/xrutoma">xrutoma</ExternalUrl></p>

      <hr />
      <h2>Packages used</h2>
      <h3>Dependancies</h3>
      {Object.keys(packageJson.dependencies).map((key, index) => {
        return <p key={index}>{key}: <code>{(packageJson.dependencies as any)[key]}</code></p>
      })}
      <h3>Developer dependancies</h3>
      {Object.keys(packageJson.devDependencies).map((key, index) => {
        return <p key={index}>{key}: <code>{(packageJson.devDependencies as any)[key]}</code></p>
      })}
    </div>
  );
}