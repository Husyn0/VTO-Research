export default function TrackingStatus({ status, message }) {
  const colors = {
    idle: "#888",
    loading: "#f59e0b",
    tracking: "#22c55e",
    error: "#ef4444",
    noface: "#f59e0b",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: colors[status] || "#888",
          display: "inline-block",
        }}
      />
      <span>{message}</span>
    </div>
  );
}