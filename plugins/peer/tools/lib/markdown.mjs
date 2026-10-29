// Fenced code block recognition shared by the skill validator and the package
// reference check, so both treat the same lines as examples.
//
// A fence opens on a line of three or more backticks or tildes, optionally
// indented, optionally after a list marker (`-`, `+`, `*`, `1.` or `1)`), with
// any info string. It closes on a line of the same character, at least as long,
// with nothing after it. Fence lines themselves count as inside the block.

const FENCE = /^[ \t]*(?:(?:[-+*]|\d+[.)])[ \t]+)?(`{3,}|~{3,})(.*)$/;

/** The lines of `text` outside fenced blocks, each with its 1-based line number. */
export function linesOutsideFences(text) {
  const outside = [];
  let open = null;
  text.split(/\r?\n/).forEach((line, index) => {
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      if (open === null) open = marker;
      else if (marker[0] === open[0] && marker.length >= open.length && !fence[2].trim()) open = null;
      return;
    }
    if (open === null) outside.push({ line, number: index + 1 });
  });
  return outside;
}
