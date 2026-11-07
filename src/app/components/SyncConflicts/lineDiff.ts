/**
 * Line diff for the conflict review. A small LCS implementation, so no diff dependency is needed.
 */
export namespace LineDiff {
  /**
   * One row of the side-by-side view. A `null` side means that side has no line here.
   */
  export interface Row {
    type: "same" | "changed" | "left-only" | "right-only";
    left: string | null;
    right: string | null;
    /**
     * 1-based line number on each side, `null` where the side has no line.
     */
    leftLine: number | null;
    rightLine: number | null;
  }

  /**
   * Largest `rows * columns` the LCS table may reach after trimming the common start and end. Above it the changed
   * middle is shown as one removed block and one added block instead. Unit is in cells.
   */
  export const MAX_CELLS = 4_000_000;

  type Op = { type: "equal" | "remove" | "add"; text: string };

  /**
   * Split text into lines, treating `\r\n` and `\n` the same. A trailing newline doesn't add an empty line.
   */
  export function splitLines(text: string): string[] {
    if (text === "") return [];
    const lines = text.split(/\r?\n/);
    if (lines[lines.length - 1] === "") lines.pop();
    return lines;
  }

  /**
   * Diff two texts into aligned rows. A removed block followed by an added block is paired up as `changed` rows.
   */
  export function diffLines(left: string[], right: string[]): Row[] {
    const ops = computeOps(left, right);
    const rows: Row[] = [];
    let leftLine = 0;
    let rightLine = 0;
    let i = 0;
    while (i < ops.length) {
      const op = ops[i];
      if (op.type === "equal") {
        rows.push({ type: "same", left: op.text, right: op.text, leftLine: ++leftLine, rightLine: ++rightLine });
        i++;
        continue;
      }

      const removed: string[] = [];
      const added: string[] = [];
      while (i < ops.length && ops[i].type === "remove") removed.push(ops[i++].text);
      while (i < ops.length && ops[i].type === "add") added.push(ops[i++].text);
      const paired = Math.min(removed.length, added.length);
      for (let k = 0; k < paired; k++) {
        rows.push({ type: "changed", left: removed[k], right: added[k], leftLine: ++leftLine, rightLine: ++rightLine });
      }
      for (let k = paired; k < removed.length; k++) {
        rows.push({ type: "left-only", left: removed[k], right: null, leftLine: ++leftLine, rightLine: null });
      }
      for (let k = paired; k < added.length; k++) {
        rows.push({ type: "right-only", left: null, right: added[k], leftLine: null, rightLine: ++rightLine });
      }
    }
    return rows;
  }

  function computeOps(a: string[], b: string[]): Op[] {
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }

    const ops: Op[] = [];
    for (let i = 0; i < start; i++) ops.push({ type: "equal", text: a[i] });
    ops.push(...diffMiddle(a.slice(start, endA), b.slice(start, endB)));
    for (let i = endA; i < a.length; i++) ops.push({ type: "equal", text: a[i] });
    return ops;
  }

  function diffMiddle(a: string[], b: string[]): Op[] {
    if (a.length === 0) return b.map(text => ({ type: "add", text }));
    if (b.length === 0) return a.map(text => ({ type: "remove", text }));
    if ((a.length + 1) * (b.length + 1) > MAX_CELLS) {
      return [...a.map<Op>(text => ({ type: "remove", text })), ...b.map<Op>(text => ({ type: "add", text }))];
    }

    // lcs[i][j] = length of the LCS of a[i..] and b[j..], flattened
    const width = b.length + 1;
    const lcs = new Uint32Array((a.length + 1) * width);
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        lcs[i * width + j] = a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
      }
    }

    const ops: Op[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        ops.push({ type: "equal", text: a[i] });
        i++; j++;
      }
      else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
        ops.push({ type: "remove", text: a[i++] });
      }
      else {
        ops.push({ type: "add", text: b[j++] });
      }
    }
    while (i < a.length) ops.push({ type: "remove", text: a[i++] });
    while (j < b.length) ops.push({ type: "add", text: b[j++] });
    return ops;
  }
}

export default LineDiff;
