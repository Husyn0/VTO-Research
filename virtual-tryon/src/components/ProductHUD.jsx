export default function ProductHUD({
  hasProduct,
  productName,
  autoSize,
  onToggleAuto,
  onScaleChange,
  onOffsetChange,
  onReset,
  headWidthPx,
  scale,
  offsetX,
  offsetY,
  showDebug,
  onToggleDebug,
}) {
  if (!hasProduct) return null;

  return (
    <section
      data-no-drag
      aria-label={`Adjust ${productName}`}
      style={{
        marginTop: 12,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <strong>Adjust {productName}</strong>
          <div style={{ color: "#666", fontSize: 12, marginTop: 3 }}>
            Changes save automatically for this item.
          </div>
        </div>
        <button onClick={onReset} type="button" style={buttonStyle}>
          Reset
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <label style={controlStyle}>
          <span>
            Zoom <strong>{scale.toFixed(2)}×</strong>
          </span>
          <input
            aria-label={`${productName} zoom`}
            type="range"
            min="0.25"
            max="3"
            step="0.01"
            value={scale}
            onChange={(event) => onScaleChange(Number(event.target.value))}
          />
        </label>

        <label style={controlStyle}>
          <span>
            Center left / right <strong>{offsetX.toFixed(2)}</strong>
          </span>
          <input
            aria-label={`${productName} horizontal center`}
            type="range"
            min="-0.75"
            max="0.75"
            step="0.01"
            value={offsetX}
            onChange={(event) => onOffsetChange("offsetX", Number(event.target.value))}
          />
        </label>

        <label style={controlStyle}>
          <span>
            Center up / down <strong>{offsetY.toFixed(2)}</strong>
          </span>
          <input
            aria-label={`${productName} vertical center`}
            type="range"
            min="-0.75"
            max="0.75"
            step="0.01"
            value={offsetY}
            onChange={(event) => onOffsetChange("offsetY", Number(event.target.value))}
          />
        </label>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginTop: 14,
        }}
      >
        <button
          onClick={onToggleAuto}
          type="button"
          aria-pressed={autoSize}
          style={{
            ...buttonStyle,
            background: autoSize ? "#dcfce7" : "#f3f4f6",
          }}
        >
          Auto-size {autoSize ? "on" : "off"}
        </button>
        <button
          onClick={onToggleDebug}
          type="button"
          aria-pressed={showDebug}
          style={{
            ...buttonStyle,
            background: showDebug ? "#dbeafe" : "#f3f4f6",
          }}
        >
          Face guide {showDebug ? "on" : "off"}
        </button>
        <span style={{ color: "#666", fontSize: 12, marginLeft: "auto" }}>
          Detected face width: {headWidthPx.toFixed(0)} px
        </span>
      </div>
    </section>
  );
}

const controlStyle = {
  display: "grid",
  gap: 5,
  fontSize: 13,
};

const buttonStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 7,
  padding: "7px 10px",
  background: "#f3f4f6",
  color: "#1a1a1a",
  cursor: "pointer",
};
