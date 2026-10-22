import { forwardRef } from "react";

const CameraPreview = forwardRef(function CameraPreview(
  { videoRef, canvasRef, width, height },
  ref
) {
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 640,
        aspectRatio: "4 / 3",
        background: "#000",
        borderRadius: 12,
        overflow: "hidden",
        touchAction: "none",       // prevent page scroll while dragging
        userSelect: "none",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "grab",
        }}
      />
    </div>
  );
});

export default CameraPreview;