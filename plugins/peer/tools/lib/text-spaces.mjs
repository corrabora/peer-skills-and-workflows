// Unicode spaces that YAML 1.1 and 1.2 both read as ordinary text: only space
// and tab separate, and these are neither line breaks, controls nor a byte
// order mark. Printed, each looks like a space or like nothing, so diagnostics
// about text holding them show each written as \uXXXX.

const TEXT_SPACES = '\\u00A0\\u1680\\u2000-\\u200A\\u202F\\u205F\\u3000';
const TEXT_SPACE = new RegExp(`[${TEXT_SPACES}]`, 'g');

/**
 * Returns null when `text` holds none of the text spaces; otherwise `shown`,
 * the text with each written as \uXXXX, `named`, the code points ('U+00A0' or
 * 'U+00A0 and U+2003'), and `plural`.
 */
export function revealTextSpaces(text) {
  const codes = [];
  const shown = text.replace(TEXT_SPACE, (space) => {
    const code = `U+${space.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
    if (!codes.includes(code)) codes.push(code);
    return `\\u${code.slice(2)}`;
  });
  if (!codes.length) return null;
  const named = codes.length === 1 ? codes[0] : `${codes.slice(0, -1).join(', ')} and ${codes.at(-1)}`;
  return { shown, named, plural: codes.length > 1 };
}

/** `text` in single quotes, with any text spaces written as \uXXXX and named after it. */
export function quoteShowingSpaces(text) {
  const spaces = revealTextSpaces(text);
  return spaces ? `'${spaces.shown}' (${spaces.named} written as \\uXXXX)` : `'${text}'`;
}
