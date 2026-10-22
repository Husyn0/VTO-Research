/**
 * PUBG-style overlay controls pinned to the bottom of the camera preview.
 *
 *  - Drag inside the preview area to move the product.
 *  - "+" / "-" change scale.
 *  - AUTO toggles distance-based automatic sizing.
 *  - RESET restores this product's saved defaults.
 *  - SAVE persists the current adjustments to localStorage.
 */
export default function ProductHUD({
  hasProduct,
  autoSize,
  onToggleAuto,
  onScaleDelta,
  onReset,
  onSave,
  headWidthPx,
  scale,
  showDebug,
  onToggleDebug,
}) {
  if (!hasProduct) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background:
          "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))",
        color: "#fff",
        fontSize: 13,
        pointerEvents: "auto",
      }}
    >
      <button
        onClick={() => onScaleDelta(-0.05)}
        title="Smaller"
        style={hudBtnStyle}
      >
        −
      </button>
      <span style={{ minWidth: 52, textAlign: "center", opacity: 0.9 }}>
        {scale.toFixed(2)}×
      </span>
      <button
        onClick={() => onScaleDelta(+0.05)}
        title="Bigger"
        style={hudBtnStyle}
      >
        +
      </button>

      <button
        onClick={onToggleAuto}
        title="Auto-size from face distance"
        style={{
          ...hudBtnStyle,
          background: autoSize ? "#22c55e" : "rgba(255,255,255,0.18)",
          color: autoSize ? "#000" : "#fff",
          padding: "6px 10px",
        }}
      >
        AUTO {autoSize ? "ON" : "OFF"}
      </button>

      <button onClick={onSave} title="Save this product's tuning" style={hudBtnStyle}>
        SAVE
      </button>
      <button onClick={onReset} title="Reset this product" style={hudBtnStyle}>
        RESET
      </button>

      <button
        onClick={onToggleDebug}
        title="Toggle anchor / bbox overlay"
        style={{
          ...hudBtnStyle,
          background: showDebug ? "#3b82f6" : "rgba(255,255,255,0.18)",
        }}
      >
        DBG
      </button>

      <span style={{ marginLeft: "auto", opacity: 0.75 }}>
        head≈{headWidthPx.toFixed(0)}px
      </span>
    </div>
  );
}

const hudBtnStyle = {
  background: "rgba(255,255,255,0.18)",
  border: "1px solid rgba(255,255,255,0.35)",
  color: "#fff",
  borderRadius: 6,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1.1,
};