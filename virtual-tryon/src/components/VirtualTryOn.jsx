import { useRef, useState, useEffect, useCallback } from "react";
import CameraPreview from "./CameraPreview";
import ProductGallery from "./ProductGallery";
import TrackingStatus from "./TrackingStatus";
import ProductHUD from "./ProductHUD";
import {
  createFaceLandmarker,
  detectForVideo,
  closeFaceLandmarker,
} from "../services/faceLandmarker";
import { computeHeadAnchor, smoothAnchor } from "../utils/faceGeometry";
import {
  renderComposite,
  renderDebugAnchor,
  renderDebugLandmarks,
} from "../utils/canvasRenderer";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

// localStorage key prefix for saved per-product tuning
const STORAGE_PREFIX = "vto-tune:";

export default function VirtualTryOn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const smoothedAnchorRef = useRef(null);
  const productImageRef = useRef(null);
  const lastLandmarksRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("Camera off");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [snapshotUrl, setSnapshotUrl] = useState("");
  const [productImageReady, setProductImageReady] = useState(false);

  // --- Adjustable live tuning state ---------------------------------
  // Kept in refs so the render loop reads them without re-render churn.
  const tuneRef = useRef({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotationOffset: 0,
    sizeMode: "auto", // "auto" | "manual"
    showDebug: false,
  });
  const [hudTick, setHudTick] = useState(0); // forces HUD re-render
  const [headWidthPx, setHeadWidthPx] = useState(0);

  // --- Load product, apply saved tune or defaults -------------------
  useEffect(() => {
    if (!selectedProduct) {
      productImageRef.current = null;
      setProductImageReady(false);
      return;
    }

    // Apply stored tune if present, else the product defaults
    const stored = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + selectedProduct.id);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    tuneRef.current = {
      scale: stored?.scale ?? selectedProduct.scale ?? 1,
      offsetX: stored?.offsetX ?? selectedProduct.offsetX ?? 0,
      offsetY: stored?.offsetY ?? selectedProduct.offsetY ?? 0,
      rotationOffset:
        stored?.rotationOffset ?? selectedProduct.rotationOffset ?? 0,
      sizeMode: stored?.sizeMode ?? "auto",
      showDebug: tuneRef.current.showDebug,
    };
    setHudTick((t) => t + 1);

    setProductImageReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      productImageRef.current = img;
      setProductImageReady(true);
    };
    img.onerror = () => {
      productImageRef.current = null;
      setProductImageReady(false);
      setError(
        `Failed to load product image: ${selectedProduct.image}. Place a transparent PNG in public/products/.`
      );
    };
    img.src = selectedProduct.image;
  }, [selectedProduct]);

  // --- Camera lifecycle ---------------------------------------------
  const stopEverything = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    smoothedAnchorRef.current = null;
    lastLandmarksRef.current = null;
    lastVideoTimeRef.current = -1;
    setRunning(false);
    setStatus("idle");
    setStatusMessage("Camera stopped");
  }, []);

  // --- Render loop ---------------------------------------------------
  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !running) return;

    const ctx = canvas.getContext("2d");
    const now = performance.now();

    if (video.currentTime === lastVideoTimeRef.current) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    lastVideoTimeRef.current = video.currentTime;

    let anchor = null;
    try {
      const result = detectForVideo(video, now);
      if (result?.faceLandmarks?.length > 0) {
        lastLandmarksRef.current = result.faceLandmarks[0];
        const raw = computeHeadAnchor(result.faceLandmarks[0]);
        if (raw) {
          anchor = smoothAnchor(smoothedAnchorRef.current, raw);
          smoothedAnchorRef.current = anchor;
          setStatus("tracking");
          setStatusMessage("Face detected");
          // Push head width to HUD (throttled by value change)
          const hwPx = raw.width * canvas.width;
          setHeadWidthPx((prev) =>
            Math.abs(prev - hwPx) > 2 ? hwPx : prev
          );
        } else {
          setStatus("noface");
          setStatusMessage("Face partially detected");
        }
      } else {
        lastLandmarksRef.current = null;
        smoothedAnchorRef.current = null;
        setStatus("noface");
        setStatusMessage("No face detected");
      }
    } catch (e) {
      console.error(e);
      setStatus("error");
      setStatusMessage("Detection error");
    }

    const t = tuneRef.current;
    const productCfg = selectedProduct
      ? {
          ...selectedProduct,
          scale: t.scale,
          offsetX: t.offsetX,
          offsetY: t.offsetY,
          rotationOffset: t.rotationOffset,
        }
      : null;

    renderComposite(
      ctx,
      video,
      anchor,
      productImageRef.current,
      productCfg,
      true,
      t.sizeMode
    );

    if (t.showDebug) {
      renderDebugAnchor(ctx, anchor, true);
      renderDebugLandmarks(ctx, lastLandmarksRef.current, true);
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [running, selectedProduct]);

  const startCamera = async () => {
    if (running) return;
    setError("");
    setLoading(true);
    setStatus("loading");
    setStatusMessage("Loading face model…");

    try {
      await createFaceLandmarker();
      setStatusMessage("Requesting camera…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror = rej;
      });
      await video.play();
      setRunning(true);
      setLoading(false);
      setStatus("tracking");
      setStatusMessage("Face detection active");
    } catch (err) {
      console.error(err);
      setLoading(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Camera permission denied.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found.");
      } else {
        setError(`Failed to start: ${err.message || err.name}`);
      }
      setStatus("error");
      setStatusMessage("Failed to start");
      stopEverything();
    }
  };

  useEffect(() => {
    if (running && !rafRef.current) {
      rafRef.current = requestAnimationFrame(renderLoop);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [running, renderLoop]);

  useEffect(() => {
    return () => {
      stopEverything();
      closeFaceLandmarker();
    };
  }, [stopEverything]);

  // --- Drag-to-move (mouse + touch) ---------------------------------
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const onPointerDown = (e) => {
    if (!selectedProduct) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: tuneRef.current.offsetX,
      origY: tuneRef.current.offsetY,
      rect,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;

    // Convert screen delta to normalized head units
    const rect = d.rect;
    const canvasW = rect.width;
    const canvasH = rect.height;

    const headWidthPx = Math.max(1, smoothedAnchorRef.current?.width * CANVAS_WIDTH);
    const headHeightPx = Math.max(1, smoothedAnchorRef.current?.height * CANVAS_HEIGHT);

    // Screen delta -> canvas delta (account for CSS scaling)
    const scaleX = CANVAS_WIDTH / canvasW;
    const scaleY = CANVAS_HEIGHT / canvasH;

    const dxPx = (e.clientX - d.startX) * scaleX;
    const dyPx = (e.clientY - d.startY) * scaleY;

    // Mirror the horizontal drag so it feels natural in the selfie view
    tuneRef.current.offsetX = d.origX + dxPx / headWidthPx;
    tuneRef.current.offsetY = d.origY + dyPx / headHeightPx;
    setHudTick((t) => t + 1);
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  // --- HUD actions ---------------------------------------------------
  const onScaleDelta = (delta) => {
    tuneRef.current.scale = Math.max(0.1, tuneRef.current.scale + delta);
    setHudTick((t) => t + 1);
  };
  const onToggleAuto = () => {
    tuneRef.current.sizeMode =
      tuneRef.current.sizeMode === "auto" ? "manual" : "auto";
    setHudTick((t) => t + 1);
  };
  const onToggleDebug = () => {
    tuneRef.current.showDebug = !tuneRef.current.showDebug;
    setHudTick((t) => t + 1);
  };
  const onReset = () => {
    if (!selectedProduct) return;
    tuneRef.current = {
      scale: selectedProduct.scale ?? 1,
      offsetX: selectedProduct.offsetX ?? 0,
      offsetY: selectedProduct.offsetY ?? 0,
      rotationOffset: selectedProduct.rotationOffset ?? 0,
      sizeMode: "auto",
      showDebug: tuneRef.current.showDebug,
    };
    localStorage.removeItem(STORAGE_PREFIX + selectedProduct.id);
    setHudTick((t) => t + 1);
  };
  const onSave = () => {
    if (!selectedProduct) return;
    const t = tuneRef.current;
    try {
      localStorage.setItem(
        STORAGE_PREFIX + selectedProduct.id,
        JSON.stringify({
          scale: t.scale,
          offsetX: t.offsetX,
          offsetY: t.offsetY,
          rotationOffset: t.rotationOffset,
          sizeMode: t.sizeMode,
        })
      );
    } catch {
      /* ignore quota errors */
    }
  };

  // --- Snapshot ------------------------------------------------------
  const captureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSnapshotUrl(canvas.toDataURL("image/png"));
  };
  const downloadSnapshot = () => {
    if (!snapshotUrl) return;
    const a = document.createElement("a");
    a.href = snapshotUrl;
    a.download = `tryon-${selectedProduct?.id || "snapshot"}.png`;
    a.click();
  };

  // --- Render --------------------------------------------------------
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 4 }}>Virtual Try-On</h1>
      <p style={{ color: "#666", marginTop: 0, fontSize: 14 }}>
        Select a product, start your camera. Drag inside the preview to
        reposition it, use ± to resize.
      </p>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 400px" }}>
          {/* Preview with drag + HUD overlay */}
          <div
            ref={wrapRef}
            style={{ position: "relative" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <CameraPreview
              videoRef={videoRef}
              canvasRef={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
            />
            <ProductHUD
              hasProduct={!!selectedProduct && productImageReady}
              autoSize={tuneRef.current.sizeMode === "auto"}
              onToggleAuto={onToggleAuto}
              onScaleDelta={onScaleDelta}
              onReset={onReset}
              onSave={onSave}
              headWidthPx={headWidthPx}
              scale={tuneRef.current.scale}
              showDebug={tuneRef.current.showDebug}
              onToggleDebug={onToggleDebug}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              onClick={startCamera}
              disabled={running || loading}
              style={{
                padding: "10px 20px",
                background: running ? "#ccc" : "#1a1a1a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: running || loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {loading ? "Starting…" : "Start Camera"}
            </button>
            <button
              onClick={stopEverything}
              disabled={!running}
              style={{
                padding: "10px 20px",
                background: "#fff",
                color: "#1a1a1a",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: running ? "pointer" : "not-allowed",
                fontWeight: 600,
              }}
            >
              Stop Camera
            </button>
            <button
              onClick={captureSnapshot}
              disabled={!running}
              style={{
                padding: "10px 20px",
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: running ? "pointer" : "not-allowed",
              }}
            >
              Capture Photo
            </button>
            <button
              onClick={downloadSnapshot}
              disabled={!snapshotUrl}
              style={{
                padding: "10px 20px",
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: snapshotUrl ? "pointer" : "not-allowed",
              }}
            >
              Download Snapshot
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <TrackingStatus status={status} message={statusMessage} />
          </div>

          {selectedProduct && (
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Selected: <strong>{selectedProduct.name}</strong>
              {!productImageReady && " (image not loaded)"}
            </p>
          )}
          {!selectedProduct && (
            <p style={{ marginTop: 8, fontSize: 14, color: "#999" }}>
              Select a product below to see it on your head.
            </p>
          )}
        </div>

        <div style={{ flex: "0 0 260px" }}>
          <h3 style={{ marginTop: 0 }}>Products</h3>
          <ProductGallery
            selectedId={selectedProduct?.id}
            onSelect={setSelectedProduct}
          />
        </div>
      </div>

      {snapshotUrl && (
        <div style={{ marginTop: 20 }}>
          <h3>Snapshot Preview</h3>
          <img
            src={snapshotUrl}
            alt="Try-on snapshot"
            style={{
              maxWidth: "100%",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          />
        </div>
      )}
    </div>
  );
}