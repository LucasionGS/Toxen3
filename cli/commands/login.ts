import { Command } from "commander";
import { remoteLogin } from "../src/remote.ts";
import { writeSession, clearSession, readSession, SESSION_FILE } from "../src/session.ts";
import { readSettings } from "../src/settings.ts";
import { DEFAULT_SERVER } from "../src/remote.ts";
import { c } from "../src/output.ts";

function resolveServer(cliFlag?: string, settingsServer?: string | null): string {
  return cliFlag ?? settingsServer ?? DEFAULT_SERVER;
}

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Log in to the Toxen remote server and save a session token")
    .option("--email <email>", "Account email")
    .option("--password <password>", "Account password (prefer interactive prompt)")
    .option("--server <url>", "Override remote server URL")
    .option("--json", "Output result as JSON")
    .action(async (opts: { email?: string; password?: string; server?: string; json?: boolean }) => {
      const settings = await readSettings().catch(() => null);
      const server = resolveServer(opts.server, settings?.remoteServer);

      const email = opts.email ?? await promptLine("Email: ");
      const password = opts.password ?? await promptPassword("Password: ");

      if (!email || !password) {
        console.error(`${c.yellow}Email and password are required.${c.reset}`);
        process.exit(1);
      }

      try {
        const user = await remoteLogin(email, password, server);
        await writeSession({
          token: user.token,
          email: user.email,
          name: user.name,
          server,
          savedAt: new Date().toISOString(),
        });

        if (opts.json) {
          process.stdout.write(JSON.stringify({ success: true, name: user.name, email: user.email, server }) + "\n");
          process.exit(0);
        }

        console.log(`\n${c.green}${c.bold}Logged in as ${user.name} (${user.email})${c.reset}`);
        console.log(`${c.gray}Server: ${server}${c.reset}`);
        console.log(`${c.gray}Token saved to: ${SESSION_FILE}${c.reset}\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n${c.yellow}Login failed:${c.reset} ${msg}\n`);
        process.exit(1);
      }
    });

  program
    .command("logout")
    .description("Remove the locally saved session token")
    .action(async () => {
      const session = await readSession();
      if (!session) {
        console.log(`${c.gray}No active session found.${c.reset}`);
        return;
      }
      await clearSession();
      console.log(`${c.green}Logged out.${c.reset} Session token removed.`);
    });
}

// ─── Minimal prompt helpers (no extra deps) ──────────────────────────────────

async function promptLine(label: string): Promise<string> {
  process.stdout.write(label);
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (chunk: string) => {
      process.stdin.pause();
      resolve(chunk.toString().trim());
    });
  });
}

async function promptPassword(label: string): Promise<string> {
  process.stdout.write(label);
  // Disable echo on TTY if possible
  if (process.stdin.isTTY) {
    (process.stdin as NodeJS.ReadStream & { setRawMode(mode: boolean): void }).setRawMode(true);
  }

  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.resume();

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          if (process.stdin.isTTY) {
            (process.stdin as NodeJS.ReadStream & { setRawMode(mode: boolean): void }).setRawMode(false);
          }
          process.stdout.write("\n");
          resolve(buf);
          return;
        }
        if (ch === "\x7f" || ch === "\b") {
          // backspace
          buf = buf.slice(0, -1);
        } else if (ch === "\x03") {
          // ctrl+c
          process.stdout.write("\n");
          process.exit(130);
        } else {
          buf += ch;
        }
      }
    };

    process.stdin.on("data", onData);
  });
}
