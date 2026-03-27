#!/usr/bin/env bun
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerListCommand } from "./commands/list.ts";
import { registerSettingsCommand } from "./commands/settings.ts";
import { registerLoginCommand } from "./commands/login.ts";
import { registerWhoamiCommand } from "./commands/whoami.ts";
import { registerTrackCommand } from "./commands/track.ts";

// Read version from package.json without importing it as a module
let version = "0.0.0";
try {
  const pkg = JSON.parse(readFileSync(join(import.meta.dir, "package.json"), "utf-8"));
  version = pkg.version ?? version;
} catch { /* ignore */ }

const program = new Command();

program
  .name("toxen")
  .description("CLI interface for the Toxen music player")
  .version(version)
  .addHelpText(
    "after",
    `
Examples:
  toxen login                         Log in to the remote server (interactive)
  toxen login --email x --password y  Log in non-interactively
  toxen whoami                        Show current remote account
  toxen logout                        Remove saved session token

  toxen list                          List local songs (human-readable table)
  toxen list --remote                 List songs from the remote server
  toxen list --json                   Output songs as JSON
  toxen list --json --fields uid,title,artist  Specific fields only
  toxen list --library ~/Music/MyLib  Use a custom local library directory

  toxen track <uid> audio             Print local path of the audio file
  toxen track <uid> background        Print local path of the background image
  toxen track <uid> audio --remote    Print authenticated remote URL for audio
  toxen track <uid> background --remote  Print authenticated remote URL for background

  toxen settings                      Show all local settings
  toxen settings --key libraryDirectory  Print a single setting value
  toxen settings --json               Output settings as JSON
`
  );

registerLoginCommand(program);
registerWhoamiCommand(program);
registerTrackCommand(program);
registerListCommand(program);
registerSettingsCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\x1b[31mError:\x1b[0m ${message}`);
  process.exit(1);
});