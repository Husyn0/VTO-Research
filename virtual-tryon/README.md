# Face-Based Virtual Try-On

This application demonstrates a browser-based virtual try-on (VTO) workflow
for placing 2D hats and hijabs on a live selfie-camera preview. It uses face
landmarks to estimate the position, size, and roll of the head, then draws a
transparent product image over the video using a 2D canvas.

This is an image-overlay method, not 3D reconstruction or garment simulation.
The current catalog contains hats and hijabs; it does not track shoulders or
the torso, so it does not fit shirts or other body-worn clothing.

## How the VTO method works

1. **Initialize face tracking.** The app creates a MediaPipe Face Landmarker in
   video mode and requests one face. It tries the GPU delegate first and falls
   back to CPU if GPU initialization fails. The model file is bundled at
   `public/models/face_landmarker.task`; the MediaPipe WebAssembly runtime is
   loaded from jsDelivr.
2. **Read camera frames.** The browser provides video through
   `getUserMedia`. Each new video frame is passed to the landmarker. Camera
   access requires `localhost` or an HTTPS origin.
3. **Calculate a head anchor.** Selected face landmarks are used to estimate:
   - center between the outer eye landmarks (`33` and `263`);
   - forehead top (`10`) and chin (`152`) for vertical position and face height;
   - cheek span (`234` to `454`) and outer-eye distance for head width; and
   - eye-line angle for head roll.

   The estimated head width is the larger of cheek span and three times the
   outer-eye distance. This is a practical 2D sizing heuristic, not a
   measurement of actual head dimensions.
4. **Smooth the tracking result.** The current anchor is blended with the
   previous frame to reduce jitter. Roll is interpolated across the shortest
   angular distance so it does not jump when the angle crosses the
   `-π`/`π` boundary.
5. **Render the product image.** The camera frame is drawn to the canvas in
   mirrored selfie orientation. The selected transparent PNG is sized from
   the estimated head width in auto mode, or from canvas width in manual mode.
   Its configured attachment point is placed at the forehead anchor, adjusted
   by per-item offsets, and rotated with the head roll.
6. **Composite the preview.** The transformed product PNG is drawn over the
   video frame. When face tracking is lost, the app continues showing the
   camera image without placing an overlay.

## Product assets and fit configuration

The built-in product images are transparent PNGs in `public/products/`, and
their default fit is configured in `src/data/products.js`:

| Setting | Meaning |
| --- | --- |
| `scale` | Multiplier applied to the auto- or manual-mode image width |
| `offsetX` | Horizontal adjustment in estimated head-width units |
| `offsetY` | Vertical adjustment in forehead-to-chin height units |
| `anchorX`, `anchorY` | Normalized attachment point within the product image |
| `rotationOffset` | Per-item rotation correction, in radians |

The gallery also lets users add their own hat or hijab image. The browser
decodes the selected image, removes pixels within a 10% color-distance
threshold of white, and encodes the result as a PNG. The converted image and
product settings are stored in IndexedDB and added to the gallery immediately.
Uploaded products can be downloaded as `.png` files or removed from the
browser's saved list. Browser-only storage does not write files into the
project's `public/products/` directory and is not shared across browsers or
devices.

The preview adjustment panel provides zoom and horizontal/vertical centering
sliders. Dragging on the preview also repositions the selected item. Every
adjustment is saved in browser `localStorage` under a key containing that
product's ID, so each hat or hijab keeps its own fit. Reset restores the
product defaults.

Debug mode draws the estimated head box, anchor, roll direction, and detected
face landmarks to help diagnose alignment.

## Data flow and privacy

Face tracking and canvas compositing run in the browser. This application contains no code that uploads the camera
stream or selected product images to an application server. The model is
served from the app's public assets, while the MediaPipe WebAssembly runtime
is fetched from jsDelivr. Uploaded products are kept in IndexedDB and fit
preferences are kept in localStorage in the current browser.

## Run locally

From the `virtual-tryon` directory:

```bash
npm install
npm run dev
```

Open the local Vite URL, allow camera access, choose a product, and start the
camera. To check the application:

```bash
npm run lint
npm run build
```

## Current scope and limitations

- Tracks at most one face.
- Uses a 2D PNG overlay; it does not model depth, occlusion, or 3D head pose.
- Results depend on the transparent image's crop, attachment-point settings,
  camera framing, and user adjustment.
- Large head turns, occlusion, poor lighting, or an obscured face can reduce
  tracking or overlay accuracy.
- Clothing try-on requires garment assets and body/pose tracking, which are
  not part of the current feature.
