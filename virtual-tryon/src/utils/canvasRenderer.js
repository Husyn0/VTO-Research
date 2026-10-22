/**
 * Canvas rendering for the 2D virtual try-on.
 *
 * Size:
 *   sizeMode = "auto"   -> drawWidth = headWidth × scale   (distance tracking)
 *   sizeMode = "manual" -> drawWidth = canvasWidth × 0.35 × scale
 *
 * Position:
 *   Attach-point = the pixel inside the PNG identified by
 *   productConfig.anchorX / anchorY (0..1). That point lands on
 *   (anchor.x, anchor.topY) on the canvas, shifted by
 *   productConfig.offsetX (× headWidth) and
 *   productConfig.offsetY (× headHeight).
 *
 * Drag-based tuning writes into productConfig.offsetX / offsetY directly.
 */
export function renderComposite(
  ctx,
  video,
  anchor,
  productImage,
  productConfig,
  mirrored,
  sizeMode = "auto"
) {
  const { width, height } = ctx.canvas;

  // 1. Mirrored video
  ctx.save();
  if (mirrored) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();

  if (!anchor || !productImage || !productConfig) return;
  const cfg = productConfig;

  const headWidthPx  = anchor.width  * width;
  const headHeightPx = anchor.height * height;

  // 2. Size depends on mode
  const baseWidthPx =
    sizeMode === "auto"
      ? headWidthPx
      : width * 0.35; // ~one-third of the canvas at scale=1

  const drawWidth = baseWidthPx * (cfg.scale ?? 1);

  const aspect =
    productImage.naturalHeight && productImage.naturalWidth
      ? productImage.naturalHeight / productImage.naturalWidth
      : productImage.height / productImage.width;
  const drawHeight = drawWidth * aspect;

  // 3. Attach point inside the PNG
  const imgAnchorX = (cfg.anchorX ?? 0.5) * drawWidth;
  const imgAnchorY = (cfg.anchorY ?? 0.5) * drawHeight;

  // 4. Anchor on the face
  const anchorPxX = (mirrored ? 1 - anchor.x : anchor.x) * width;
  const anchorPxY = anchor.topY * height;

  // 5. Per-product offsets (in head units)
  const offsetXPx = (cfg.offsetX ?? 0) * headWidthPx * (mirrored ? -1 : 1);
  const offsetYPx = (cfg.offsetY ?? 0) * headHeightPx;

  // 6. Rotation
  const rotation =
    (mirrored ? -anchor.roll : anchor.roll) + (cfg.rotationOffset ?? 0);

  // 7. Draw
  ctx.save();
  ctx.translate(anchorPxX + offsetXPx, anchorPxY + offsetYPx);
  ctx.rotate(rotation);
  ctx.drawImage(
    productImage,
    -imgAnchorX,
    -imgAnchorY,
    drawWidth,
    drawHeight
  );
  ctx.restore();
}

export function renderDebugAnchor(ctx, anchor, mirrored) {
  if (!anchor) return;
  const { width, height } = ctx.canvas;
  const cx = (mirrored ? 1 - anchor.x : anchor.x) * width;
  const cy = anchor.y * height;
  const hw = anchor.width * width;
  const topYPx = anchor.topY * height;
  const chinYPx = anchor.chinY * height;

  ctx.save();
  ctx.strokeStyle = "rgba(0,200,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - hw / 2, topYPx, hw, chinYPx - topYPx);

  ctx.strokeStyle = "rgba(255,140,0,0.9)";
  ctx.beginPath();
  ctx.moveTo(cx - hw / 2, topYPx);
  ctx.lineTo(cx + hw / 2, topYPx);
  ctx.stroke();

  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "yellow";
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(anchor.roll) * hw * 0.6, cy - Math.sin(anchor.roll) * hw * 0.6);
  ctx.lineTo(cx + Math.cos(anchor.roll) * hw * 0.6, cy + Math.sin(anchor.roll) * hw * 0.6);
  ctx.stroke();
  ctx.restore();
}

export function renderDebugLandmarks(ctx, landmarks, mirrored) {
  if (!landmarks || landmarks.length === 0) return;
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.fillStyle = "rgba(0,255,0,0.7)";
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const x = (mirrored ? 1 - lm.x : lm.x) * width;
    const y = lm.y * height;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}