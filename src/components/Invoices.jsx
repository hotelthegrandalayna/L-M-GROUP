// Top-level Invoices tab — admin only.
// Deliberately reuses the proven AdminInvoices screen (view / edit / search /
// month / room / date range / status / PDF / Excel / duplicate finder) rather than
// re-implementing it, so no existing invoice behaviour changes.
import { useApp } from "../context/AppContext";
import AdminInvoices from "./Admin/AdminInvoices";

export default function Invoices() {
  const { curRole } = useApp();

  if (curRole !== "admin") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
        <i className="ti ti-lock" style={{ fontSize: 40, display: "block", marginBottom: 12 }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>Access restricted</div>
        <div style={{ fontSize: 13 }}>Invoices are only available to administrators.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "22px 24px", margin: "0 auto", overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <AdminInvoices />
    </div>
  );
}
