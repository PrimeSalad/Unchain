/**
 * StretchFigure — an animated demo mannequin for every stretch in the library.
 *
 * Built on a small forward-kinematics rig: every pose is expressed as JOINT
 * ANGLES over fixed bone lengths (torso, upper arm, forearm, thigh, shin), so
 * limbs never stretch or shrink and the motion reads as a real body. Each
 * stretch is a continuous function of a looping phase θ (~3.4 s breathing
 * tempo) — smooth in, smooth out, no keyframe pops. Far-side limbs render
 * slightly dimmed for depth. Honors Reduce Motion by freezing mid-stretch.
 * Drawn entirely in code (react-native-svg): offline, zero asset weight.
 */

import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Polyline } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';

// ─────────────────────────────────────────────────────────────────────────────
// Rig — bone lengths (canvas units) and angle conventions.
//
//   Limb angles are ABSOLUTE, measured from straight-down:
//     0° = hanging down · 90° = out to the right · 180° = straight up
//   Elbow / knee angles are RELATIVE bends added to the parent bone.
//   Torso `lean` is measured from vertical: 0 = upright, + = leaning right
//   (which side-view stretches treat as "forward").
// ─────────────────────────────────────────────────────────────────────────────

const TORSO = 34;
const HEAD_OFF = 13;   // neck → head centre
const HEAD_R = 8.5;
const UARM = 15;
const FARM = 15;
const THIGH = 23;
const SHIN = 24;

type Pt = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
/** Point at `len` from `o` in limb-space (0° = down). */
const down = (o: Pt, angleDeg: number, len: number): Pt => [
  o[0] + len * Math.sin(rad(angleDeg)),
  o[1] + len * Math.cos(rad(angleDeg)),
];
/** Point at `len` from `o` in torso-space (0° = up). */
const up = (o: Pt, angleDeg: number, len: number): Pt => [
  o[0] + len * Math.sin(rad(angleDeg)),
  o[1] - len * Math.cos(rad(angleDeg)),
];
const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

interface Limb { a: number; b: number }          // shoulder/hip angle + bend
interface FKPose {
  px: number; py: number;                        // pelvis
  lean: number;                                  // torso, from vertical
  head: number;                                  // head tilt relative to torso
  armL: Limb; armR: Limb;
  legL: Limb; legR: Limb;
  /** Horizontal hip/shoulder spacing (side views squeeze it for depth). */
  spread: number;
}

const STAND: FKPose = {
  px: 60, py: 79, lean: 0, head: 0,
  armL: { a: -10, b: -6 }, armR: { a: 10, b: 6 },
  legL: { a: -4, b: 0 }, legR: { a: 4, b: 0 },
  spread: 5,
};

/** 0→1→0 “breathe into the stretch” wave. */
const wave = (t: number) => (1 - Math.cos(t)) / 2;
/** −1→1→−1 sway. */
const sway = (t: number) => Math.sin(t);
/** One-sided smooth ramp of the sway (0..1 on its half of the cycle). */
const side = (k: number) => Math.max(0, k) ** 1.2;

// ─────────────────────────────────────────────────────────────────────────────
// Poses — each stretch as a continuous function of phase θ.
// ─────────────────────────────────────────────────────────────────────────────

