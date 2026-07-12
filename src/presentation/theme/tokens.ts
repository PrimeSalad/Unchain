/**
 * Wool & Chain - Unchain design tokens.
 *
 * Every colour here was sampled from the mascot art in /assets and every
 * contrast pairing was verified against WCAG 2.2 (see docs/plan.md §4.1).
 * Components must import from here - never hardcode a hex value.
 *
 * The system aims for Duolingo-grade craft (tactile chunky controls, rounded
 * friendly forms, delightful motion) held inside Unchain's calmer, lower-arousal
 * recovery palette.
 */

// ---------------------------------------------------------------------------
// Palette (raw values - prefer the semantic `lightTheme` / `darkTheme` below)
// ---------------------------------------------------------------------------

export const palette = {
  // Brand - from the sheep's purple hooves & chains
  grape: '#5A2E7A',
  grapeDeep: '#43265C',
  grapeSoft: '#EEE7F3', // 12% tint surface
  grape300: '#B98FD6', // dark-mode primary

  // Accent - from mouth / ears / cheeks
  coral: '#E8697A',
  coralDeep: '#B23A4B',
  coralSoft: '#FBE7EA',
  coral300: '#F09AA6',

  // Celebration warmth - from the sheep's face / wool tan (our "dawn/hope")
  honey: '#D0A070',
  honeyDeep: '#97591F',
  honeySoft: '#F6ECDD',

  // Neutrals - warm, aubergine-tinted (echo the eyes), never clinical
  ink: '#2A1F33',
  slate: '#6B5E75',
  wool: '#FBF6EF',
  card: '#FFFFFF',
  hairline: '#ECE4DC',

  // Semantic
  sage: '#4E7A5A',
  sageSoft: '#E6F0E8',
  brick: '#B0453F',

  // Dark theme
  night: '#1A1420',
  nightCard: '#241C2E',
  nightRaised: '#2E2439',
  nightHairline: '#352B42',
  fog: '#ECE6F2',
  fogDim: '#A99DB6',

  white: '#FFFFFF',
  black: '#000000',
} as const;

// ---------------------------------------------------------------------------
// Semantic themes
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark';

export interface ThemeColor {
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  celebrate: string;
  celebrateText: string;
  celebrateSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  hairline: string;
  text: string;
  textDim: string;
  textInverse: string;
  edgePrimary: string;
  edgeNeutral: string;
}

export interface Theme {
  mode: ThemeMode;
  color: ThemeColor;
}

export const lightTheme: Theme = {
  mode: 'light',
  color: {
    primary: palette.grape,
    primaryDeep: palette.grapeDeep,
    primarySoft: palette.grapeSoft,
    onPrimary: palette.white,

    accent: palette.coral,
    accentText: palette.coralDeep,
    accentSoft: palette.coralSoft,

    celebrate: palette.honey,
    celebrateText: palette.honeyDeep,
    celebrateSoft: palette.honeySoft,

    success: palette.sage,
    successSoft: palette.sageSoft,
    danger: palette.brick,

    bg: palette.wool,
    surface: palette.card,
    surfaceAlt: palette.grapeSoft,
    hairline: palette.hairline,

    text: palette.ink,
    textDim: palette.slate,
    textInverse: palette.white,

    // The 3D "chunky button" bottom edge - darkened brand tones
    edgePrimary: '#3D1E56',
    edgeNeutral: '#D8CEC4',
  },
};

export const darkTheme: Theme = {
  mode: 'dark',
  color: {
    primary: palette.grape300,
    primaryDeep: palette.grape300,
    primarySoft: '#2C2138',
    onPrimary: palette.night,

    accent: palette.coral300,
    accentText: palette.coral300,
    accentSoft: '#3A2530',

    celebrate: palette.honey,
    celebrateText: '#E7B983',
    celebrateSoft: '#332A20',

    success: '#77B58A',
    successSoft: '#25332A',
    danger: '#E28580',

    bg: palette.night,
    surface: palette.nightCard,
    surfaceAlt: palette.nightRaised,
    hairline: palette.nightHairline,

    text: palette.fog,
    textDim: palette.fogDim,
    textInverse: palette.night,

    edgePrimary: '#7A5B96',
    edgeNeutral: '#160F1E',
  },
};

// ---------------------------------------------------------------------------
// Spacing - 8pt scale (docs/plan.md §4.3)
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

// Corner radius
export const radius = {
  chip: 8,
  input: 12,
  button: 16,
  card: 20,
  sheet: 28,
  round: 999,
} as const;

// Elevation (two levels only; dark mode lightens the surface instead)
export const elevation = {
  e1: {
    shadowColor: '#2A1F33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  e2: {
    shadowColor: '#2A1F33',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

// ---------------------------------------------------------------------------
// Typography scale (docs/plan.md §4.2)
// ---------------------------------------------------------------------------

export const fonts = {
  // Rounded display family (loaded via @expo-google-fonts/nunito)
  displayBold: 'Nunito_800ExtraBold',
  displayHeavy: 'Nunito_900Black',
  rounded: 'Nunito_700Bold',
  roundedSemi: 'Nunito_600SemiBold',
} as const;

export const type = {
  display: { fontSize: 40, lineHeight: 46, fontFamily: fonts.displayHeavy },
  title1: { fontSize: 28, lineHeight: 34, fontFamily: fonts.displayBold },
  title2: { fontSize: 22, lineHeight: 28, fontFamily: fonts.rounded },
  headline: { fontSize: 17, lineHeight: 22, fontFamily: fonts.rounded },
  body: { fontSize: 17, lineHeight: 24, fontFamily: fonts.roundedSemi },
  callout: { fontSize: 16, lineHeight: 21, fontFamily: fonts.roundedSemi },
  footnote: { fontSize: 13, lineHeight: 18, fontFamily: fonts.roundedSemi },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.roundedSemi },
} as const;

// Motion timings (ms)
export const motion = {
  micro: 150,
  standard: 250,
  transition: 350,
  // Breathing tempo (SOS)
  inhale: 4000,
  hold: 2000,
  exhale: 6000,
  spring: { damping: 15, stiffness: 140, mass: 0.9 },
  springSoft: { damping: 18, stiffness: 90, mass: 1 },
} as const;
