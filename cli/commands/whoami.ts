import { Command } from "commander";
import { readSession, SESSION_FILE } from "../src/session.ts";
import { remoteWhoAmI } from "../src/remote.ts";
import { outputJson, printKeyValues, c } from "../src/output.ts";

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("Show the currently logged-in remote account")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      const session = await readSession();
      if (!session) {
        console.error(`${c.yellow}Not logged in.${c.reset} Run \`toxen login\` first.`);
        process.exit(1);
      }

      try {
        const user = await remoteWhoAmI(session.token, session.server);

        if (opts.json) {
          outputJson({ name: user.name, email: user.email, premium: user.premium, server: session.server });
        }

        console.log(`\n${c.bold}${c.cyan}Remote Session${c.reset}\n`);
        printKeyValues([
          ["Name",    user.name],
          ["Email",   user.email],
          ["Premium", user.premium],
          ["Server",  session.server],
          ["Saved at", session.savedAt],
          ["Session file", SESSION_FILE],
        ]);
        console.log();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${c.yellow}${msg}${c.reset}`);
        process.exit(1);
      }
    });
}
