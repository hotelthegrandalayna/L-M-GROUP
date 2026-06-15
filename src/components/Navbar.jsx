
import { useApp } from '../context/AppContext';

const TABS = [
  { id: 'desk',      icon: 'ti-layout-dashboard', label: 'Desk'      },
  { id: 'bookings',  icon: 'ti-calendar-check',   label: 'Bookings'  },
  { id: 'invoice',   icon: 'ti-file-invoice',     label: 'Invoice'   },
  { id: 'expenses',  icon: 'ti-receipt',          label: 'Expenses'  },
  { id: 'crm',       icon: 'ti-users',            label: 'CRM'       },
  { id: 'insights',  icon: 'ti-chart-bar',        label: 'Insights'  },
  { id: 'marketing', icon: 'ti-speakerphone',     label: 'Marketing' },
  { id: 'admin',     icon: 'ti-settings',         label: 'Admin'     },
];

export default function Navbar({ onSwitchApp }) {
  const { curUser, curRole, activeTab, setActiveTab, logout } = useApp();

  return (
    <nav style={{
      background: 'linear-gradient(135deg,#1e0a4a 0%,#2d1b69 100%)',
      borderBottom: '1px solid rgba(201,168,76,.2)',
      display: 'flex', alignItems: 'center',
      height: 58, flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
      padding: '0 20px', gap: 0,
      boxShadow: '0 2px 16px rgba(30,10,74,.5)',
    }}>

      {/* Brand */}
      <div style={{ display:'flex', alignItems:'center', gap:10, paddingRight:20, borderRight:'1px solid rgba(255,255,255,.1)', flexShrink:0 }}>
        <div style={{
          width:36, height:36, borderRadius:9,
          background:'linear-gradient(135deg,#4a2ea8,#6b44d0)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:"'Playfair Display',serif", fontWeight:800, fontSize:13, color:'#E8C96A',
          flexShrink:0, boxShadow:'0 2px 10px rgba(74,46,168,.5)',
        }}>GA</div>
        <div style={{ lineHeight:1.25 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', fontFamily:"'Playfair Display',serif", whiteSpace:'nowrap', letterSpacing:.2 }}>Hotel The Grand Alayna</div>
          <div style={{ fontSize:9, color:'rgba(201,168,76,.8)', letterSpacing:1.5, textTransform:'uppercase', marginTop:1 }}>Sitakunda · Chattogram</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', flex:1, alignItems:'stretch', height:'100%', overflowX:'auto', scrollbarWidth:'none', paddingLeft:8 }}>
        {TABS.filter(t => curRole === 'staff' ? ['desk','bookings','invoice','expenses'].includes(t.id) : true).map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 18px', height: '100%',
              background: active ? 'rgba(201,168,76,.15)' : 'none',
              border: 'none',
              borderBottom: active ? '3px solid #C9A84C' : '3px solid transparent',
              borderTop: '3px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              transition: 'all .18s',
            }}>
              <i className={'ti ' + t.icon} style={{
                fontSize: 16,
                color: active ? '#E8C96A' : 'rgba(255,255,255,.5)',
                transition: 'color .18s',
              }} />
              <span style={{
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? '#fff' : 'rgba(255,255,255,.55)',
                letterSpacing: .2, whiteSpace: 'nowrap',
                transition: 'color .18s',
              }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, paddingLeft:16, borderLeft:'1px solid rgba(255,255,255,.1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{
            width:30, height:30, borderRadius:8,
            background:'rgba(201,168,76,.15)',
            border:'1px solid rgba(201,168,76,.3)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <i className="ti ti-user" style={{ fontSize:14, color:'#C9A84C' }} />
          </div>
          <div style={{ lineHeight:1.3 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>{curUser}</div>
            <div style={{ fontSize:9, fontWeight:700, color:'#C9A84C', textTransform:'uppercase', letterSpacing:1 }}>{curRole}</div>
          </div>
        </div>

        {onSwitchApp && (
          <button onClick={onSwitchApp} style={{
            padding:'6px 12px', borderRadius:7,
            border:'1px solid rgba(201,168,76,.35)',
            background:'rgba(201,168,76,.08)',
            color:'#E8C96A', fontSize:11, fontFamily:'inherit',
            cursor:'pointer', fontWeight:700, whiteSpace:'nowrap',
            display:'flex', alignItems:'center', gap:5,
          }}>
            <i className="ti ti-switch-horizontal" style={{ fontSize:13 }} /> Hall
          </button>
        )}

        <button onClick={logout} style={{
          background:'rgba(255,255,255,.07)',
          border:'1px solid rgba(255,255,255,.12)',
          cursor:'pointer', color:'rgba(255,255,255,.6)',
          padding:'7px 9px', borderRadius:7,
          display:'flex', alignItems:'center', justifyContent:'center',
        }} title="Sign out">
          <i className="ti ti-power" style={{ fontSize:15 }} />
        </button>
      </div>
    </nav>
  );
}
