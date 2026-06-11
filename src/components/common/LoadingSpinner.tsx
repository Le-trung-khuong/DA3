export const LoadingSpinner = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
    <div style={{
      width: 48,
      height: 48,
      borderRadius: "50%",
      border: "2px solid rgba(108,99,255,0.2)",
      borderTopColor: "#6C63FF",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);