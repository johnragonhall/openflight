import type { ShotShape } from '../types/shot';

/**
 * Bag ordering by club type — used to sort BagOverview rows.
 * Clubs not in this list sort alphabetically after the last entry.
 */
export const BAG_ORDER: string[] = [
  'driver',
  '3-wood', '5-wood', '7-wood',
  'hybrid', '2-hybrid', '3-hybrid', '4-hybrid', '5-hybrid',
  '2-iron', '3-iron', '4-iron', '5-iron', '6-iron', '7-iron', '8-iron', '9-iron',
  'pitching-wedge', 'gap-wedge', 'sand-wedge', 'lob-wedge',
];

/**
 * Classifies a shot shape for a right-handed golfer.
 *
 * face_to_path_deg: positive = open face (fade/slice), negative = closed (draw/hook)
 * launch_angle_horizontal: positive = starts right (push), negative = starts left (pull)
 *
 * Returns null when both inputs are null (no K-LD7 data).
 * When only one input is null, the null is treated as 0 (no lateral/curve contribution).
 * pull-draw collapses to 'draw' by design; push-fade collapses to 'fade'.
 */
export function classifyShotShape(
  face_to_path_deg: number | null | undefined,
  launch_angle_horizontal: number | null | undefined,
): ShotShape | null {
  if (face_to_path_deg == null && launch_angle_horizontal == null) return null;

  const ftp = face_to_path_deg ?? 0;
  const lateral = launch_angle_horizontal ?? 0;

  // Determine lateral start direction
  const isLeft = lateral < -3;   // pull
  const isRight = lateral > 3;   // push

  // Determine curve from face-to-path
  let curve: 'duck-hook' | 'hook' | 'draw' | 'straight' | 'fade' | 'slice' | 'banana-slice';
  if (ftp > 8)       curve = 'banana-slice';
  else if (ftp > 4)  curve = 'slice';
  else if (ftp > 2)  curve = 'fade';
  else if (ftp < -8) curve = 'duck-hook';
  else if (ftp < -4) curve = 'hook';
  else if (ftp < -2) curve = 'draw';
  else               curve = 'straight';

  // Compound shapes
  if (isLeft && curve === 'hook')  return 'pull-hook';
  if (isRight && curve === 'slice') return 'push-slice';
  if (isLeft)  return curve === 'straight' ? 'pull' : curve;

  // Block: very far right start (lateral > 7) with no curve — distinct from moderate push
  if (lateral > 7 && curve === 'straight') return 'block';

  if (isRight) return curve === 'straight' ? 'push' : curve;
  return curve;
}

/**
 * Returns a theme color for a given shot shape.
 * Uses semantic colors: draw/hook = green, straight = gold, fade/slice = warn, push/pull = sub.
 */
export function shotShapeColor(shape: ShotShape | null | undefined, C: {
  ok: string; accent: string; warn: string; sub: string; err: string;
}): string {
  if (!shape) return C.sub;
  switch (shape) {
    case 'duck-hook':
    case 'draw':
    case 'pull-hook':
    case 'hook':
      return C.ok;
    case 'straight':
      return C.accent;
    case 'fade':
      return C.warn;
    case 'banana-slice':
    case 'slice':
    case 'push-slice':
      return C.err;
    case 'block':
    case 'push':
    case 'pull':
      return C.sub;
  }
}

/**
 * Sorts club names by canonical bag order (Driver → Wedge).
 * Clubs not in BAG_ORDER go to the end, sorted alphabetically.
 */
export function sortByBagOrder(clubs: string[]): string[] {
  return [...clubs].sort((a, b) => {
    const ai = BAG_ORDER.indexOf(a);
    const bi = BAG_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}
