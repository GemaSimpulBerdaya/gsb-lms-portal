export default function AdminPage() {
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#c0392b" }}>Super Admin Portal</h1>
      <p style={{ color: "#666", marginTop: "12px" }}>
        Manajemen Relawan, Konten Modul, dan Laporan Agregat GSB.
      </p>
      <div style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
        {["Manajemen Relawan", "Konten Modul", "Monitoring Sistem"].map(item => (
          <div key={item} style={{ padding: "20px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: "12px", fontWeight: "600" }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
