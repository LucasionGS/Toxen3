import React from "react";
import { Button } from "@mantine/core";
import Legacy from "../../../../toxen/Legacy";
import Playlist from "../../../../toxen/Playlist";
import { Toxen } from "../../../../ToxenApp";
import SidepanelSectionHeader from "../../SidepanelSectionHeader";
import "./MigrationPanel.scss";

interface MigrationPanelProps { }

export default function MigrationPanel(props: MigrationPanelProps) {
  return (
    <>
      <SidepanelSectionHeader>
        <h1>Migration</h1>
      </SidepanelSectionHeader>
      <div style={{ width: "100%", whiteSpace: "normal" }}>
        <h2>Import from Toxen2</h2>
        <Button color="green" onClick={async () => {
          const playlists = await Legacy.getToxen2Playlists();

          if (playlists.length === 0) {
            Toxen.log("No playlists found in Toxen2", 2000);
            return;
          }
          Toxen.log("Found " + playlists.length + " playlists in Toxen2", 2000);

          playlists.forEach(async (playlist) => {
            const existingPlaylist = Toxen.playlists.find(p => p.name === playlist.name);
            if (existingPlaylist) {
              existingPlaylist.addSong(...playlist.songList);
            }
            else {
              Toxen.playlists.push(playlist);
            }
          });

          Playlist.save();
          Toxen.log("Migrated " + playlists.length + " playlists from Toxen2", 2000);
        }}>
          <i className="fas fa-sync-alt"></i>
          &nbsp;Migrate playlists from Toxen2
        </Button>
        <br />
        <br />
        <sup>
          This will migrate all playlists from Toxen2 to Toxen3 (This version).
        </sup>
      </div>
    </>
  )
}
