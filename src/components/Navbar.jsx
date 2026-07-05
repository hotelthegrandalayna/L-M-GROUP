
import { useApp } from '../context/AppContext';

const TABS = [
  { id: 'desk',      icon: 'ti-layout-dashboard', label: 'Desk'      },
  { id: 'bookings',  icon: 'ti-calendar-check',   label: 'Bookings'  },
  { id: 'expenses',  icon: 'ti-receipt',          label: 'Expenses'  },
  { id: 'crm',       icon: 'ti-users',            label: 'CRM'       },
  { id: 'insights',  icon: 'ti-chart-bar',        label: 'Insights'  },
  { id: 'marketing', icon: 'ti-speakerphone',     label: 'Marketing' },
  { id: 'admin',     icon: 'ti-settings',         label: 'Admin'     },
];

export default function Navbar({ onSwitchApp }) {
  const { curUser, curRole, activeTab, setActiveTab, logout } = useApp();
  const visibleTabs = TABS.filter(t =>
    curRole === 'staff' ? ['desk','bookings','expenses'].includes(t.id) : true
  );

  return (
    <nav style={{
      background: 'linear-gradient(135deg, #0f0628 0%, #1a0a42 50%, #220d54 100%)',
      borderBottom: '1px solid rgba(201,168,76,.18)',
      display: 'flex', alignItems: 'center',
      height: 62, flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
      padding: '0 16px 0 20px',
      boxShadow: '0 4px 24px rgba(10,2,30,.6), 0 1px 0 rgba(201,168,76,.1)',
    }}>

      {/* Brand */}
      <div style={{ display:'flex', alignItems:'center', gap:11, paddingRight:18, marginRight:4, flexShrink:0 }}>
        <div style={{
          width:38, height:38, borderRadius:10,
          background:'linear-gradient(145deg,#5c35c8 0%,#3a1f8a 100%)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:"Georgia,serif", fontWeight:800, fontSize:14, color:'#E8C96A',
          flexShrink:0,
          boxShadow:'0 2px 12px rgba(92,53,200,.5), inset 0 1px 0 rgba(255,255,255,.12)',
          letterSpacing:.5,
        }}>GA</div>
        <div style={{ lineHeight:1.3 }}>
          <div style={{
            fontSize:13, fontWeight:700, color:'#fff',
            fontFamily:"Georgia,serif", whiteSpace:'nowrap', letterSpacing:.3,
          }}>Hotel The Grand Alayna</div>
          <div style={{
            fontSize:9, color:'rgba(201,168,76,.75)',
            letterSpacing:2, textTransform:'uppercase', marginTop:2,
            fontWeight:600,
          }}>Sitakunda · Chattogram</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width:1, height:32, background:'rgba(255,255,255,.08)', marginRight:4, flexShrink:0 }} />

      {/* Tabs */}
      <div style={{
        display:'flex', flex:1, alignItems:'stretch', height:'100%',
        overflowX:'auto', scrollbarWidth:'none', paddingLeft:4,
      }}>
        {visibleTabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 15px', height: '100%',
              background: active
                ? 'linear-gradient(180deg, rgba(201,168,76,.12) 0%, rgba(201,168,76,.06) 100%)'
                : 'transparent',
              border: 'none',
              borderBottom: active ? '2.5px solid #C9A84C' : '2.5px solid transparent',
              borderTop: '2.5px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              transition: 'all .15s ease',
              position: 'relative',
            }}>
              <i className={'ti ' + t.icon} style={{
                fontSize: 15,
                color: active ? '#E8C96A' : 'rgba(255,255,255,.38)',
                transition: 'color .15s',
              }} />
              <span style={{
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? '#ffffff' : 'rgba(255,255,255,.45)',
                letterSpacing: active ? .3 : .1,
                whiteSpace: 'nowrap',
                transition: 'all .15s',
              }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, paddingLeft:12 }}>

        {/* User badge */}
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          background:'rgba(255,255,255,.05)',
          border:'1px solid rgba(255,255,255,.09)',
          borderRadius:9, padding:'5px 10px 5px 6px',
        }}>
          <div style={{
            width:26, height:26, borderRadius:7,
            background:'linear-gradient(135deg,rgba(201,168,76,.25),rgba(201,168,76,.1))',
            border:'1px solid rgba(201,168,76,.35)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <i className="ti ti-user" style={{ fontSize:13, color:'#C9A84C' }} />
          </div>
          <div style={{ lineHeight:1.25 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>{curUser}</div>
            <div style={{
              fontSize:9, fontWeight:700, color:'#C9A84C',
              textTransform:'uppercase', letterSpacing:1.2,
            }}>{curRole}</div>
          </div>
        </div>

        {/* Switch to Hall */}
        {onSwitchApp && (
          <button onClick={onSwitchApp} style={{
            padding:'6px 12px', borderRadius:8,
            border:'1px solid rgba(201,168,76,.3)',
            background:'rgba(201,168,76,.07)',
            color:'#E8C96A', fontSize:11, fontFamily:'inherit',
            cursor:'pointer', fontWeight:700, whiteSpace:'nowrap',
            display:'flex', alignItems:'center', gap:5,
            transition:'all .15s',
          }}>
            <i className="ti ti-switch-horizontal" style={{ fontSize:13 }} /> Hall
          </button>
        )}

        {/* Logout */}
        <button onClick={logout} style={{
          background:'rgba(255,255,255,.05)',
          border:'1px solid rgba(255,255,255,.1)',
          cursor:'pointer', color:'rgba(255,255,255,.5)',
          padding:'7px 9px', borderRadius:8,
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all .15s',
        }} title="Sign out">
          <i className="ti ti-power" style={{ fontSize:15 }} />
        </button>
      </div>
    </nav>
  );
}
