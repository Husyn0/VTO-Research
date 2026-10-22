/**
 * MediaPipe Face Mesh landmark indices (468 points).
 *
 * Eye-distance is a very stable metric but it is only ~0.11 of the
 * video width, which makes it a poor direct overlay-size reference.
 * The classical anthropometric rule says a human head is about four
 * eye-widths wide. We use that to derive a "head width" that maps
 * naturally to "how wide should the hat be".
 */
const TOP_FOREHEAD = 10;
const BROW_CENTER = 151;
const CHIN = 152;
const RIGHT_EYE_OUTER = 33;
const LEFT_EYE_OUTER = 263;
const RIGHT_CHEEK = 234;
const LEFT_CHEEK = 454;
const NOSE_TIP = 1;

// Anthropometric constant: head width ≈ 4 × inter-outer-eye distance.
const HEAD_WIDTH_FACTOR = 3.0;

export function computeHeadAnchor(landmarks) {
  if (!landmarks || landmarks.length < 468) return null;

  const top = landmarks[TOP_FOREHEAD];
  const brow = landmarks[BROW_CENTER];
  const chin = landmarks[CHIN];
  const rightEye = landmarks[RIGHT_EYE_OUTER];
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightCheek = landmarks[RIGHT_CHEEK];
  const leftCheek = landmarks[LEFT_CHEEK];
  const nose = landmarks[NOSE_TIP];

  if (
    !top || !brow || !chin ||
    !rightEye || !leftEye ||
    !rightCheek || !leftCheek || !nose
  ) {
    return null;
  }

  const eyeDx = leftEye.x - rightEye.x;
  const eyeDy = leftEye.y - rightEye.y;
  const eyeDistance = Math.sqrt(eyeDx * eyeDx + eyeDy * eyeDy);

  const cheekDx = leftCheek.x - rightCheek.x;
  const cheekDy = leftCheek.y - rightCheek.y;
  const cheekWidth = Math.sqrt(cheekDx * cheekDx + cheekDy * cheekDy);

  // Head width: prefer the larger of (4× eye distance, cheek span).
  // Both are stable; this just avoids underestimating.
  const headWidth = Math.max(eyeDistance * HEAD_WIDTH_FACTOR, cheekWidth);

  // Head height: forehead top -> chin
  const headHeight = Math.abs(chin.y - top.y);

  const roll = Math.atan2(eyeDy, eyeDx);

  const anchorX = (rightEye.x + leftEye.x) / 2;
  const anchorY = (top.y + chin.y) / 2;

  return {
    x: anchorX,
    y: anchorY,
    width: headWidth,       // now literally "head width", not eye width
    height: headHeight,
    eyeDistance,            // kept for callers who want it
    roll,
    topY: top.y,
    browY: brow.y,
    chinY: chin.y,
  };
}

export function smoothAnchor(previous, current, alpha = 0.35) {
  if (!previous) return { ...current };
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    width: previous.width + (current.width - previous.width) * alpha,
    height: previous.height + (current.height - previous.height) * alpha,
    eyeDistance: previous.eyeDistance +
      (current.eyeDistance - previous.eyeDistance) * alpha,
    roll: previous.roll + (current.roll - previous.roll) * alpha,
    topY: previous.topY + (current.topY - previous.topY) * alpha,
    browY: previous.browY + (current.browY - previous.browY) * alpha,
    chinY: previous.chinY + (current.chinY - previous.chinY) * alpha,
  };
}