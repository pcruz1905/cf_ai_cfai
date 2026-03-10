/**
 * Unicode symbols for terminal output.
 */

// Check if Windows terminal (limited Unicode support)
const isWindows = process.platform === "win32";

export const symbols = {
  // Status indicators
  success: isWindows ? "\u221A" : "\u2714", // checkmark
  error: isWindows ? "\u00D7" : "\u2718", // x mark
  warning: "\u26A0", // warning triangle
  info: "\u2139", // info circle
  question: "?",

  // Progress
  spinner: ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"],
  spinnerDots: ["\u2801", "\u2802", "\u2804", "\u2840", "\u2880", "\u2820", "\u2810", "\u2808"],
  spinnerLine: ["-", "\\", "|", "/"],
  spinnerCircle: ["\u25D0", "\u25D3", "\u25D1", "\u25D2"],
  spinnerArc: ["\u25DC", "\u25DD", "\u25DE", "\u25DF"],
  spinnerBounce: ["\u2801", "\u2804", "\u2802", "\u2808"],
  spinnerArrow: ["\u2190", "\u2196", "\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199"],

  // Arrows
  arrowRight: "\u2192",
  arrowLeft: "\u2190",
  arrowUp: "\u2191",
  arrowDown: "\u2193",
  arrowRightFilled: "\u25B6",
  arrowLeftFilled: "\u25C0",
  arrowUpFilled: "\u25B2",
  arrowDownFilled: "\u25BC",
  pointer: isWindows ? ">" : "\u276F",
  pointerSmall: isWindows ? ">" : "\u203A",

  // Bullets and list markers
  bullet: "\u2022",
  bulletWhite: "\u25E6",
  star: "\u2605",
  starEmpty: "\u2606",
  heart: "\u2665",
  diamond: "\u25C6",
  diamondSmall: "\u25C8",
  square: "\u25A0",
  squareSmall: "\u25AA",
  squareEmpty: "\u25A1",
  circle: "\u25CF",
  circleEmpty: "\u25CB",
  circleDotted: "\u25CC",

  // Progress bar components
  progressFull: "\u2588",
  progressHalf: "\u258C",
  progressEmpty: "\u2591",
  progressLight: "\u2592",
  progressMedium: "\u2593",

  // Box drawing (single line)
  boxTopLeft: "\u250C",
  boxTopRight: "\u2510",
  boxBottomLeft: "\u2514",
  boxBottomRight: "\u2518",
  boxHorizontal: "\u2500",
  boxVertical: "\u2502",
  boxCross: "\u253C",
  boxTeeLeft: "\u2524",
  boxTeeRight: "\u251C",
  boxTeeTop: "\u2534",
  boxTeeBottom: "\u252C",

  // Box drawing (double line)
  boxDoubleTopLeft: "\u2554",
  boxDoubleTopRight: "\u2557",
  boxDoubleBottomLeft: "\u255A",
  boxDoubleBottomRight: "\u255D",
  boxDoubleHorizontal: "\u2550",
  boxDoubleVertical: "\u2551",

  // Box drawing (rounded)
  boxRoundTopLeft: "\u256D",
  boxRoundTopRight: "\u256E",
  boxRoundBottomLeft: "\u2570",
  boxRoundBottomRight: "\u256F",

  // Box drawing (heavy)
  boxHeavyTopLeft: "\u250F",
  boxHeavyTopRight: "\u2513",
  boxHeavyBottomLeft: "\u2517",
  boxHeavyBottomRight: "\u251B",
  boxHeavyHorizontal: "\u2501",
  boxHeavyVertical: "\u2503",

  // Separators
  ellipsis: "\u2026",
  middleDot: "\u00B7",
  dash: "\u2014",

  // Misc
  radioOn: "\u25C9",
  radioOff: "\u25CE",
  checkboxOn: "\u2612",
  checkboxOff: "\u2610",
  play: "\u25B6",
  pause: "\u23F8",
  stop: "\u25A0",
  refresh: "\u21BB",
  lightning: "\u26A1",
  gear: "\u2699",
  wrench: "\u{1F527}",
  package: "\u{1F4E6}",
  rocket: "\u{1F680}",
  fire: "\u{1F525}",
  sparkles: "\u2728",
  tada: "\u{1F389}",
  clock: "\u{1F550}",
  folder: "\u{1F4C1}",
  file: "\u{1F4C4}",
  link: "\u{1F517}",
  lock: "\u{1F512}",
  key: "\u{1F511}",
  cloud: "\u2601",
  sun: "\u2600",
  moon: "\u{1F319}",
} as const;

// Spinner frame sets for different animations
export const spinnerFrames = {
  dots: symbols.spinner,
  dots2: symbols.spinnerDots,
  line: symbols.spinnerLine,
  circle: symbols.spinnerCircle,
  arc: symbols.spinnerArc,
  bounce: symbols.spinnerBounce,
  arrow: symbols.spinnerArrow,
} as const;

export type SpinnerType = keyof typeof spinnerFrames;
