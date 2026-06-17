// On-device golf ball flight simulator - a TypeScript port of
// src/openflight/ballistics.py::simulate(). Integrates drag + Magnus with RK4
// so the 3D/2D tracers show the real curved trajectory (including side curve
// from the spin axis) instead of a plain parabola.
//
// World frame (yards in the returned points): x = downrange, y = lateral
// (+right), z = height. Aerodynamic fits match the Python reference
// (Bearman & Harvey 1976; Kensrud & Smith 2018; ~4%/s spin decay).

import type { Shot } from '../types/shot';

const MPH_TO_MPS = 0.44704;
const M_TO_YD = 1.09361;

// USGA maximum-conforming ball.
const BALL_MASS_KG = 0.04593;
const BALL_RADIUS_M = 0.02135;
const BALL_AREA_M2 = Math.PI * BALL_RADIUS_M * BALL_RADIUS_M;
const AIR_DENSITY = 1.225; // kg/m³, sea level 15 °C

const CD_BASE = 0.205;
const CD_SPIN_COEFF = 0.18;
const CL_SATURATION = 0.32;
const CL_HALF_SP = 0.15;
const SPIN_DECAY_RATE = 0.04;
const GRAVITY = 9.81;

const DT = 0.002;            // 500 Hz RK4 - effectively exact for these timescales
const MAX_FLIGHT_S = 15.0;
const SAMPLE_INTERVAL_S = 0.05;

// Club-typical spin (RPM), TrackMan PGA Tour averages - fallback when measured
// spin is missing. Keyed by the mobile club id strings.
const CLUB_TYPICAL_SPIN_RPM: Record<string, number> = {
  driver: 2700, '3-wood': 3500, '5-wood': 4200, '7-wood': 4800,
  '3-hybrid': 4400, '5-hybrid': 4900, '7-hybrid': 5300, '9-hybrid': 5800,
  '2-iron': 4000, '3-iron': 4500, '4-iron': 5000, '5-iron': 5400,
  '6-iron': 6000, '7-iron': 6500, '8-iron': 7500, '9-iron': 8500,
  pw: 9000, gw: 9500, sw: 10000, lw: 10500,
};
const DEFAULT_SPIN_RPM = 5000;

export interface LaunchConditions {
  ballSpeedMph: number;
  launchAngleV: number;
  launchAngleH: number;
  spinRpm: number;
  spinAxisDeg: number;
}

export interface TrajectoryPoint { x: number; y: number; z: number }

export interface Trajectory {
  points: TrajectoryPoint[];
  carryYards: number;
  apexYards: number;
  lateralYards: number;
  flightTimeS: number;
  landingAngleDeg: number;
}

/**
 * Build launch conditions from a shot. Returns null when the vertical launch
 * angle is unavailable (no physical sim possible). Uses measured spin when
 * present, otherwise a club-typical fallback.
 */
export function launchFromShot(shot: Shot): LaunchConditions | null {
  if (shot.launch_angle_vertical == null) return null;
  const spinRpm =
    shot.spin_rpm != null && Number.isFinite(shot.spin_rpm) && shot.spin_rpm > 0
      ? shot.spin_rpm
      : (CLUB_TYPICAL_SPIN_RPM[shot.club] ?? DEFAULT_SPIN_RPM);
  return {
    ballSpeedMph: shot.ball_speed_mph,
    launchAngleV: shot.launch_angle_vertical,
    launchAngleH: shot.launch_angle_horizontal ?? 0,
    spinRpm,
    spinAxisDeg: shot.spin_axis_deg ?? 0,
  };
}

function cdOf(sp: number): number { return CD_BASE + CD_SPIN_COEFF * sp; }
function clOf(sp: number): number { return sp > 0 ? (CL_SATURATION * sp) / (CL_HALF_SP + sp) : 0; }

type State = [number, number, number, number, number, number]; // x,y,z,vx,vy,vz
type Axis = [number, number, number];

