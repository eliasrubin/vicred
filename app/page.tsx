import Link from "next/link";

export default function HomePage() {
  return (
    <main style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.logo}>VICRED</h1>
        <p style={styles.subtitle}>Tu crédito, claro y simple</p>
      </div>

      {/* Accesos */}
      <section style={styles.grid}>
        {/* Comercio */}
        <Link href="/login" style={styles.card}>
          <div style={styles.icon}>🏪</div>
          <h2 style={styles.cardTitle}>Comercio</h2>
          <p style={styles.cardText}>
            Acceso para vendedores y administradores.
          </p>
        </Link>

        {/* Clientes */}
        <Link href="/vicred/login" style={styles.card}>
          <div style={styles.icon}>👤</div>
          <h2 style={styles.cardTitle}>Clientes</h2>
          <p style={styles.cardText}>
            Consultá tu crédito, cuotas y pagos.
          </p>
        </Link>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F5F6F7",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "system-ui",
  },

  header: {
    textAlign: "center",
    marginBottom: 40,
  },

  logo: {
    margin: 0,
    fontSize: 36,
    fontWeight: 900,
    letterSpacing: 1,
    color: "#111",
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 24,
    width: "100%",
    maxWidth: 720,
  },

  card: {
    background: "white",
    borderRadius: 20,
    padding: 26,
    textDecoration: "none",
    color: "#111",
    border: "1px solid #E5E7EB",
    boxShadow: "0 14px 30px rgba(0,0,0,0.08)",
    transition: "all .2s ease",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },

  icon: {
    fontSize: 42,
    marginBottom: 12,
  },

  cardTitle: {
    margin: "8px 0 6px",
    fontSize: 20,
    fontWeight: 800,
  },

  cardText: {
    fontSize: 14,
    opacity: 0.75,
    lineHeight: 1.4,
  },
};
