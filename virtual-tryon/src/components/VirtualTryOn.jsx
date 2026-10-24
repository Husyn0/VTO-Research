import { useRef, useState, useEffect, useCallback } from "react";
import CameraPreview from "./CameraPreview";
import ProductGallery from "./ProductGallery";
import TrackingStatus from "./TrackingStatus";
import ProductHUD from "./ProductHUD";
import { products as builtInProducts } from "../data/products";
import { convertToTransparentPng } from "../services/productImageConverter";
import {
  deleteUserProduct,
  getUserProducts,
  saveUserProduct,
} from "../services/userProducts";
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
const DEFAULT_TUNING = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotationOffset: 0,
  sizeMode: "auto",
  showDebug: false,
};

// localStorage key prefix for saved per-product tuning
const STORAGE_PREFIX = "vto-tune:";

export default function VirtualTryOn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const renderLoopRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const smoothedAnchorRef = useRef(null);
  const productImageRef = useRef(null);
  const lastLandmarksRef = useRef(null);
  const productUrlsRef = useRef(new Map());

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("Camera off");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [snapshotUrl, setSnapshotUrl] = useState("");
  const [productImageReady, setProductImageReady] = useState(false);
  const [availableProducts, setAvailableProducts] = useState(builtInProducts);
  const [uploading, setUploading] = useState(false);

  // --- Adjustable live tuning state ---------------------------------
  // Kept in refs so the render loop reads them without re-render churn.
  const tuneRef = useRef(DEFAULT_TUNING);
  const [tuning, setTuning] = useState(DEFAULT_TUNING);
  const [headWidthPx, setHeadWidthPx] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    const productUrls = productUrlsRef.current;
    getUserProducts()
      .then((storedProducts) => {
        if (!isCurrent) return;
        const restoredProducts = storedProducts.map((product) => {
          const image = URL.createObjectURL(product.imageBlob);
          productUrls.set(product.id, image);
          return { ...product, image };
        });
        setAvailableProducts((previous) => {
          const existingIds = new Set(previous.map((product) => product.id));
          return [
            ...previous,
            ...restoredProducts.filter((product) => !existingIds.has(product.id)),
          ];
        });
      })
      .catch((storageError) => {
        if (!isCurrent) return;
        console.error("Unable to load locally saved products.", storageError);
        setError("Could not load saved products from this browser.");
      });

    return () => {
      isCurrent = false;
      for (const imageUrl of productUrls.values()) {
        URL.revokeObjectURL(imageUrl);
      }
      productUrls.clear();
    };
  }, []);

  // --- Load product, apply saved tune or defaults -------------------
  useEffect(() => {
    if (!selectedProduct) {
      productImageRef.current = null;
      return;
    }
    let isCurrentProduct = true;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!isCurrentProduct) return;
      productImageRef.current = img;
      setProductImageReady(true);
    };
    img.onerror = () => {
      if (!isCurrentProduct) return;
      productImageRef.current = null;
      setProductImageReady(false);
      setError(
        `Could not load ${selectedProduct.name}. Try adding the image again.`
      );
    };
    img.src = selectedProduct.image;
    return () => {
      isCurrentProduct = false;
    };
  }, [selectedProduct]);

  // --- Camera lifecycle ---------------------------------------------
  const stopEverything = useCallback(
    (nextStatus = "idle", nextMessage = "Camera stopped") => {
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
      setHeadWidthPx(0);
      setStatus(nextStatus);
      setStatusMessage(nextMessage);
    },
    []
  );

  const updateTuning = (update, productId = selectedProduct?.id) => {
    const next =
      typeof update === "function" ? update(tuneRef.current) : update;
    tuneRef.current = next;
    setTuning(next);
    if (productId) {
      try {
        localStorage.setItem(
          STORAGE_PREFIX + productId,
          JSON.stringify({
            scale: next.scale,
            offsetX: next.offsetX,
            offsetY: next.offsetY,
            rotationOffset: next.rotationOffset,
            sizeMode: next.sizeMode,
          })
        );
        setError("");
      } catch (storageError) {
        console.error("Unable to save product adjustments.", storageError);
        setError("Could not save these adjustments in this browser.");
      }
    }
  };

  const selectProduct = (product) => {
    if (product) {
      const stored = (() => {
        try {
          const raw = localStorage.getItem(STORAGE_PREFIX + product.id);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();
      updateTuning({
        scale: stored?.scale ?? product.scale ?? 1,
        offsetX: stored?.offsetX ?? product.offsetX ?? 0,
        offsetY: stored?.offsetY ?? product.offsetY ?? 0,
        rotationOffset: stored?.rotationOffset ?? product.rotationOffset ?? 0,
        sizeMode: stored?.sizeMode ?? "auto",
        showDebug: tuneRef.current.showDebug,
      }, product.id);
    }
    setProductImageReady(false);
    setSelectedProduct(product);
  };

  const addProduct = async (file, category) => {
    setUploading(true);
    setError("");
    try {
      const imageBlob = await convertToTransparentPng(file);
      const fileName =
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9-_ ]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 60) || "custom-object";
      const name = file.name.replace(/\.[^.]+$/, "").trim() || "Custom object";
      const id = `uploaded-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const defaults =
        category === "hat"
          ? { scale: 1.15, offsetX: 0, offsetY: -0.05, anchorX: 0.5, anchorY: 0.95 }
          : { scale: 1.45, offsetX: 0, offsetY: 0.15, anchorX: 0.5, anchorY: 0.35 };
      const storedProduct = {
        id,
        name,
        fileName,
        category,
        imageBlob,
        userUploaded: true,
        ...defaults,
        rotationOffset: 0,
      };
      await saveUserProduct(storedProduct);
      const product = {
        ...storedProduct,
        image: URL.createObjectURL(imageBlob),
      };
      productUrlsRef.current.set(id, product.image);
      setAvailableProducts((previous) => [...previous, product]);
      selectProduct(product);
    } catch (uploadError) {
      console.error("Unable to add the uploaded product.", uploadError);
      setError(uploadError.message || "Could not convert and save this image.");
    } finally {
      setUploading(false);
    }
  };

  const removeProduct = async (product) => {
    try {
      await deleteUserProduct(product.id);
      const imageUrl = productUrlsRef.current.get(product.id);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      productUrlsRef.current.delete(product.id);
      setAvailableProducts((previous) =>
        previous.filter((item) => item.id !== product.id)
      );
      try {
        localStorage.removeItem(STORAGE_PREFIX + product.id);
      } catch (storageError) {
        console.error("Unable to clear removed product adjustments.", storageError);
      }
      if (selectedProduct?.id === product.id) {
        setProductImageReady(false);
        setSelectedProduct(null);
      }
    } catch (storageError) {
      console.error("Unable to remove the saved product.", storageError);
      setError("Could not remove this product from browser storage.");
    }
  };

  // --- Render loop ---------------------------------------------------
  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !running) return;

    const ctx = canvas.getContext("2d");
    const now = performance.now();

    if (video.currentTime === lastVideoTimeRef.current) {
      rafRef.current = requestAnimationFrame(() => renderLoopRef.current?.());
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
      smoothedAnchorRef.current = null;
      lastLandmarksRef.current = null;
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

    rafRef.current = requestAnimationFrame(() => renderLoopRef.current?.());
  }, [running, selectedProduct]);

  useEffect(() => {
    renderLoopRef.current = renderLoop;
  }, [renderLoop]);

  const startCamera = async () => {
    if (running) return;
    setError("");
    setLoading(true);
    setStatus("loading");
    setStatusMessage("Loading face model…");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access requires HTTPS or localhost.");
      }
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
      if (!video) throw new Error("Camera preview is unavailable.");
      video.srcObject = stream;
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise((resolve, reject) => {
          video.addEventListener("loadedmetadata", resolve, { once: true });
          video.addEventListener("error", reject, { once: true });
        });
      }
      await video.play();
      setRunning(true);
      setLoading(false);
      setStatus("noface");
      setStatusMessage("Waiting for a face");
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
      stopEverything("error", "Failed to start");
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
    if (!selectedProduct || e.target.closest("button")) return;
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
    updateTuning((previous) => ({
      ...previous,
      offsetX: d.origX - dxPx / headWidthPx,
      offsetY: d.origY + dyPx / headHeightPx,
    }));
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  // --- HUD actions ---------------------------------------------------
  const onScaleChange = (scale) => {
    updateTuning((previous) => ({
      ...previous,
      scale,
    }));
  };
  const onOffsetChange = (key, value) => {
    updateTuning((previous) => ({
      ...previous,
      [key]: value,
    }));
  };
  const onRotationChange = (rotationOffset) => {
    updateTuning((previous) => ({
      ...previous,
      rotationOffset,
    }));
  };
  const onToggleAuto = () => {
    updateTuning((previous) => ({
      ...previous,
      sizeMode: previous.sizeMode === "auto" ? "manual" : "auto",
    }));
  };
  const onToggleDebug = () => {
    updateTuning((previous) => ({
      ...previous,
      showDebug: !previous.showDebug,
    }));
  };
  const onReset = () => {
    if (!selectedProduct) return;
    const defaults = {
      scale: selectedProduct.scale ?? 1,
      offsetX: selectedProduct.offsetX ?? 0,
      offsetY: selectedProduct.offsetY ?? 0,
      rotationOffset: selectedProduct.rotationOffset ?? 0,
      sizeMode: "auto",
      showDebug: tuneRef.current.showDebug,
    };
    updateTuning(defaults);
    try {
      localStorage.removeItem(STORAGE_PREFIX + selectedProduct.id);
    } catch (storageError) {
      console.error("Unable to reset product adjustments.", storageError);
      setError("Could not reset saved adjustments in this browser.");
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
        Select a product and start your camera. Drag the object on the preview,
        or use the zoom and centering controls below it. Each item saves its
        adjustments separately.
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
          </div>
          <ProductHUD
            hasProduct={!!selectedProduct && productImageReady}
            productName={selectedProduct?.name}
            autoSize={tuning.sizeMode === "auto"}
            onToggleAuto={onToggleAuto}
            onScaleChange={onScaleChange}
            onOffsetChange={onOffsetChange}
            onRotationChange={onRotationChange}
            onReset={onReset}
            headWidthPx={headWidthPx}
            scale={tuning.scale}
            offsetX={tuning.offsetX}
            offsetY={tuning.offsetY}
            rotationOffset={tuning.rotationOffset}
            showDebug={tuning.showDebug}
            onToggleDebug={onToggleDebug}
          />

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
            products={availableProducts}
            selectedId={selectedProduct?.id}
            onSelect={selectProduct}
            onAddProduct={addProduct}
            onDeleteProduct={removeProduct}
            uploading={uploading}
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