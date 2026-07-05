
import { AppProvider, useApp } from "./context/AppContext";
import Login        from "./components/Login";
import Navbar       from "./components/Navbar";
import Notification from "./components/Notification";
import Desk         from "./components/Desk";
import Bookings     from "./components/Bookings";
import Expenses     from "./components/Expenses";
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
      <main style={{ flex:1, overflowY:"auto" }}>
        <ErrorBoundary key={activeTab}>
          {activeTab === "desk"      && <Desk      />}
          {activeTab === "bookings"  && <Bookings  />}
          {activeTab === "expenses"  && <Expenses  />}
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
