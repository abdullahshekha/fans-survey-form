// Free-text "Other" brand names typed by reps vary in case/spelling/suffix
// (e.g. "karam", "Karam Fan", "Karam inverter fan"). Recognize known brands so
// they merge into one bucket instead of scattering as 1-count noise.
const KNOWN_ALIASES: [string, RegExp][] = [
  ["Karam", /karam/i],
  ["Champion", /champion/i],
  ["Orient", /orient/i],
  ["Millat", /millat/i],
  ["Super Asia", /super\s*asia/i],
  ["Pak Asia", /pak\s*asia/i],
  ["Noor Asia", /noor\s*asia/i],
  ["Welco", /welco/i],
  ["Mefco", /mefco/i],
  ["Younus", /younus/i],
  ["Alaska", /alaska/i],
  ["National", /national/i],
  ["Sonic", /sonic/i],
  ["Leeds", /leeds/i],
  ["Hino", /hino/i],
  ["Bukhari", /bukhari/i],
  ["Agha Fans", /agha/i],
  ["AR Fans", /^ar\s*fans?$/i],
  ["IS Fans", /^is\s*fans?$/i],
  ["O Den", /o\s*den/i],
  ["Mehran Fan", /mehran/i],
  ["5 Star", /5\s*star/i],
  ["GFC", /^gfc$/i],
  ["BFC", /^bfc$/i],
  ["NFC", /^nfc$/i],
  ["Silk Fans", /silk/i],
  ["Al Burj", /al\s*burj/i],
  ["Rado", /rado/i],
  ["Airmax", /airmax/i],
  ["Signature", /signature/i],
  ["Wahid", /wahid/i],
  ["Lahore", /^lahore$/i],
  ["Beta Fan", /beta/i],
];

function toTitleCase(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Maps a free-text "Other" brand name to a display bucket, merging known
 * aliases and case/whitespace variants of unrecognized names. */
export function normalizeOtherBrand(raw: string): string {
  const trimmed = raw.trim();
  for (const [canonical, pattern] of KNOWN_ALIASES) {
    if (pattern.test(trimmed)) return canonical;
  }
  return toTitleCase(trimmed);
}
