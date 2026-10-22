import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarker = null;

export async function createFaceLandmarker() {
  if (landmarker) return landmarker;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });

  return landmarker;
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
}