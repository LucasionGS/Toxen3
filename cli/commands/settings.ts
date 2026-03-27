import { Command } from "commander";
import { readSettings } from "../src/settings.ts";
import { outputJson, printKeyValues, c } from "../src/output.ts";
import { SETTINGS_FILE } from "../src/config.ts";

const HIDDEN_KEYS = new Set(["hueClientkey", "hueUsername"]);

export function registerSettingsCommand(program: Command): void {
  program
    .command("settings")
    .description("Display Toxen's current settings")
    .option("--json", "Output raw JSON")
    .option("--key <key>", "Print the value of a single settings key")
    .action(async (opts: { json?: boolean; key?: string }) => {
      const settings = await readSettings();

      if (opts.key) {
        const value = (settings as unknown as Record<string, unknown>)[opts.key];
        if (value === undefined) {
          console.error(`${c.yellow}Unknown settings key: ${opts.key}${c.reset}`);
          process.exit(1);
        }
        if (opts.json) outputJson(value);
        console.log(String(value));
        return;
      }

      if (opts.json) outputJson(settings);

      console.log(`\n${c.bold}${c.cyan}Toxen Settings${c.reset}  ${c.gray}${SETTINGS_FILE}${c.reset}\n`);

      const pairs: [string, string | number | boolean | null | undefined][] = Object.entries(settings)
        .filter(([key]) => !HIDDEN_KEYS.has(key))
        .map(([key, value]) => {
          if (Array.isArray(value)) return [key, value.length === 0 ? "(empty)" : value.join(", ")];
          if (value !== null && typeof value === "object") return [key, JSON.stringify(value)];
          return [key, value as string | number | boolean | null | undefined];
        });

      printKeyValues(pairs);
      console.log();
    });
}
