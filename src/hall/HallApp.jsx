
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
        <ErrorBoundary key={activeTab}>
          {activeTab === "invoice"  && <HallInvoice  />}
          {activeTab === "calendar" && <HallCalendar />}
          {activeTab === "crm"      && <HallCRM      />}
          {activeTab === "cutlery"  && <HallCutlery  />}
          {activeTab === "expenses" && <HallExpenses />}
          {activeTab === "insights" && <HallInsights />}
          {activeTab === "admin"    && <HallAdmin    />}
        </ErrorBoundary>
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
