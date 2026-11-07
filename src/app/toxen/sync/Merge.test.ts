// Scratch test for the three-way sync merge (plan §2.4). No framework: run it directly.
//   npx tsx src/app/toxen/sync/Merge.test.ts
// Conflict copy names use local time, so the expected names below assume UTC.
process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { Merge } from "./Merge";
import type { SyncV2 } from "./SyncApi";

//#region Runner

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}`);
    console.log(`     ${String((error as Error).stack ?? error).split("\n").slice(0, 6).join("\n     ")}`);
  }
}

//#endregion

//#region Helpers

const NOW = Date.UTC(2026, 10, 7, 14, 32, 10);
const STAMP = "20261107-1432";

/**
 * A file version whose size is derived from its hash, so the same content always has the same size.
 */
function v(sha256: string, mtimeMs = 1000): Merge.FileVersion {
  return { sha256, size: sizeOf(sha256), mtimeMs };
}

function sizeOf(sha256: string): number {
  let size = 100;
  for (const char of sha256) size += char.charCodeAt(0);
  return size;
}

function types(result: Merge.FilesMergeResult): string[] {
  return result.actions.map(a => `${a.type}:${a.path}`);
}

function manifest(uid: string, rev: number, info: SyncV2.SongInfo, infoUpdatedAt: number, files: Merge.FileVersions, deleted = false): SyncV2.TrackManifest {
  const map: SyncV2.ManifestFileMap = {};
  for (const [path, version] of Object.entries(files)) map[path] = { sha256: version.sha256, size: version.size, receivedAt: version.mtimeMs };
  return { uid, rev, info, infoUpdatedAt, files: deleted ? {} : map, deleted, deletedAt: deleted ? NOW : null };
}

function shaMap(files: Merge.FileVersions | null): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, version] of Object.entries(files ?? {})) map[path] = version.sha256;
  return map;
}

interface World {
  base: Merge.PlanInput["base"];
  local: Merge.PlanInput["local"];
  remote: SyncV2.TrackManifest | null;
}

/**
 * Apply a plan the way the engine does (§ order in `Merge.SyncPlan`), asserting every precondition on the way.
 */
function apply(plan: Merge.SyncPlan, world: World, now: number): World {
  const liveRemote = world.remote && !world.remote.deleted ? world.remote : null;
  const remoteFiles = liveRemote ? Merge.remoteVersions(liveRemote) : null;
  let localFiles: Merge.FileVersions | null = world.local ? { ...world.local.files } : null;
  let localInfo = world.local?.info ?? null;
  let localInfoUpdatedAt = world.local?.infoUpdatedAt ?? 0;
  let remote = world.remote;

  // 1. Uploads, read before anything local changes
  const blobs = new Set(Object.values(remoteFiles ?? {}).map(f => f.sha256));
  for (const upload of plan.files.uploads) {
    assert.equal(localFiles?.[upload.localPath]?.sha256, upload.sha256, `upload source ${upload.localPath} must hold ${upload.sha256}`);
    blobs.add(upload.sha256);
  }
  assert.equal(plan.files.uploadBytes, plan.files.uploads.reduce((sum, u) => sum + u.size, 0));

  // 2. Commit or delete
  let rev = plan.baseRev;
  const commit = Merge.toCommitRequest(plan);
  if (plan.song === "tombstone") {
    assert.ok(liveRemote, "tombstone needs a live track");
    rev = liveRemote.rev + 1;
    remote = { ...liveRemote, rev, files: {}, deleted: true, deletedAt: now };
  }
  else if (commit) {
    assert.equal(commit.baseRev, liveRemote ? liveRemote.rev : null, "commit baseRev");
    const files: Merge.FileVersions = { ...(remoteFiles ?? {}) };
    for (const [path, entry] of Object.entries(commit.files ?? {})) {
      assert.ok(blobs.has(entry.sha256), `committed blob ${entry.sha256} at ${path} must be uploaded or already on the server`);
      files[path] = { sha256: entry.sha256, size: entry.size, mtimeMs: now };
    }
    for (const path of commit.deletes ?? []) {
      assert.ok(!(commit.files && path in commit.files), `deletes and files overlap at ${path}`);
      assert.ok(path in files, `remote delete of missing ${path}`);
      delete files[path];
    }
    if (commit.info) assert.equal(typeof commit.infoUpdatedAt, "number");
    rev = (world.remote?.rev ?? 0) + 1;
    remote = manifest(plan.uid, rev, commit.info ?? liveRemote?.info ?? {}, commit.info ? commit.infoUpdatedAt : liveRemote?.infoUpdatedAt ?? 0, files);
  }
  else if (plan.song === "push-new") {
    assert.fail("push-new must always commit");
  }
  const remoteAfter = remote && !remote.deleted ? Merge.remoteVersions(remote) : {};

  // 3. Local moves and deletes
  if (plan.song === "delete-local") {
    localFiles = null;
    localInfo = null;
  }
  if (plan.song === "pull-new") localFiles = {};
  for (const move of plan.files.localMoves) {
    assert.ok(localFiles?.[move.from], `move source ${move.from} must exist`);
    assert.ok(!localFiles[move.to], `move target ${move.to} must be free`);
    localFiles[move.to] = localFiles[move.from];
    delete localFiles[move.from];
  }
  for (const path of plan.files.localDeletes) {
    assert.ok(localFiles?.[path], `local delete of missing ${path}`);
    delete localFiles[path];
  }

  // 4. Downloads, from the committed manifest
  const downloaded = new Set<string>();
  for (const download of plan.files.downloads) {
    assert.ok(!downloaded.has(download.path), `download target ${download.path} twice`);
    downloaded.add(download.path);
    assert.equal(remoteAfter[download.path]?.sha256, download.sha256, `server must hold ${download.sha256} at ${download.path}`);
    localFiles[download.path] = { sha256: download.sha256, size: download.size, mtimeMs: now };
  }

  // 5. Info
  if (plan.infoToWrite) {
    localInfo = plan.infoToWrite;
  }
  if (plan.song === "sync" || plan.song === "push-new" || plan.song === "pull-new") localInfoUpdatedAt = plan.infoUpdatedAt;

  // 6. Base
  const base = plan.base ? { rev, info: plan.base.info, infoUpdatedAt: plan.base.infoUpdatedAt, files: plan.base.files } : null;
  const local = localFiles && localInfo ? { info: localInfo, infoUpdatedAt: localInfoUpdatedAt, files: localFiles } : null;
  if (plan.song === "noop" && world.local) return { base: plan.base ? base : world.base, local: world.local, remote: world.remote };
  return { base, local, remote };
}

/**
 * The same plan seen from the other side: local and remote swapped.
 */
function mirrorAction(action: Merge.FileAction): Merge.FileAction {
  switch (action.type) {
    case "push": return { type: "pull", path: action.path, version: action.version };
    case "pull": return { type: "push", path: action.path, version: action.version };
    case "push-delete": return { type: "delete-local", path: action.path };
    case "delete-local": return { type: "push-delete", path: action.path };
    case "base-only": return action;
    case "conflict": return { ...action, winner: action.winner === "local" ? "remote" : "local", local: action.remote, remote: action.local };
  }
}

function flip(side: Merge.Side): Merge.Side {
  return side === "local" ? "remote" : "local";
}

/**
 * Seeded PRNG (mulberry32), so a failing random case can be replayed.
 */
function prng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

//#endregion

//#region §2.4 file table

const B = { "subtitles.srt": "aaa" };

test("same / same -> nothing", () => {
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("aaa") }, { "subtitles.srt": v("aaa") }, NOW);
  assert.deepEqual(r.actions, []);
  assert.deepEqual(r.newBase, B);
  assert.equal(r.uploads.length + r.downloads.length, 0);
});

test("changed / same -> push L", () => {
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("bbb") }, { "subtitles.srt": v("aaa") }, NOW);
  assert.deepEqual(types(r), ["push:subtitles.srt"]);
  assert.deepEqual(r.uploads, [{ sha256: "bbb", size: sizeOf("bbb"), localPath: "subtitles.srt" }]);
  assert.deepEqual(r.commitFiles, { "subtitles.srt": { sha256: "bbb", size: sizeOf("bbb") } });
  assert.deepEqual(r.newBase, { "subtitles.srt": "bbb" });
});

test("same / changed -> pull R", () => {
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("aaa") }, { "subtitles.srt": v("ccc") }, NOW);
  assert.deepEqual(types(r), ["pull:subtitles.srt"]);
  assert.deepEqual(r.downloads, [{ path: "subtitles.srt", sha256: "ccc", size: sizeOf("ccc") }]);
  assert.deepEqual(r.commitFiles, {});
});

test("changed / changed, L = R -> base only", () => {
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("bbb") }, { "subtitles.srt": v("bbb", 5) }, NOW);
  assert.deepEqual(r.actions, [{ type: "base-only", path: "subtitles.srt", sha256: "bbb" }]);
  assert.deepEqual(r.newBase, { "subtitles.srt": "bbb" });
  assert.equal(r.uploads.length + r.downloads.length, 0);
});

test("changed / changed, L != R, local newer -> local wins, remote kept as copy", () => {
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("bbb", 2000) }, { "subtitles.srt": v("ccc", 1000) }, NOW);
  const copy = `subtitles.conflict-${STAMP}.srt`;
  assert.equal(r.actions.length, 1);
  assert.deepEqual(r.actions[0], { type: "conflict", path: "subtitles.srt", copyPath: copy, winner: "local", local: v("bbb", 2000), remote: v("ccc", 1000), reusedCopy: false });
  assert.deepEqual(r.commitFiles, { "subtitles.srt": { sha256: "bbb", size: sizeOf("bbb") }, [copy]: { sha256: "ccc", size: sizeOf("ccc") } });
  assert.deepEqual(r.uploads.map(u => u.sha256), ["bbb"], "the remote loser's blob is already on the server");
  assert.deepEqual(r.downloads, [{ path: copy, sha256: "ccc", size: sizeOf("ccc") }]);
  assert.deepEqual(r.localMoves, []);
  assert.deepEqual(r.conflictCopies, [{ path: "subtitles.srt", copyPath: copy, from: "remote", sha256: "ccc", size: sizeOf("ccc") }]);
  assert.deepEqual(r.newBase, { "subtitles.srt": "bbb", [copy]: "ccc" });
});

test("changed / changed, L != R, remote newer -> remote wins, local moved aside and uploaded", () => {
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("bbb", 1000) }, { "subtitles.srt": v("ccc", 2000) }, NOW);
  const copy = `subtitles.conflict-${STAMP}.srt`;
  assert.equal((r.actions[0] as { winner: Merge.Side }).winner, "remote");
  assert.deepEqual(r.uploads, [{ sha256: "bbb", size: sizeOf("bbb"), localPath: "subtitles.srt" }]);
  assert.deepEqual(r.commitFiles, { [copy]: { sha256: "bbb", size: sizeOf("bbb") } });
  assert.deepEqual(r.localMoves, [{ from: "subtitles.srt", to: copy }]);
  assert.deepEqual(r.downloads, [{ path: "subtitles.srt", sha256: "ccc", size: sizeOf("ccc") }]);
  assert.deepEqual(r.newBase, { "subtitles.srt": "ccc", [copy]: "bbb" });
});

test("conflict with equal times -> larger hash wins, independent of side", () => {
  const a = Merge.mergeFiles(B, { "subtitles.srt": v("bbb", 1000) }, { "subtitles.srt": v("ccc", 1000) }, NOW);
  const b = Merge.mergeFiles(B, { "subtitles.srt": v("ccc", 1000) }, { "subtitles.srt": v("bbb", 1000) }, NOW);
  assert.equal((a.actions[0] as { winner: Merge.Side }).winner, "remote");
  assert.equal((b.actions[0] as { winner: Merge.Side }).winner, "local");
  assert.deepEqual(a.newBase, b.newBase);
});

test("deleted / same -> push delete", () => {
  const r = Merge.mergeFiles(B, {}, { "subtitles.srt": v("aaa") }, NOW);
  assert.deepEqual(types(r), ["push-delete:subtitles.srt"]);
  assert.deepEqual(r.remoteDeletes, ["subtitles.srt"]);
  assert.deepEqual(r.newBase, {});
});

test("same / deleted -> delete local", () => {
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("aaa") }, {}, NOW);
  assert.deepEqual(types(r), ["delete-local:subtitles.srt"]);
  assert.deepEqual(r.localDeletes, ["subtitles.srt"]);
});

test("deleted / changed -> the modification wins (pull)", () => {
  const r = Merge.mergeFiles(B, {}, { "subtitles.srt": v("ccc") }, NOW);
  assert.deepEqual(types(r), ["pull:subtitles.srt"]);
  assert.deepEqual(r.newBase, { "subtitles.srt": "ccc" });
});

test("changed / deleted -> the modification wins (push)", () => {
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("bbb") }, {}, NOW);
  assert.deepEqual(types(r), ["push:subtitles.srt"]);
  assert.deepEqual(r.remoteDeletes, []);
});

test("deleted / deleted -> base only, dropped from the base", () => {
  const r = Merge.mergeFiles(B, {}, {}, NOW);
  assert.deepEqual(r.actions, [{ type: "base-only", path: "subtitles.srt", sha256: null }]);
  assert.deepEqual(r.newBase, {});
});

test("new / new, equal -> base only", () => {
  const r = Merge.mergeFiles({}, { "bg.jpg": v("ddd") }, { "bg.jpg": v("ddd", 9) }, NOW);
  assert.deepEqual(types(r), ["base-only:bg.jpg"]);
});

test("new / new, different -> conflict", () => {
  const r = Merge.mergeFiles({}, { "bg.jpg": v("ddd", 5) }, { "bg.jpg": v("eee", 9) }, NOW);
  assert.deepEqual(types(r), ["conflict:bg.jpg"]);
  assert.equal((r.actions[0] as { copyPath: string }).copyPath, `bg.conflict-${STAMP}.jpg`);
});

test("new on one side -> copied to the other", () => {
  const r = Merge.mergeFiles({}, { "a.srt": v("aaa") }, { "b.srt": v("bbb") }, NOW);
  assert.deepEqual(types(r), ["push:a.srt", "pull:b.srt"]);
});

test("first sync (no base): equal -> base, different -> conflict, one side -> copied", () => {
  const r = Merge.mergeFiles(null,
    { "media.mp3": v("m1"), "bg.jpg": v("b1", 3000), "local.srt": v("l1") },
    { "media.mp3": v("m1"), "bg.jpg": v("b2", 1000), "remote.srt": v("r1") },
    NOW,
  );
  assert.deepEqual(types(r), ["conflict:bg.jpg", "push:local.srt", "base-only:media.mp3", "pull:remote.srt"]);
  assert.deepEqual(r.newBase, { "bg.jpg": "b1", [`bg.conflict-${STAMP}.jpg`]: "b2", "local.srt": "l1", "media.mp3": "m1", "remote.srt": "r1" });
});

test("pushing content the server already has (local rename) commits without uploading", () => {
  const r = Merge.mergeFiles({ "old.jpg": "img" }, { "new.jpg": v("img") }, { "old.jpg": v("img") }, NOW);
  assert.deepEqual(types(r), ["push:new.jpg", "push-delete:old.jpg"]);
  assert.deepEqual(r.uploads, []);
  assert.deepEqual(r.commitFiles, { "new.jpg": { sha256: "img", size: sizeOf("img") } });
});

test("the same content at two paths is uploaded once", () => {
  const r = Merge.mergeFiles({}, { "a.jpg": v("img"), "b.jpg": v("img") }, {}, NOW);
  assert.equal(r.uploads.length, 1);
  assert.equal(r.uploadBytes, sizeOf("img"));
  assert.deepEqual(Object.keys(r.commitFiles), ["a.jpg", "b.jpg"]);
});

test("a conflict copy left by an interrupted sync is reused, not copied again", () => {
  // Previous run: remote won, the local loser was committed as a copy, then the app died before the local move.
  const copy = "subtitles.conflict-20261101-0900.srt";
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("bbb", 1000) }, { "subtitles.srt": v("ccc", 2000), [copy]: v("bbb", 1500) }, NOW);
  assert.deepEqual(types(r), [`pull:${copy}`, "conflict:subtitles.srt"]);
  const conflict = r.actions[1] as Extract<Merge.FileAction, { type: "conflict" }>;
  assert.equal(conflict.copyPath, copy);
  assert.equal(conflict.reusedCopy, true);
  assert.deepEqual(r.conflictCopies, []);
  assert.deepEqual(r.localMoves, []);
  assert.deepEqual(r.uploads, []);
  assert.deepEqual(r.newBase, { "subtitles.srt": "ccc", [copy]: "bbb" });
});

test("two conflicts in one song get separate copies", () => {
  const r = Merge.mergeFiles({ "a.srt": "1", "b.srt": "1" }, { "a.srt": v("2", 9), "b.srt": v("2", 1) }, { "a.srt": v("3", 1), "b.srt": v("3", 9) }, NOW);
  assert.deepEqual(r.conflictCopies.map(c => `${c.copyPath}<-${c.from}`), [`a.conflict-${STAMP}.srt<-remote`, `b.conflict-${STAMP}.srt<-local`]);
});

//#endregion

//#region Conflict copy names

test("copy name: plain, nested, multi-dot, no extension, dotfiles, trailing dot", () => {
  const none = new Set<string>();
  assert.equal(Merge.conflictCopyPath("subtitles.srt", NOW, none), `subtitles.conflict-${STAMP}.srt`);
  assert.equal(Merge.conflictCopyPath("extra/lyrics.v2.lrc", NOW, none), `extra/lyrics.v2.conflict-${STAMP}.lrc`);
  assert.equal(Merge.conflictCopyPath("a/b.c/README", NOW, none), `a/b.c/README.conflict-${STAMP}`);
  assert.equal(Merge.conflictCopyPath(".background", NOW, none), `.background.conflict-${STAMP}`);
  assert.equal(Merge.conflictCopyPath("dir/.hidden.txt", NOW, none), `dir/.hidden.conflict-${STAMP}.txt`);
  assert.equal(Merge.conflictCopyPath("name.", NOW, none), `name..conflict-${STAMP}`);
});

test("copy name: collisions get -2, -3, compared case-insensitively", () => {
  const first = `subtitles.conflict-${STAMP}.srt`;
  assert.equal(Merge.conflictCopyPath("subtitles.srt", NOW, new Set([first])), `subtitles.conflict-${STAMP}-2.srt`);
  assert.equal(Merge.conflictCopyPath("subtitles.srt", NOW, new Set([first, `subtitles.conflict-${STAMP}-2.srt`])), `subtitles.conflict-${STAMP}-3.srt`);
  assert.equal(Merge.conflictCopyPath("subtitles.srt", NOW, new Set([first.toUpperCase()])), `subtitles.conflict-${STAMP}-2.srt`);
  assert.equal(Merge.conflictCopyPath("README", NOW, new Set([`README.conflict-${STAMP}`])), `README.conflict-${STAMP}-2`);
});

test("copy name: merge avoids names already used on either side", () => {
  const taken = `subtitles.conflict-${STAMP}.srt`;
  const r = Merge.mergeFiles(B, { "subtitles.srt": v("bbb", 2000), [taken]: v("zzz") }, { "subtitles.srt": v("ccc", 1000) }, NOW);
  const conflict = r.actions.find(a => a.type === "conflict") as Extract<Merge.FileAction, { type: "conflict" }>;
  assert.equal(conflict.copyPath, `subtitles.conflict-${STAMP}-2.srt`);
});

test("copy name: uses local time and stays within the path limit", () => {
  process.env.TZ = "Asia/Tokyo";
  assert.equal(Merge.conflictCopyPath("a.srt", NOW, new Set()), "a.conflict-20261107-2332.srt");
  process.env.TZ = "UTC";
  const long = `dir/${"x".repeat(600)}.srt`;
  const copy = Merge.conflictCopyPath(long, NOW, new Set());
  assert.equal(copy.length, Merge.PATH_MAX_LENGTH);
  assert.ok(copy.startsWith("dir/xxx") && copy.endsWith(`.conflict-${STAMP}.srt`));
});

test("fileKind by extension", () => {
  assert.equal(Merge.fileKind("subtitles.SRT"), "text");
  assert.equal(Merge.fileKind("storyboard.tsb"), "text");
  assert.equal(Merge.fileKind("bg/background.jpeg"), "image");
  assert.equal(Merge.fileKind("media.flac"), "media");
  assert.equal(Merge.fileKind("video.webm"), "media");
  assert.equal(Merge.fileKind("README"), "other");
  assert.equal(Merge.fileKind(".png"), "other");
});

//#endregion

//#region Info

test("info: one side changed -> that side", () => {
  const r = Merge.mergeInfo({ title: "A", artist: "X" }, { title: "B", artist: "X" }, 2, { title: "A", artist: "Y" }, 1);
  assert.deepEqual(r.merged, { title: "B", artist: "Y" });
  assert.equal(r.push, true);
  assert.equal(r.pull, true);
  assert.deepEqual(r.conflicts, []);
  assert.equal(r.infoUpdatedAt, 2);
});

test("info: both changed -> newer infoUpdatedAt wins, recorded", () => {
  const local = Merge.mergeInfo({ title: "A" }, { title: "L" }, 5, { title: "R" }, 3);
  assert.deepEqual(local.merged, { title: "L" });
  assert.deepEqual(local.conflicts, [{ field: "title", local: "L", remote: "R", winner: "local" }]);
  assert.equal(local.push, true);
  assert.equal(local.pull, false);
  const remote = Merge.mergeInfo({ title: "A" }, { title: "L" }, 3, { title: "R" }, 5);
  assert.deepEqual(remote.merged, { title: "R" });
  assert.equal(remote.conflicts[0].winner, "remote");
});

test("info: equal infoUpdatedAt -> side-independent tie-break", () => {
  const a = Merge.mergeInfo({ title: "A" }, { title: "L" }, 4, { title: "R" }, 4);
  const b = Merge.mergeInfo({ title: "A" }, { title: "R" }, 4, { title: "L" }, 4);
  assert.deepEqual(a.merged, b.merged);
});

test("info: null is a value, distinct from a missing key", () => {
  // Setting a field to null ("inherit") is a change that syncs
  assert.deepEqual(Merge.mergeInfo({ backgroundDim: 50 }, { backgroundDim: null }, 2, { backgroundDim: 50 }, 1).merged, { backgroundDim: null });
  // Removing a key that was null is a change too, and stays removed
  const removed = Merge.mergeInfo({ backgroundDim: null }, {}, 2, { backgroundDim: null }, 1);
  assert.deepEqual(removed.merged, {});
  assert.equal(removed.push, true);
  // null against a value, both changed: a conflict like any other
  const both = Merge.mergeInfo({ backgroundDim: 50 }, { backgroundDim: null }, 1, { backgroundDim: 70 }, 2);
  assert.deepEqual(both.merged, { backgroundDim: 70 });
  assert.deepEqual(both.conflicts, [{ field: "backgroundDim", local: null, remote: 70, winner: "remote" }]);
  // Missing-on-one-side conflict records keep the absent key absent
  const firstSync = Merge.mergeInfo(null, { a: null }, 1, {}, 2);
  assert.deepEqual(firstSync.merged, { a: null });
});

test("info: removed on one side, changed on the other -> the change wins, no conflict", () => {
  const r = Merge.mergeInfo({ subtitleDelay: 0 }, {}, 9, { subtitleDelay: 250 }, 1);
  assert.deepEqual(r.merged, { subtitleDelay: 250 });
  assert.deepEqual(r.conflicts, []);
});

test("info: playlistSettings merged per playlist", () => {
  const base = { playlistSettings: { p1: { backgroundDim: 1 }, p2: { backgroundDim: 1 } } };
  const local = { playlistSettings: { p1: { backgroundDim: 2 }, p2: { backgroundDim: 1 }, p3: { backgroundDim: 3 } } };
  const remote = { playlistSettings: { p1: { backgroundDim: 1 } } };
  const r = Merge.mergeInfo(base, local, 1, remote, 2);
  assert.deepEqual(r.merged, { playlistSettings: { p1: { backgroundDim: 2 }, p3: { backgroundDim: 3 } } });
  assert.deepEqual(r.conflicts, []);
});

test("info: the same playlist changed on both sides -> conflict on that playlist only", () => {
  const base = { playlistSettings: { p1: { a: 1 }, p2: { a: 1 } } };
  const r = Merge.mergeInfo(base, { playlistSettings: { p1: { a: 2 }, p2: { a: 5 } } }, 1, { playlistSettings: { p1: { a: 3 }, p2: { a: 1 } } }, 2);
  assert.deepEqual(r.merged, { playlistSettings: { p1: { a: 3 }, p2: { a: 5 } } });
  assert.deepEqual(r.conflicts, [{ field: "playlistSettings.p1", local: { a: 2 }, remote: { a: 3 }, winner: "remote" }]);
});

test("info: playlistSettings added on both sides with no base field -> both kept", () => {
  const r = Merge.mergeInfo({}, { playlistSettings: { p1: { a: 1 } } }, 1, { playlistSettings: { p2: { a: 2 } } }, 2);
  assert.deepEqual(r.merged, { playlistSettings: { p1: { a: 1 }, p2: { a: 2 } } });
});

test("info: visualizerStyleOptions merged per style", () => {
  const base = { visualizerStyleOptions: { orb: { size: 1 } } };
  const r = Merge.mergeInfo(base, { visualizerStyleOptions: { orb: { size: 2 } } }, 1, { visualizerStyleOptions: { orb: { size: 1 }, waveform: { y: 3 } } }, 2);
  assert.deepEqual(r.merged, { visualizerStyleOptions: { orb: { size: 2 }, waveform: { y: 3 } } });
});

test("info: deep field replaced by a non-object -> whole-field conflict", () => {
  const r = Merge.mergeInfo({ playlistSettings: { p1: {} } }, { playlistSettings: null }, 3, { playlistSettings: { p1: { a: 1 } } }, 1);
  assert.deepEqual(r.merged, { playlistSettings: null });
  assert.equal(r.conflicts[0].field, "playlistSettings");
});

test("info: files, hash and undefined values are ignored", () => {
  const r = Merge.mergeInfo({ title: "A", hash: "1" }, { title: "A", hash: "2", files: { a: 1 }, album: undefined }, 1, { title: "A", hash: "3" }, 2);
  assert.deepEqual(r.merged, { title: "A" });
  assert.equal(r.push, false);
  assert.equal(r.pull, false);
});

test("info: first sync -> one-sided fields kept, differing fields conflict", () => {
  const r = Merge.mergeInfo(null, { a: 1, b: 2, c: "L" }, 1, { a: 1, d: 4, c: "R" }, 2);
  assert.deepEqual(r.merged, { a: 1, b: 2, c: "R", d: 4 });
  assert.deepEqual(r.conflicts.map(c => c.field), ["c"]);
});

//#endregion

//#region Songs

const INFO = { uid: "s1", artist: "Artist", title: "Title" };

test("song: local only, never synced -> push-new", () => {
  const plan = Merge.planSong({ uid: "s1", base: null, local: { info: { ...INFO, hash: "x" }, infoUpdatedAt: 7, files: { "media.mp3": v("m") } }, remote: null, now: NOW });
  assert.equal(plan.song, "push-new");
  assert.deepEqual(Merge.toCommitRequest(plan), { baseRev: null, info: INFO, infoUpdatedAt: 7, files: { "media.mp3": { sha256: "m", size: sizeOf("m") } } });
});

test("song: cloud only, never synced -> pull-new", () => {
  const plan = Merge.planSong({ uid: "s1", base: null, local: null, remote: manifest("s1", 4, INFO, 3, { "media.mp3": v("m") }), now: NOW });
  assert.equal(plan.song, "pull-new");
  assert.deepEqual(plan.files.downloads.map(d => d.path), ["media.mp3"]);
  assert.deepEqual(plan.infoToWrite, INFO);
  assert.equal(Merge.toCommitRequest(plan), null);
});

test("song: deleted here, unchanged in the cloud -> tombstone", () => {
  const base = { rev: 4, info: INFO, infoUpdatedAt: 3, files: { "media.mp3": "m" } };
  const plan = Merge.planSong({ uid: "s1", base, local: null, remote: manifest("s1", 4, INFO, 3, { "media.mp3": v("m") }), now: NOW });
  assert.equal(plan.song, "tombstone");
  assert.equal(plan.baseRev, 4);
  assert.equal(plan.base, null);
});

test("song: deleted here, changed in the cloud -> pull-new (the modification wins)", () => {
  const base = { rev: 4, info: INFO, infoUpdatedAt: 3, files: { "media.mp3": "m" } };
  const plan = Merge.planSong({ uid: "s1", base, local: null, remote: manifest("s1", 5, { ...INFO, title: "New" }, 9, { "media.mp3": v("m") }), now: NOW });
  assert.equal(plan.song, "pull-new");
});

test("song: deleted in the cloud, unchanged here -> delete-local", () => {
  const base = { rev: 4, info: INFO, infoUpdatedAt: 3, files: { "media.mp3": "m" } };
  const plan = Merge.planSong({ uid: "s1", base, local: { info: INFO, infoUpdatedAt: 3, files: { "media.mp3": v("m") } }, remote: manifest("s1", 6, INFO, 3, {}, true), now: NOW });
  assert.equal(plan.song, "delete-local");
  assert.equal(plan.base, null);
});

test("song: deleted in the cloud, changed here -> push-new over the tombstone", () => {
  const base = { rev: 4, info: INFO, infoUpdatedAt: 3, files: { "media.mp3": "m" } };
  const plan = Merge.planSong({ uid: "s1", base, local: { info: INFO, infoUpdatedAt: 3, files: { "media.mp3": v("m"), "subtitles.srt": v("s") } }, remote: manifest("s1", 6, INFO, 3, {}, true), now: NOW });
  assert.equal(plan.song, "push-new");
  assert.equal(Merge.toCommitRequest(plan).baseRev, null);
  assert.deepEqual(Object.keys(plan.files.commitFiles), ["media.mp3", "subtitles.srt"]);
});

test("song: gone on both sides -> noop, base forgotten", () => {
  const plan = Merge.planSong({ uid: "s1", base: { rev: 4, info: INFO, infoUpdatedAt: 3, files: {} }, local: null, remote: manifest("s1", 6, INFO, 3, {}, true), now: NOW });
  assert.equal(plan.song, "noop");
  assert.equal(plan.base, null);
});

test("song: first sync with equal content -> sync that only stores the base, then noop", () => {
  const remote = manifest("s1", 4, INFO, 3, { "media.mp3": v("m") });
  const plan = Merge.planSong({ uid: "s1", base: null, local: { info: INFO, infoUpdatedAt: 1, files: { "media.mp3": v("m") } }, remote, now: NOW });
  assert.equal(plan.song, "sync");
  assert.equal(Merge.toCommitRequest(plan), null);
  assert.deepEqual(plan.files.downloads, []);
  const again = Merge.planSong({ uid: "s1", base: { rev: 4, ...plan.base }, local: { info: INFO, infoUpdatedAt: 3, files: { "media.mp3": v("m") } }, remote, now: NOW });
  assert.equal(again.song, "noop");
});

test("song: conflict record carries everything the diff view needs", () => {
  const base = { rev: 4, info: { ...INFO, backgroundDim: 10 }, infoUpdatedAt: 3, files: { "media.mp3": "m", "subtitles.srt": "s0", "background.png": "b0" } };
  const plan = Merge.planSong({
    uid: "s1",
    base,
    local: { info: { ...INFO, backgroundDim: 20 }, infoUpdatedAt: 8, files: { "media.mp3": v("m"), "subtitles.srt": v("sL", 5000), "background.png": v("bL", 1000) } },
    remote: manifest("s1", 5, { ...INFO, backgroundDim: 30 }, 6, { "media.mp3": v("m"), "subtitles.srt": v("sR", 4000), "background.png": v("bR", 2000) }),
    now: NOW,
  });
  assert.equal(plan.song, "sync");
  assert.deepEqual(plan.conflict, {
    id: `s1-${NOW}`,
    uid: "s1",
    songName: "Artist - Title",
    createdAt: NOW,
    items: [
      { type: "file", kind: "image", path: "background.png", copyPath: `background.conflict-${STAMP}.png`, winner: "remote", local: v("bL", 1000), remote: v("bR", 2000) },
      { type: "file", kind: "text", path: "subtitles.srt", copyPath: `subtitles.conflict-${STAMP}.srt`, winner: "local", local: v("sL", 5000), remote: v("sR", 4000) },
      { type: "info", fields: [{ field: "backgroundDim", local: 20, remote: 30, winner: "local" }] },
    ],
  });
  const commit = Merge.toCommitRequest(plan);
  assert.equal(commit.baseRev, 5);
  assert.deepEqual(commit.info, { ...INFO, backgroundDim: 20 });
  assert.equal(commit.infoUpdatedAt, 8);
});

//#endregion

//#region Randomized invariants

const PATHS = ["media.mp3", "background.jpg", "subs/lyrics.srt", `subs/lyrics.conflict-${STAMP}.srt`, "README", ".hidden"];
const SHAS = ["s1", "s2", "s3", "s4"];
const TIMES = [1000, 2000, 3000];
const INFO_VALUES: unknown[] = [null, 1, 2, "x"];

function randomFiles(rand: () => number, base: Record<string, string> | null): Merge.FileVersions {
  const files: Merge.FileVersions = {};
  for (const path of PATHS) {
    const roll = rand();
    if (base && path in base && roll < 0.45) files[path] = v(base[path], pick(rand, TIMES));
    else if (roll < 0.7) files[path] = v(pick(rand, SHAS), pick(rand, TIMES));
  }
  return files;
}

function randomInfo(rand: () => number, base: SyncV2.SongInfo | null): SyncV2.SongInfo {
  const info: SyncV2.SongInfo = {};
  for (const key of ["title", "backgroundDim"]) {
    if (base && key in base && rand() < 0.5) info[key] = base[key];
    else if (rand() < 0.75) info[key] = pick(rand, INFO_VALUES);
  }
  const playlists: Record<string, unknown> = {};
  const basePlaylists = (base?.playlistSettings ?? {}) as Record<string, unknown>;
  for (const id of ["p1", "p2"]) {
    if (id in basePlaylists && rand() < 0.5) playlists[id] = basePlaylists[id];
    else if (rand() < 0.6) playlists[id] = { backgroundDim: pick(rand, INFO_VALUES) };
  }
  const roll = rand();
  if (roll < 0.7) info.playlistSettings = playlists;
  else if (roll < 0.8) info.playlistSettings = null;
  return info;
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

const RANDOM_CASES = 2000;
const RANDOM_SEED = Number(process.env.MERGE_SEED ?? 20261107); // Replay or vary with `MERGE_SEED=<n>`

test(`randomized: ${RANDOM_CASES} B/L/R triples keep every version, converge, are idempotent and symmetric`, () => {
  const rand = prng(RANDOM_SEED);
  const counts: Record<string, number> = {};
  for (let i = 0; i < RANDOM_CASES; i++) {
    const hasBase = rand() < 0.8;
    const baseFiles: Record<string, string> = {};
    if (hasBase) for (const path of PATHS) if (rand() < 0.6) baseFiles[path] = pick(rand, SHAS);
    const baseInfo = hasBase ? randomInfo(rand, null) : null;
    const base: World["base"] = hasBase ? { rev: 10, info: baseInfo, infoUpdatedAt: 100, files: baseFiles } : null;
    // Sometimes a side is untouched since the base, so song-level deletes (tombstone, delete-local) come up
    const localUnchanged = hasBase && rand() < 0.15;
    const remoteUnchanged = hasBase && rand() < 0.15;
    const unchangedFiles = () => Object.fromEntries(Object.entries(baseFiles).map(([path, sha]) => [path, v(sha, pick(rand, TIMES))]));
    const localFiles = localUnchanged ? unchangedFiles() : randomFiles(rand, hasBase ? baseFiles : null);
    const remoteFiles = remoteUnchanged ? unchangedFiles() : randomFiles(rand, hasBase ? baseFiles : null);
    const localInfo = localUnchanged ? { ...baseInfo } : randomInfo(rand, baseInfo);
    const remoteInfo = remoteUnchanged ? { ...baseInfo } : randomInfo(rand, baseInfo);
    const localAt = pick(rand, [100, 200, 300]);
    const remoteAt = pick(rand, [100, 200, 300]);
    const localRoll = rand();
    const remoteRoll = rand();
    const world: World = {
      base,
      local: localRoll < 0.1 ? null : { info: localInfo, infoUpdatedAt: localAt, files: localFiles },
      remote: remoteRoll < 0.05 ? null : manifest("song", 10 + Math.floor(rand() * 2), remoteInfo, remoteAt, remoteFiles, remoteRoll < 0.12),
    };
    const label = `case ${i} (seed ${RANDOM_SEED}): ${JSON.stringify(world)}`;

    const plan = Merge.planSong({ uid: "song", ...world, now: NOW });
    counts[`song:${plan.song}`] = (counts[`song:${plan.song}`] ?? 0) + 1;
    for (const action of plan.files.actions) {
      const key = action.type === "conflict" && action.reusedCopy ? "conflict(reused copy)" : action.type;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const after = apply(plan, world, NOW + 1);

    // Convergence: both sides and the new base agree
    const liveRemote = after.remote && !after.remote.deleted ? after.remote : null;
    if (plan.base) {
      assert.ok(after.local && liveRemote, `both sides exist after ${plan.song}: ${label}`);
      assert.deepEqual(shaMap(after.local.files), plan.base.files, `local = base: ${label}`);
      assert.deepEqual(shaMap(Merge.remoteVersions(liveRemote)), plan.base.files, `remote = base: ${label}`);
      assert.deepEqual(Merge.stripInfo(after.local.info), plan.base.info, `local info = base: ${label}`);
      assert.deepEqual(Merge.stripInfo(liveRemote.info), plan.base.info, `remote info = base: ${label}`);
    }
    else if (plan.song !== "noop") {
      assert.ok(!after.local && !liveRemote, `song gone on both sides after ${plan.song}: ${label}`);
    }

    // No version is lost: every version that differs from the base at its path survives somewhere. The base version
    // itself may go when the other side changed or deleted that path (an ordinary push, pull or delete).
    const survivors = new Set([...Object.values(shaMap(after.local?.files ?? {})), ...Object.values(shaMap(liveRemote ? Merge.remoteVersions(liveRemote) : {}))]);
    const before: [Record<string, string>, Record<string, string>] = [
      shaMap(world.local?.files ?? {}),
      shaMap(world.remote && !world.remote.deleted ? Merge.remoteVersions(world.remote) : {}),
    ];
    for (const [side, mine] of before.entries()) {
      const other = before[1 - side];
      for (const [path, sha] of Object.entries(mine)) {
        const unchangedBase = hasBase && baseFiles[path] === sha && other[path] !== sha;
        if (!unchangedBase) assert.ok(survivors.has(sha), `${sha} at ${side === 0 ? "local" : "remote"} ${path} was lost: ${label}`);
      }
    }
    for (const action of plan.files.actions) {
      if (action.type !== "conflict") continue;
      const loser = action.winner === "local" ? action.remote : action.local;
      assert.equal(plan.base.files[action.copyPath], loser.sha256, `conflict loser kept at ${action.copyPath}: ${label}`);
    }

    // Idempotent: planning again on the result has nothing to do
    if (after.local || liveRemote) {
      const again = Merge.planSong({ uid: "song", ...after, now: NOW + 120000 });
      assert.equal(again.song, "noop", `second plan is ${again.song} ${JSON.stringify(again.files.actions)}: ${label}`);
    }

    // Symmetric: swapping the sides mirrors the file actions and the info result
    const swappedFiles = Merge.mergeFiles(hasBase ? baseFiles : null, remoteFiles, localFiles, NOW);
    const files = Merge.mergeFiles(hasBase ? baseFiles : null, localFiles, remoteFiles, NOW);
    assert.deepEqual(swappedFiles.actions, files.actions.map(mirrorAction), `file actions mirror: ${label}`);
    assert.deepEqual(swappedFiles.newBase, files.newBase, `file base mirror: ${label}`);
    assert.deepEqual(swappedFiles.conflictCopies, files.conflictCopies.map(c => ({ ...c, from: flip(c.from) })), `copies mirror: ${label}`);
    const info = Merge.mergeInfo(baseInfo, localInfo, localAt, remoteInfo, remoteAt);
    const swappedInfo = Merge.mergeInfo(baseInfo, remoteInfo, remoteAt, localInfo, localAt);
    assert.deepEqual(swappedInfo.merged, info.merged, `info mirror: ${label}`);
    assert.equal(swappedInfo.push, info.pull);
    assert.equal(swappedInfo.pull, info.push);
    assert.deepEqual(swappedInfo.conflicts, info.conflicts.map(c => {
      const mirrored: Merge.InfoFieldConflict = { field: c.field, winner: flip(c.winner) };
      if ("remote" in c) mirrored.local = c.remote;
      if ("local" in c) mirrored.remote = c.local;
      return mirrored;
    }), `info conflicts mirror: ${label}`);
  }
  console.log(`     outcomes: ${Object.entries(counts).sort().map(([k, n]) => `${k}=${n}`).join(", ")}`);
});

//#endregion

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
