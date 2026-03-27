// ─── ANSI helpers ────────────────────────────────────────────────────────────

const NO_COLOR = process.env["NO_COLOR"] !== undefined || !process.stdout.isTTY;

const ansi = (code: string) => (NO_COLOR ? "" : `\x1b[${code}m`);

export const c = {
  reset:  ansi("0"),
  bold:   ansi("1"),
  dim:    ansi("2"),
  cyan:   ansi("36"),
  green:  ansi("32"),
  yellow: ansi("33"),
  blue:   ansi("34"),
  magenta:ansi("35"),
  gray:   ansi("90"),
  white:  ansi("37"),
};

// ─── JSON output ─────────────────────────────────────────────────────────────

/** Emit a JSON value to stdout and exit. */
export function outputJson(value: unknown): never {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
  process.exit(0);
}

// ─── Table rendering ─────────────────────────────────────────────────────────

type Row = string[];

/**
 * Render a simple fixed-width table to stdout.
 * Pass an array of column headers, then rows of equal length.
 */
export function printTable(headers: string[], rows: Row[]): void {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, i) =>
    Math.max(...allRows.map((r) => (r[i] ?? "").length))
  );

  const divider =
    c.dim + widths.map((w) => "─".repeat(w + 2)).join("┼") + c.reset;

  const fmt = (row: Row, isHeader: boolean) =>
    row
      .map((cell, i) => {
        const padded = (cell ?? "").padEnd(widths[i] ?? 0);
        return isHeader
          ? ` ${c.bold}${c.cyan}${padded}${c.reset} `
          : ` ${padded} `;
      })
      .join(c.dim + "│" + c.reset);

  console.log(fmt(headers, true));
  console.log(divider);
  rows.forEach((row) => console.log(fmt(row, false)));
}

// ─── Key-value list ──────────────────────────────────────────────────────────

/** Print a list of key → value pairs. */
export function printKeyValues(pairs: [string, string | number | boolean | null | undefined][]): void {
  const keyWidth = Math.max(...pairs.map(([k]) => k.length));
  for (const [key, value] of pairs) {
    const k = `${c.cyan}${key.padEnd(keyWidth)}${c.reset}`;
    const v = value == null ? c.dim + "(not set)" + c.reset : String(value);
    console.log(`  ${k}  ${v}`);
  }
}
