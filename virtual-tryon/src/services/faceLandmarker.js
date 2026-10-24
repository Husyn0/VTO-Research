import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarker = null;
let landmarkerPromise = null;

export async function createFaceLandmarker() {
  if (landmarker) return landmarker;
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm"
    );

    const options = {
      baseOptions: { modelAssetPath: "/models/face_landmarker.task" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    };

    try {
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "GPU" },
      });
    } catch (gpuError) {
      console.warn("GPU face tracking unavailable; retrying with CPU.", gpuError);
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" },
      });
    }

    return landmarker;
  })();

  try {
    return await landmarkerPromise;
  } catch (error) {
    landmarkerPromise = null;
    throw error;
  }
}

export function detectForVideo(video, timestampMs) {
  if (!landmarker) return null;
  return landmarker.detectForVideo(video, timestampMs);
}

export function closeFaceLandmarker() {
  if (landmarker) {
    landmarker.close();
    landmarker = null;
  }
  landmarkerPromise = null;
}