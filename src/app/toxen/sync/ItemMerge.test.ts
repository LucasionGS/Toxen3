// Scratch test for the playlist, settings and extension merges. No framework: run it directly.
import { ItemMerge } from "./ItemMerge";
import type { SyncV2 } from "./SyncApi";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const ok = ItemMerge.sameJson(actual, expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` -> got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

//#region Song lists
check("adds on both sides are kept", ItemMerge.mergeSongList(["a", "b"], ["a", "b", "c"], ["a", "b", "d"]), ["a", "b", "c", "d"]);
check("removes on both sides apply", ItemMerge.mergeSongList(["a", "b", "c"], ["a", "c"], ["a", "b"]), ["a"]);
check("local reorder + remote add: local order, add after its predecessor", ItemMerge.mergeSongList(["a", "b", "c"], ["c", "b", "a"], ["a", "b", "x", "c"]), ["c", "b", "x", "a"]);
check("only remote reordered: remote order, local add after its predecessor", ItemMerge.mergeSongList(["a", "b", "c"], ["a", "b", "c", "l"], ["c", "a", "b"]), ["c", "l", "a", "b"]);
check("both reordered: local order wins", ItemMerge.mergeSongList(["a", "b", "c"], ["b", "a", "c"], ["c", "b", "a"]), ["b", "a", "c"]);
check("first merge is a union", ItemMerge.mergeSongList(null, ["a", "b"], ["b", "c"]), ["a", "b", "c"]);
check("remote add at the start", ItemMerge.mergeSongList(["a"], ["a"], ["z", "a"]), ["z", "a"]);
//#endregion

//#region Playlists
const pl = (over: Partial<ItemMerge.PlaylistVersion>): ItemMerge.PlaylistVersion => ({ name: "P", songs: ["a"], background: null, applyBackground: false, songBackground: {}, updatedAt: 10, ...over });
{
  const r = ItemMerge.mergePlaylist(pl({}), pl({ name: "Local name", updatedAt: 20 }), pl({ songs: ["a", "b"], updatedAt: 30 }));
  check("one-sided field changes merge", [r.merged.name, r.merged.songs, r.push, r.pull], ["Local name", ["a", "b"], true, true]);
}
{
  const r = ItemMerge.mergePlaylist(pl({}), pl({ name: "L", updatedAt: 20 }), pl({ name: "R", updatedAt: 30 }));
  check("both renamed: newer wins", r.merged.name, "R");
}
{
  const r = ItemMerge.mergePlaylist(pl({}), pl({}), pl({ background: "bg.png", songBackground: { a: "a.png" }, updatedAt: 30 }));
  check("remote-only background change pulls only", [r.merged.background, r.merged.songBackground, r.push, r.pull], ["bg.png", { a: "a.png" }, false, true]);
}
//#endregion

//#region Settings
{
  const keys = ["visualizerStyle", "theme", "backgroundDim", "fftSize"];
  const remote: Record<string, SyncV2.SettingEntry> = {
    visualizerStyle: { value: "circle", updatedAt: 100 },
    theme: { value: "Dark", updatedAt: 50 },
    backgroundDim: { value: 40, updatedAt: 70 },
  };
  const plan = ItemMerge.planSettings(keys, { visualizerStyle: "bottom", theme: "Light", backgroundDim: 40, fftSize: 2048 }, { theme: 60 }, remote);
  check("untracked key takes the server value", plan.pull.visualizerStyle, remote.visualizerStyle);
  check("newer local value is pushed", plan.push.theme, { value: "Light", updatedAt: 60 });
  check("equal values only adopt the time", plan.adopt, { backgroundDim: 70 });
  check("key missing on the server is uploaded", plan.push.fftSize, { value: 2048, updatedAt: 1 });
}
//#endregion

//#region Extensions
{
  const e = (id: string, over: Partial<SyncV2.ExtensionEntry>): SyncV2.ExtensionEntry => ({ id, version: "1.0.0", enabled: true, removed: false, updatedAt: 10, ...over });
  const plan = ItemMerge.planExtensions(
    [e("localOnly", {}), e("old", { updatedAt: 50 }), e("toggled", { enabled: false, updatedAt: 90 })],
    [e("remoteOnly", {}), e("old", { removed: true, updatedAt: 40 }), e("toggled", { updatedAt: 80 }), e("gone", { removed: true, updatedAt: 99 })],
  );
  check("remote-only installs here; older removal doesn't remove a newer install", plan.apply.map(x => x.id), ["remoteOnly"]);
  check("local-only and newer local changes are pushed", plan.push.map(x => x.id), ["localOnly", "old", "toggled"]);
  const removal = ItemMerge.planExtensions([e("x", { updatedAt: 10 })], [e("x", { removed: true, updatedAt: 20 })]);
  check("a newer removal removes the local install", removal.apply.map(x => x.removed), [true]);
}
//#endregion

console.log(failures === 0 ? "\nAll item merge checks passed." : `\n${failures} item merge check(s) FAILED.`);
if (failures > 0) process.exit(1);