function derivatives(state: State, omega: number, axis: Axis): State {
  const vx = state[3], vy = state[4], vz = state[5];
  const v = Math.hypot(vx, vy, vz);
  if (v < 1e-6) return [vx, vy, vz, 0, 0, -GRAVITY];

  const sp = (BALL_RADIUS_M * omega) / v;
  const q = (0.5 * AIR_DENSITY * v * v * BALL_AREA_M2) / BALL_MASS_KG;
  const dragA = cdOf(sp) * q;
  const liftA = clOf(sp) * q;

  let ax = -dragA * vx / v;
  let ay = -dragA * vy / v;
  let az = -dragA * vz / v;

  const [ox, oy, oz] = axis;
  const cx = oy * vz - oz * vy;
  const cy = oz * vx - ox * vz;
  const cz = ox * vy - oy * vx;
  const cMag = Math.hypot(cx, cy, cz);
  if (cMag > 1e-6) {
    ax += (liftA * cx) / cMag;
    ay += (liftA * cy) / cMag;
    az += (liftA * cz) / cMag;
  }
  az -= GRAVITY;
  return [vx, vy, vz, ax, ay, az];
}

function rk4Step(state: State, omega: number, axis: Axis, dt: number): State {
  const k1 = derivatives(state, omega, axis);
  const s2 = state.map((s, i) => s + 0.5 * dt * k1[i]!) as State;
  const k2 = derivatives(s2, omega, axis);
  const s3 = state.map((s, i) => s + 0.5 * dt * k2[i]!) as State;
  const k3 = derivatives(s3, omega, axis);
  const s4 = state.map((s, i) => s + dt * k3[i]!) as State;
  const k4 = derivatives(s4, omega, axis);
  return state.map(
    (s, i) => s + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!),
  ) as State;
}

/** Integrate flight from launch to first ground contact (z = 0). */
export function simulateTrajectory(c: LaunchConditions): Trajectory {
  const v0 = c.ballSpeedMph * MPH_TO_MPS;
  const laV = (c.launchAngleV * Math.PI) / 180;
  const laH = (c.launchAngleH * Math.PI) / 180;

  const vx = v0 * Math.cos(laV) * Math.cos(laH);
  const vy = v0 * Math.cos(laV) * Math.sin(laH);
  const vz = v0 * Math.sin(laV);

  // spin_axis_deg=0 → pure backspin (axis = -y) → Magnus lifts up.
  const axisRad = (c.spinAxisDeg * Math.PI) / 180;
  const axis: Axis = [0, -Math.cos(axisRad), Math.sin(axisRad)];
  let omega = (c.spinRpm * 2 * Math.PI) / 60;

  const points: TrajectoryPoint[] = [{ x: 0, y: 0, z: 0 }];
  let state: State = [0, 0, 0, vx, vy, vz];
  let t = 0;
  let maxZ = 0;
  let lastSample = 0;

  while (t < MAX_FLIGHT_S) {
    const next = rk4Step(state, omega, axis, DT);
    t += DT;
    omega *= Math.exp(-SPIN_DECAY_RATE * DT);

    const z = next[2];
    if (z > maxZ) maxZ = z;

    if (z <= 0 && t > DT) {
      const prevZ = state[2];
      const denom = prevZ - z;
      const frac = Math.abs(denom) > 1e-9 ? prevZ / denom : 0;
      const final = state.map((s, i) => s + frac * (next[i]! - s)) as State;
      const [fx, fy, fz, fvx, fvy, fvz] = final;
      points.push({ x: fx * M_TO_YD, y: fy * M_TO_YD, z: Math.max(fz, 0) * M_TO_YD });
      return {
        points,
        carryYards: fx * M_TO_YD,
        apexYards: maxZ * M_TO_YD,
        lateralYards: fy * M_TO_YD,
        flightTimeS: (t - DT) + frac * DT,
        landingAngleDeg: (Math.atan2(-fvz, Math.hypot(fvx, fvy)) * 180) / Math.PI,
      };
    }

    state = next;
    if (t - lastSample >= SAMPLE_INTERVAL_S) {
      points.push({ x: state[0] * M_TO_YD, y: state[1] * M_TO_YD, z: state[2] * M_TO_YD });
      lastSample = t;
    }
  }

  const [fx, fy, , fvx, fvy, fvz] = state;
  return {
    points,
    carryYards: fx * M_TO_YD,
    apexYards: maxZ * M_TO_YD,
    lateralYards: fy * M_TO_YD,
    flightTimeS: t,
    landingAngleDeg: (Math.atan2(-fvz, Math.hypot(fvx, fvy)) * 180) / Math.PI,
  };
}
