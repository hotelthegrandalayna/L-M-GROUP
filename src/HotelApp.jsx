
import { AppProvider, useApp } from "./context/AppContext";
import Login        from "./components/Login";
import Navbar       from "./components/Navbar";
import Notification from "./components/Notification";
import Desk         from "./components/Desk";
// NOTE: components/Bookings.jsx stays — the front desk imports the booking form
// (NewBookingModal / InvoicePreviewModal) from it. Only the tab is removed.
import Invoices     from "./components/Invoices";
import Accounts     from "./components/Accounts";
import Expenses     from "./components/Expenses";
import Tasks        from "./components/Tasks";
import TaskReminderPopup from "./components/TaskReminderPopup";
import CRM          from "./components/CRM";
import Insights     from "./components/Insights";
import Marketing    from "./components/Marketing";
import AdminPanel   from "./components/Admin/AdminPanel";
import ErrorBoundary from "./components/ErrorBoundary";

function HotelInner({ onSwitchApp }) {
  const { curUser, activeTab } = useApp();

  if (!curUser) return <Login onSwitchApp={onSwitchApp} />;

  return (
    <div id="hotelApp" style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      <Navbar onSwitchApp={onSwitchApp} />
      <Notification />
      <TaskReminderPopup />
      <main style={{ flex:1, overflowY:"auto" }}>
        <ErrorBoundary key={activeTab}>
          {activeTab === "desk"      && <Desk      />}
          {activeTab === "invoices"  && <Invoices  />}
          {activeTab === "accounts"  && <Accounts  />}
          {activeTab === "expenses"  && <Expenses  />}
          {activeTab === "tasks"     && <Tasks     />}
          {activeTab === "crm"       && <CRM       />}
          {activeTab === "insights"  && <Insights  />}
          {activeTab === "marketing" && <Marketing />}
          {activeTab === "admin"     && <AdminPanel/>}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function HotelApp({ onSwitchApp }) {
  return (
    <AppProvider>
      <HotelInner onSwitchApp={onSwitchApp} />
    </AppProvider>
  );
}
