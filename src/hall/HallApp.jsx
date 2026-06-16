
import { HallProvider, useHall } from "./HallContext";
import HallLogin         from "./components/HallLogin";
import HallNavbar        from "./components/HallNavbar";
import HallNotification  from "./components/HallNotification";
import HallInvoice       from "./components/HallInvoice";
import HallCalendar      from "./components/HallCalendar";
import HallCRM           from "./components/HallCRM";
import HallCutlery       from "./components/HallCutlery";
import HallExpenses      from "./components/HallExpenses";
import HallInsights      from "./components/HallInsights";
import HallAdmin         from "./components/HallAdmin";
import "../styles/hall.css";
import ErrorBoundary from "../components/ErrorBoundary";

function HallInner({ onSwitchApp }) {
  const { curUser, activeTab } = useHall();

  if (!curUser) return <HallLogin onSwitchApp={onSwitchApp} />;

  return (
    <div id="hallApp" style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      <HallNavbar onSwitchApp={onSwitchApp} />
      <HallNotification />
      <main style={{ flex:1, overflowY:"auto" }}>
        {/* Tabs stay mounted (hidden via display:none) instead of unmounting on switch,
            so in-progress form data (e.g. a half-typed invoice) survives navigating away and back. */}
        <div style={{ display: activeTab === "invoice" ? "block" : "none" }}>
          <ErrorBoundary><HallInvoice /></ErrorBoundary>
        </div>
        <div style={{ display: activeTab === "calendar" ? "block" : "none" }}>
          <ErrorBoundary><HallCalendar /></ErrorBoundary>
        </div>
        <div style={{ display: activeTab === "crm" ? "block" : "none" }}>
          <ErrorBoundary><HallCRM /></ErrorBoundary>
        </div>
        <div style={{ display: activeTab === "cutlery" ? "block" : "none" }}>
          <ErrorBoundary><HallCutlery /></ErrorBoundary>
        </div>
        <div style={{ display: activeTab === "expenses" ? "block" : "none" }}>
          <ErrorBoundary><HallExpenses /></ErrorBoundary>
        </div>
        <div style={{ display: activeTab === "insights" ? "block" : "none" }}>
          <ErrorBoundary><HallInsights /></ErrorBoundary>
        </div>
        <div style={{ display: activeTab === "admin" ? "block" : "none" }}>
          <ErrorBoundary><HallAdmin /></ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export default function HallApp({ onSwitchApp }) {
  return (
    <HallProvider>
      <HallInner onSwitchApp={onSwitchApp} />
    </HallProvider>
  );
}
