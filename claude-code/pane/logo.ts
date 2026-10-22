// The Faro mark from media/faro.svg in text: the hexagon of path nodes in
// the accent colour, the lighthouse inside it in the text colour.

export const LOGO_ROWS: readonly string[] = [
  "      o      ",
  "  .-'   '-.  ",
  "o'    ^    'o",
  "|    [#]    |",
  "|  .-'o'-.  |",
  "o-'  /#\\  '-o",
  "  '-/###\\-'  ",
  " =========== ",
]

export const LOGO_WIDTH = 13

// The name beside the mark, in figlet's standard font.
export const WORDMARK_ROWS: readonly string[] = [
  " _____ _    ____   ___   ",
  "|  ___/ \\  |  _ \\ / _ \\  ",
  "| |_ / _ \\ | |_) | | | | ",
  "|  _/ ___ \\|  _ <| |_| | ",
  "|_|/_/   \\_\\_| \\_\\\\___/  ",
]

export const WORDMARK_WIDTH = 25

export type LogoSegment = { text: string; isLight: boolean }

const LIGHT = /[\^#[\]/\\=]/

// Splits a row into runs of hexagon and lighthouse characters, so each run
// can be drawn in its own colour.
export function logoSegments(row: string): LogoSegment[] {
  const segments: LogoSegment[] = []

  for (const char of row) {
    const isLight = LIGHT.test(char)
    const last = segments.at(-1)

    if (last && (last.isLight === isLight || char === ' ')) {
      last.text += char
    } else {
      segments.push({ text: char, isLight })
    }
  }

  return segments
}
