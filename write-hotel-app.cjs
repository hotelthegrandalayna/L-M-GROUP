const fs = require('fs');
const src = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src';

// ── HotelApp.jsx — the hotel shell (was App.jsx before split) ────────────────
fs.writeFileSync(src + '/HotelApp.jsx', `
import { AppProvider, useApp } from "./context/AppContext";
import Login        from "./components/Login";
import Navbar       from "./components/Navbar";
import Notification from "./components/Notification";
import Desk         from "./components/Desk";
import Bookings     from "./components/Bookings";
import Expenses     from "./components/Expenses";
import Invoice      from "./components/Invoice";
import CRM          from "./components/CRM";
import Insights     from "./components/Insights";
import Marketing    from "./components/Marketing";
import AdminPanel   from "./components/Admin/AdminPanel";

function HotelInner({ onSwitchApp }) {
  const { curUser, activeTab } = useApp();

  if (!curUser) return <Login onSwitchApp={onSwitchApp} />;

  return (
    <div id="hotelApp" style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      <Navbar onSwitchApp={onSwitchApp} />
      <Notification />
      <main style={{ flex:1, overflowY:"auto" }}>
        {activeTab === "desk"      && <Desk      />}
        {activeTab === "bookings"  && <Bookings  />}
        {activeTab === "expenses"  && <Expenses  />}
        {activeTab === "invoice"   && <Invoice   />}
        {activeTab === "crm"       && <CRM       />}
        {activeTab === "insights"  && <Insights  />}
        {activeTab === "marketing" && <Marketing />}
        {activeTab === "admin"     && <AdminPanel/>}
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
`, 'utf8');

// ── main.jsx — no longer needs AppProvider at root level ────────────────────
fs.writeFileSync(src + '/main.jsx', `
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`, 'utf8');

// ── Move old hotel Welcome into Login (add switch button) — just patch Navbar to add switch ─
// Actually the hotel Login.jsx already has a stub — let's just add onSwitchApp prop support
let login = fs.readFileSync(src + '/components/Login.jsx', 'utf8');
if (!login.includes('onSwitchApp')) {
  login = login.replace(
    'export default function Login()',
    'export default function Login({ onSwitchApp })'
  );
  // Add switch button near bottom of login-box
  login = login.replace(
    'className="login-hint"',
    'className="login-hint" style={{ marginBottom:10 }}'
  );
  // Insert the switch button before the closing of the return
  login = login.replace(
    '</div>\n  );\n}',
    `  {onSwitchApp && (
        <button onClick={onSwitchApp} style={{ marginTop:10, background:"transparent", border:"1px solid rgba(201,168,76,.4)", color:"#c9a84c", borderRadius:8, padding:"7px 16px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
          ⇄ Switch to Convention Hall
        </button>
      )}
      </div>
    );
  }`
  );
  fs.writeFileSync(src + '/components/Login.jsx', login, 'utf8');
}

// ── Navbar — add onSwitchApp support ─────────────────────────────────────────
let nav = fs.readFileSync(src + '/components/Navbar.jsx', 'utf8');
if (!nav.includes('onSwitchApp')) {
  nav = nav.replace(
    'export default function Navbar()',
    'export default function Navbar({ onSwitchApp })'
  );
  // Add switch button in nav-right area before logout button
  nav = nav.replace(
    '<button className="logout-btn"',
    `{onSwitchApp && <button onClick={onSwitchApp} style={{ padding:"5px 10px",borderRadius:7,border:"1px solid rgba(201,168,76,.3)",background:"rgba(201,168,76,.1)",color:"#f0d080",fontSize:11,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600 }}>⇄ Hall</button>}
        <button className="logout-btn"`
  );
  fs.writeFileSync(src + '/components/Navbar.jsx', nav, 'utf8');
}

// Remove old hotel Welcome.jsx (it was replaced by the new top-level Welcome)
// (the old one was just a login screen redirect — no longer needed)
const oldWelcome = src + '/components/Welcome.jsx';
if (fs.existsSync(oldWelcome)) {
  const content = fs.readFileSync(oldWelcome, 'utf8');
  // Only remove if it's the new multi-app welcome (has "onChoose")
  if (content.includes('onChoose')) {
    console.log('Welcome.jsx is the NEW multi-app one — keeping it');
  } else {
    // It's the old hotel-only welcome — replace with redirect to hotel
    fs.writeFileSync(oldWelcome, `// This file is no longer used — see src/components/Welcome.jsx at root level\nexport default function Welcome() { return null; }\n`, 'utf8');
  }
}

console.log('HotelApp.jsx, main.jsx, Login patch, Navbar patch done');