function poseFor(title: string, t: number): FKPose {
  const s = wave(t);
  const k = sway(t);

  switch (title) {
    // Front view: head tilts ear-to-shoulder, everything else still.
    case 'Neck Release':
      return { ...STAND, head: 38 * k };

    // Front view: both shoulders draw slow circles — arms trail the roll,
    // the whole frame bobs a touch.
    case 'Shoulder Rolls': {
      const roll = 10 * Math.cos(t);
      const lift = 6 * Math.sin(t);
      return {
        ...STAND,
        py: 79 + 1.2 * Math.sin(t),
        head: 3 * Math.sin(t),
        armL: { a: -12 + roll, b: -14 - lift },
        armR: { a: 12 - roll, b: 14 + lift },
      };
    }

    // Side view: hinge at the hips past horizontal while the hips shift back
    // for balance (real fold mechanics); arms dangle to the floor by gravity.
    case 'Forward Fold': {
      const lean = 112 * s;
      return {
        ...STAND, spread: 2,
        px: 60 - 6 * s,
        lean,
        head: 14 * s,
        // Arms hang, drifting slightly back toward the toes at full depth.
        armL: { a: -9 * s + 2, b: 3 }, armR: { a: -9 * s - 2, b: -3 },
        legL: { a: -1, b: 6 * s }, legR: { a: 1, b: 6 * s },
      };
    }

    // Front view: torso leans while the opposite arm arcs overhead in the
    // same direction; the other hand rests on the hip.
    case 'Side Stretch': {
      const lean = 22 * k;
      const l = side(k);   // leaning right → LEFT arm overhead
      const r = side(-k);  // leaning left  → RIGHT arm overhead
      return {
        ...STAND,
        lean,
        head: 6 * k,
        armL: { a: lerp(35, 178 + lean, l), b: lerp(-115, 14, l) },
        armR: { a: lerp(-35, -178 + lean, r), b: lerp(115, -14, r) },
      };
    }

    // Side view: a flat-back reach — shallower hinge than the fold, arms
    // extended ahead toward the toes instead of dangling.
    case 'Hamstring Reach': {
      const lean = 72 * s;
      return {
        ...STAND, spread: 2,
        px: 60 - 4 * s,
        lean,
        head: 6 * s,
        armL: { a: 38 * s + 2, b: 4 }, armR: { a: 38 * s - 2, b: -4 },
        legL: { a: -1, b: 2 * s }, legR: { a: 1, b: 2 * s },
      };
    }

    // Side view: hands clasped behind the back, chest lifting as the arms
    // draw back and the gaze rises.
    case 'Chest Opener': {
      return {
        ...STAND, spread: 2,
        lean: -6 - 6 * s,
        head: -10 - 8 * s,
        armL: { a: -26 - 14 * s, b: 18 }, armR: { a: -24 - 14 * s, b: 16 },
        legL: { a: -1, b: 0 }, legR: { a: 1, b: 0 },
      };
    }

    // Front view: pelvis orbits while the feet stay planted (hip angles
    // counter the sway) and hands stay on the hips.
    case 'Hip Circles': {
      const dx = 8 * Math.cos(t);
      // Upward-only bob: the pelvis lifts at the lateral extremes (weight
      // shift) and never dips, so the planted feet can't clip the ground.
      const dy = -2 * Math.abs(Math.sin(t));
      // Counter-rotate the legs so the feet keep contact with the ground.
      const counter = -(Math.asin(dx / (THIGH + SHIN)) * 180) / Math.PI;
      return {
        ...STAND,
        px: 60 + dx, py: 79 + dy,
        lean: -0.9 * (dx / 8) * 8,     // torso counters, head stays centred
        head: 2 * (dx / 8),
        armL: { a: 38, b: -118 }, armR: { a: -38 + 0, b: 118 },
        legL: { a: counter - 4, b: 0 }, legR: { a: counter + 4, b: 0 },
      };
    }

    // Side view: classic wall calf stretch — hands pressing forward, front
    // knee bending deeper as the back leg stays long, heel down.
    case 'Calf Stretch': {
      return {
        ...STAND, spread: 1,
        px: 56 + 5 * s, py: 78,
        lean: 14 + 4 * s,
        head: -8,
        armL: { a: 62, b: 14 }, armR: { a: 58, b: 12 },   // pressing the wall
        legR: { a: 26, b: -(16 + 14 * s) },               // front leg bends
        legL: { a: -20 - 4 * s, b: 0 },                   // back leg long
      };
    }

    // Seated, front view: legs folded on the mat, both arms sweep with the
    // twist while the head leads the rotation.
    case 'Seated Twist': {
      const tw = 26 * k;
      return {
        px: 60, py: 96, spread: 5,
        lean: 3 * k,
        head: 10 * k,
        armL: { a: -14 + tw * 2.2, b: -20 + tw }, armR: { a: 14 + tw * 2.2, b: 20 + tw },
        legL: { a: -62, b: 118 }, legR: { a: 62, b: -118 },
      };
    }

    // Front view: forearms raised ahead, hands drawing quick small circles
    // (wrists move at 2× the base tempo).
    case 'Wrists & Hands': {
      const w = 16 * Math.cos(2 * t);
      return {
        ...STAND,
        armL: { a: -55, b: 118 + w }, armR: { a: 55, b: -118 - w },
      };
    }

    // Fallback for future stretches: a gentle full-body reach upward.
    default:
      return {
        ...STAND,
        py: 79 - 1.5 * s,
        head: -6 * s,
        armL: { a: lerp(-10, -172, s), b: lerp(-6, -6, s) },
        armR: { a: lerp(10, 172, s), b: lerp(6, 6, s) },
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton solve + render
// ─────────────────────────────────────────────────────────────────────────────

interface Skeleton {
  headC: Pt; neck: Pt; pelvis: Pt;
  eL: Pt; hL: Pt; eR: Pt; hR: Pt;
  kL: Pt; fL: Pt; kR: Pt; fR: Pt;
}

function solve(p: FKPose): Skeleton {
  const pelvis: Pt = [p.px, p.py];
  const neck = up(pelvis, p.lean, TORSO);
  const headC = up(neck, p.lean + p.head, HEAD_OFF);

  // Shoulders sit just below the neck along the torso; hips flank the pelvis.
  const shoulder = up(pelvis, p.lean, TORSO - 2);
  const shL: Pt = [shoulder[0] - p.spread * 0.6, shoulder[1]];
  const shR: Pt = [shoulder[0] + p.spread * 0.6, shoulder[1]];
  const hipL: Pt = [pelvis[0] - p.spread * 0.8, pelvis[1]];
  const hipR: Pt = [pelvis[0] + p.spread * 0.8, pelvis[1]];

  const eL = down(shL, p.armL.a, UARM);
  const hL = down(eL, p.armL.a + p.armL.b, FARM);
  const eR = down(shR, p.armR.a, UARM);
  const hR = down(eR, p.armR.a + p.armR.b, FARM);

  const kL = down(hipL, p.legL.a, THIGH);
  const fL = down(kL, p.legL.a + p.legL.b, SHIN);
  const kR = down(hipR, p.legR.a, THIGH);
  const fR = down(kR, p.legR.a + p.legR.b, SHIN);

  return { headC, neck, pelvis, eL, hL, eR, hR, kL, fL, kR, fR };
}

const CYCLE_MS = 3400;

export function StretchFigure({ title, size = 150 }: { title: string; size?: number }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [theta, setTheta] = useState(reduce ? Math.PI : 0);
  const raf = useRef(0);

  useEffect(() => {
    if (reduce) {
      // Freeze at the deepest point of the stretch — still a useful demo.
      setTheta(Math.PI);
      return;
    }
    let last = 0;
    const tick = (ts: number) => {
      // ~30 fps is plenty for a demo figure and easy on the JS thread.
      if (ts - last >= 33) {
        last = ts;
        setTheta(((ts % CYCLE_MS) / CYCLE_MS) * Math.PI * 2);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [reduce, title]);

  const sk = solve(poseFor(title, theta));
  const stroke = theme.color.primary;
  const w = 5;

  const line = (pts: Pt[], key: string, dim?: boolean) => (
    <Polyline
      key={key}
      points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
      fill="none"
      stroke={stroke}
      strokeOpacity={dim ? 0.5 : 1}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  return (
    <View
      accessibilityLabel={`Animated demonstration of ${title}`}
      style={{ width: size, height: size * (140 / 120), alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size * (140 / 120)} viewBox="0 0 120 140">
        {/* Mat */}
        <Ellipse cx={60} cy={128} rx={36} ry={5} fill={theme.color.surfaceAlt} />

        {/* Far-side limbs first, slightly dimmed for depth */}
        {line([sk.pelvis, sk.kL, sk.fL], 'legL', true)}
        {line([sk.neck, sk.eL, sk.hL], 'armL', true)}

        {/* Torso */}
        {line([sk.neck, sk.pelvis], 'spine')}

        {/* Near-side limbs */}
        {line([sk.pelvis, sk.kR, sk.fR], 'legR')}
        {line([sk.neck, sk.eR, sk.hR], 'armR')}

        {/* Head */}
        <Circle
          cx={sk.headC[0]}
          cy={sk.headC[1]}
          r={HEAD_R}
          fill={theme.color.primarySoft}
          stroke={stroke}
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}
