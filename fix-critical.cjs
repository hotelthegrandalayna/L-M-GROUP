const fs = require('fs');
const src = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src';

// ─── 1. Fix AppContext — restore session from localStorage on init ──────────
let ctx = fs.readFileSync(src + '/context/AppContext.jsx', 'utf8');
ctx = ctx.replace(
  `  // Auth\n  const [curRole, setCurRole]   = useState('');\n  const [curUser, setCurUser]   = useState('');`,
  `  // Auth — restore session from localStorage so page refresh keeps you logged in
  const [curRole, setCurRole] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('ga_sess')); return s?.role || ''; } catch { return ''; }
  });
  const [curUser, setCurUser] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('ga_sess')); return s?.user || ''; } catch { return ''; }
  });`
);
fs.writeFileSync(src + '/context/AppContext.jsx', ctx, 'utf8');
console.log('1. AppContext session restore fixed');

// ─── 2. Add ErrorBoundary component ───────────────────────────────────────
fs.writeFileSync(src + '/components/ErrorBoundary.jsx', `
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error("Tab error:", err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:40, textAlign:"center", fontFamily:"DM Sans,sans-serif" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
          <div style={{ fontSize:15, fontWeight:700, color:"#7B1212", marginBottom:8 }}>
            Something went wrong in this tab
          </div>
          <div style={{ fontSize:12, color:"#888", marginBottom:20, maxWidth:400, margin:"0 auto 20px" }}>
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding:"9px 20px", background:"#7B1212", color:"#fff", border:"none", borderRadius:9, cursor:"pointer", fontWeight:700 }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
`, 'utf8');
console.log('2. ErrorBoundary component created');

// ─── 3. Wrap each tab in ErrorBoundary in HotelApp ────────────────────────
let hotel = fs.readFileSync(src + '/HotelApp.jsx', 'utf8');
hotel = hotel.replace(
  `import AdminPanel   from "./components/Admin/AdminPanel";`,
  `import AdminPanel   from "./components/Admin/AdminPanel";\nimport ErrorBoundary from "./components/ErrorBoundary";`
);
hotel = hotel.replace(
  `      <main style={{ flex:1, overflowY:"auto" }}>
        {activeTab === "desk"      && <Desk      />}
        {activeTab === "bookings"  && <Bookings  />}
        {activeTab === "expenses"  && <Expenses  />}
        {activeTab === "invoice"   && <Invoice   />}
        {activeTab === "crm"       && <CRM       />}
        {activeTab === "insights"  && <Insights  />}
        {activeTab === "marketing" && <Marketing />}
        {activeTab === "admin"     && <AdminPanel/>}
      </main>`,
  `      <main style={{ flex:1, overflowY:"auto" }}>
        <ErrorBoundary key={activeTab}>
          {activeTab === "desk"      && <Desk      />}
          {activeTab === "bookings"  && <Bookings  />}
          {activeTab === "expenses"  && <Expenses  />}
          {activeTab === "invoice"   && <Invoice   />}
          {activeTab === "crm"       && <CRM       />}
          {activeTab === "insights"  && <Insights  />}
          {activeTab === "marketing" && <Marketing />}
          {activeTab === "admin"     && <AdminPanel/>}
        </ErrorBoundary>
      </main>`
);
fs.writeFileSync(src + '/HotelApp.jsx', hotel, 'utf8');
console.log('3. HotelApp wrapped with ErrorBoundary');

// ─── 4. Fix hall.css — scope ALL rules to #hallApp to prevent leaking ─────
const hallCss = fs.readFileSync(src + '/styles/hall.css', 'utf8');

// Replace #loginScreen.screen with #hallApp #loginScreen.screen
// and .login-box, .login-logo etc with #hallApp .login-box etc
let fixed = hallCss
  .replace(/#loginScreen\.screen\s*\{/g, '#hallApp #loginScreen.screen {')
  .replace(/^\.login-box\s*\{/gm, '#hallApp .login-box {')
  .replace(/^\.login-logo\s*\{/gm, '#hallApp .login-logo {')
  .replace(/^\.login-sub\s*\{/gm, '#hallApp .login-sub {')
  .replace(/^\.login-monogram\s*\{/gm, '#hallApp .login-monogram {')
  .replace(/^\.login-box h2\s*\{/gm, '#hallApp .login-box h2 {')
  .replace(/^\.login-box input\s*\{/gm, '#hallApp .login-box input {')
  .replace(/^\.login-box input::/gm, '#hallApp .login-box input::')
  .replace(/^\.login-box input:focus\s*\{/gm, '#hallApp .login-box input:focus {')
  .replace(/^\.login-box button\[type=submit\]\s*\{/gm, '#hallApp .login-box button[type=submit] {')
  .replace(/^\.login-err\s*\{/gm, '#hallApp .login-err {')
  .replace(/^\.login-hint\s*\{/gm, '#hallApp .login-hint {');

fs.writeFileSync(src + '/styles/hall.css', fixed, 'utf8');
console.log('4. hall.css scoped — no more style leaking into hotel app');

// ─── 5. Also ensure HallApp wraps tabs in ErrorBoundary ───────────────────
let hallApp = fs.readFileSync(src + '/hall/HallApp.jsx', 'utf8');
if (!hallApp.includes('ErrorBoundary')) {
  hallApp = hallApp.replace(
    `import "../styles/hall.css";`,
    `import "../styles/hall.css";\nimport ErrorBoundary from "../components/ErrorBoundary";`
  );
  hallApp = hallApp.replace(
    `      <main style={{ flex:1, overflowY:"auto" }}>
        {activeTab === "invoice"  && <HallInvoice  />}
        {activeTab === "calendar" && <HallCalendar />}
        {activeTab === "crm"      && <HallCRM      />}
        {activeTab === "expenses" && <HallExpenses />}
        {activeTab === "insights" && <HallInsights />}
        {activeTab === "admin"    && <HallAdmin    />}
      </main>`,
    `      <main style={{ flex:1, overflowY:"auto" }}>
        <ErrorBoundary key={activeTab}>
          {activeTab === "invoice"  && <HallInvoice  />}
          {activeTab === "calendar" && <HallCalendar />}
          {activeTab === "crm"      && <HallCRM      />}
          {activeTab === "expenses" && <HallExpenses />}
          {activeTab === "insights" && <HallInsights />}
          {activeTab === "admin"    && <HallAdmin    />}
        </ErrorBoundary>
      </main>`
  );
  fs.writeFileSync(src + '/hall/HallApp.jsx', hallApp, 'utf8');
  console.log('5. HallApp also wrapped with ErrorBoundary');
}

console.log('\nAll critical fixes applied.');
