import { useState } from 'react';
import { useApp } from '../context/AppContext';

const BASE_USERS = {
  admin:  { pass: 'amelia2024', role: 'admin' },
  staff:  { pass: 'staff123',   role: 'staff' },
  staff2: { pass: 'staff456',   role: 'staff' },
};

function resolveUsers() {
  const users = {};
  Object.keys(BASE_USERS).forEach(u => { users[u] = { ...BASE_USERS[u] }; });
  Object.keys(users).forEach(u => {
    const stored = localStorage.getItem('a_pass_' + u);
    if (stored) users[u].pass = stored;
  });
  try {
    const renames = JSON.parse(localStorage.getItem('a_renames') || '{}');
    Object.keys(renames).forEach(oldName => {
      const newName = renames[oldName];
      if (!newName || oldName === newName) return;
      const entry = users[oldName] || { ...BASE_USERS[oldName] };
      if (!entry) return;
      users[newName] = { ...entry };
      delete users[oldName];
      const sn = localStorage.getItem('a_pass_' + newName);
      if (sn) users[newName].pass = sn;
    });
  } catch {}
  return users;
}

const DEFAULT_RECOVERY = ['mainulhasan86@gmail.com', 'mainulhasan86@yahoo.com'];

const inp = {
  width:'100%', boxSizing:'border-box',
  padding:'13px 14px 13px 38px',
  background:'rgba(255,255,255,.07)',
  border:'1.5px solid rgba(201,168,76,.2)',
  borderRadius:11, color:'#f2dfc0', fontSize:14,
  fontFamily:'inherit', outline:'none',
};

export default function Login({ onSwitchApp }) {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [fpEmail, setFpEmail]   = useState('');
  const [fpEmailErr, setFpEmailErr] = useState('');
  const [fpStep, setFpStep]     = useState(1);
  const [fpNewPass, setFpNewPass] = useState('');
  const [fpConfPass, setFpConfPass] = useState('');
  const [fpPassErr, setFpPassErr] = useState('');

  function doLogin(e) {
    e?.preventDefault();
    if (!username.trim()) { setError('Please enter your username.'); return; }
    const users = resolveUsers();
    const key = Object.keys(users).find(k => k.toLowerCase() === username.trim().toLowerCase());
    if (!key) { setError('Invalid username or password.'); return; }
    const usr = users[key];
    const stored = localStorage.getItem('a_pass_' + key);
    const checkPass = stored || usr.pass;
    if (checkPass === password) {
      login(key, usr.role);
    } else {
      setError('Invalid username or password.');
    }
  }

  function fpVerifyEmail() {
    const v = fpEmail.trim().toLowerCase();
    if (!v) { setFpEmailErr('Please enter the recovery email.'); return; }
    const list = (JSON.parse(localStorage.getItem('ga_recovery_emails') || 'null') || DEFAULT_RECOVERY)
      .map(e => e.toLowerCase());
    if (!list.includes(v)) { setFpEmailErr('Recovery email does not match. Contact your manager.'); return; }
    setFpEmailErr('');
    setFpStep(2);
  }

  function fpResetPass() {
    if (!fpNewPass || fpNewPass.length < 4) { setFpPassErr('Password must be at least 4 characters.'); return; }
    if (fpNewPass !== fpConfPass) { setFpPassErr('Passwords do not match.'); return; }
    localStorage.setItem('a_pass_admin', fpNewPass);
    setShowForgot(false);
    setFpStep(1);
    setFpEmail(''); setFpNewPass(''); setFpConfPass('');
    setError('Password reset! You can now log in.');
  }

  const focusIn  = e => { e.target.style.borderColor='#c9a84c'; e.target.style.background='rgba(255,255,255,.11)'; e.target.style.boxShadow='0 0 0 3px rgba(201,168,76,.12)'; };
  const focusOut = e => { e.target.style.borderColor='rgba(201,168,76,.2)'; e.target.style.background='rgba(255,255,255,.07)'; e.target.style.boxShadow='none'; };

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'radial-gradient(ellipse at 30% 20%, #3d0a0a 0%, #1a0404 40%, #0d0101 100%)',
      padding:20, fontFamily:"'DM Sans', sans-serif", position:'relative', overflow:'hidden',
    }}>
      {/* Decorative rings */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-15%', left:'-10%', width:500, height:500, borderRadius:'50%', border:'1px solid rgba(201,168,76,.08)' }} />
        <div style={{ position:'absolute', top:'-10%', left:'-5%',  width:700, height:700, borderRadius:'50%', border:'1px solid rgba(201,168,76,.05)' }} />
        <div style={{ position:'absolute', bottom:'-20%', right:'-10%', width:600, height:600, borderRadius:'50%', border:'1px solid rgba(123,18,18,.25)' }} />
        <div style={{ position:'absolute', bottom:'-10%', right:'-5%',  width:800, height:800, borderRadius:'50%', border:'1px solid rgba(123,18,18,.12)' }} />
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#c9a84c,#f0d080,#c9a84c,transparent)' }} />
      </div>

      {/* Card */}
      <div style={{
        position:'relative', zIndex:1,
        background:'linear-gradient(160deg, rgba(90,10,10,.92) 0%, rgba(45,5,5,.96) 100%)',
        border:'1px solid rgba(201,168,76,.25)',
        borderRadius:20, width:'100%', maxWidth:400,
        boxShadow:'0 30px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(201,168,76,.08), inset 0 1px 0 rgba(201,168,76,.15)',
        overflow:'hidden',
      }}>
        {/* Gold top stripe */}
        <div style={{ height:3, background:'linear-gradient(90deg,#8B1A1A,#c9a84c,#f0d080,#c9a84c,#8B1A1A)' }} />

        {/* Header */}
        <div style={{ padding:'36px 36px 24px', textAlign:'center' }}>
          {/* GA monogram circle */}
          <div style={{
            margin:'0 auto 16px', width:70, height:70, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(123,18,18,.6), rgba(60,5,5,.8))',
            border:'1.5px solid rgba(201,168,76,.35)',
            boxShadow:'0 0 24px rgba(123,18,18,.4), inset 0 1px 0 rgba(201,168,76,.2)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="46" height="46" viewBox="0 0 60 60">
              <text x="30" y="38" textAnchor="middle" fontFamily="Playfair Display,serif" fontSize="24" fontWeight="700" fill="#f2dfc0">GA</text>
            </svg>
          </div>

          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, fontWeight:700, color:'#f2dfc0', letterSpacing:1, lineHeight:1.1, marginBottom:5, textShadow:'0 2px 12px rgba(0,0,0,.4)' }}>
            Hotel
          </div>
          <div style={{ fontSize:11, color:'#c9a84c', letterSpacing:5, textTransform:'uppercase', fontWeight:600, marginBottom:6 }}>
            The Grand Alayna
          </div>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0 0' }}>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,rgba(201,168,76,.35))' }} />
            <div style={{ width:5, height:5, borderRadius:'50%', background:'#c9a84c', opacity:.7 }} />
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,rgba(201,168,76,.35),transparent)' }} />
          </div>
        </div>

        {/* Form */}
        <div style={{ padding:'0 36px 32px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(242,223,192,.6)', letterSpacing:2, textAlign:'center', marginBottom:22, textTransform:'uppercase' }}>
            Staff Sign In
          </div>

          <form onSubmit={doLogin}>
            {/* Username */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(201,168,76,.7)', textTransform:'uppercase', letterSpacing:1.2, marginBottom:7 }}>Username</div>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:14, opacity:.5 }}>👤</span>
                <input type="text" placeholder="Enter username" value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  autoComplete="off"
                  style={inp} onFocus={focusIn} onBlur={focusOut}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: username.trim().toLowerCase() === 'admin' ? 6 : 22 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(201,168,76,.7)', textTransform:'uppercase', letterSpacing:1.2, marginBottom:7 }}>Password</div>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:14, opacity:.5 }}>🔒</span>
                <input type={showPass ? 'text' : 'password'} placeholder="Enter password" value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  style={{ ...inp, paddingRight:44 }} onFocus={focusIn} onBlur={focusOut}
                />
                <button type="button" onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, opacity:.5, padding:2, color:'#f2dfc0' }}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Forgot password — only when typing "admin" */}
            {username.trim().toLowerCase() === 'admin' && (
              <div style={{ textAlign:'right', marginBottom:16 }}>
                <button type="button" onClick={() => { setShowForgot(true); setFpStep(1); }}
                  style={{ background:'none', border:'none', color:'rgba(201,168,76,.65)', cursor:'pointer', fontSize:11, fontWeight:600, textDecoration:'underline', fontFamily:'inherit' }}>
                  Forgot password?
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9, background:'rgba(192,57,43,.2)', border:'1px solid rgba(192,57,43,.45)', color:'#fca5a5', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:7 }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Sign In button */}
            <button type="submit" style={{
              width:'100%', padding:'14px',
              background:'linear-gradient(135deg,#9a7a20,#c9a84c,#e8c96c,#c9a84c)',
              border:'none', borderRadius:11,
              fontWeight:800, fontSize:14, color:'#1a0a00',
              cursor:'pointer', fontFamily:'inherit',
              letterSpacing:1.5, textTransform:'uppercase',
              boxShadow:'0 4px 20px rgba(201,168,76,.35), inset 0 1px 0 rgba(255,255,255,.25)',
              transition:'opacity .2s, transform .15s, box-shadow .2s',
            }}
            onMouseEnter={e=>{e.target.style.opacity='.92';e.target.style.transform='translateY(-1px)';e.target.style.boxShadow='0 8px 28px rgba(201,168,76,.45), inset 0 1px 0 rgba(255,255,255,.25)';}}
            onMouseLeave={e=>{e.target.style.opacity='1';e.target.style.transform='';e.target.style.boxShadow='0 4px 20px rgba(201,168,76,.35), inset 0 1px 0 rgba(255,255,255,.25)';}}
            >
              Sign In
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:16, fontSize:11, color:'rgba(242,223,192,.35)', lineHeight:1.5 }}>
            Use your assigned credentials to access the system
          </div>

          <div style={{ height:1, background:'rgba(201,168,76,.12)', margin:'20px 0' }} />

          {/* Switch to Hall */}
          {onSwitchApp && (
            <button onClick={onSwitchApp} style={{
              width:'100%', padding:'11px',
              background:'transparent',
              border:'1px solid rgba(201,168,76,.25)', borderRadius:10,
              color:'rgba(201,168,76,.75)', fontSize:12, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit', letterSpacing:.5,
              transition:'border-color .2s, color .2s, background .2s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(201,168,76,.5)';e.currentTarget.style.color='#c9a84c';e.currentTarget.style.background='rgba(201,168,76,.06)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(201,168,76,.25)';e.currentTarget.style.color='rgba(201,168,76,.75)';e.currentTarget.style.background='transparent';}}
            >
              ⇄ Switch to Convention Hall
            </button>
          )}
        </div>

        {/* Bottom stripe */}
        <div style={{ height:3, background:'linear-gradient(90deg,#8B1A1A,rgba(201,168,76,.4),#8B1A1A)' }} />
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}>
          <div style={{ background:'linear-gradient(160deg,rgba(90,10,10,.97),rgba(45,5,5,.99))', border:'1px solid rgba(201,168,76,.3)', borderRadius:16, padding:'28px 28px 24px', width:340, position:'relative', boxShadow:'0 20px 60px rgba(0,0,0,.6)' }}>
            <div style={{ height:3, background:'linear-gradient(90deg,#8B1A1A,#c9a84c,#8B1A1A)', borderRadius:'8px 8px 0 0', position:'absolute', top:0, left:0, right:0 }} />
            <button onClick={()=>setShowForgot(false)} style={{ position:'absolute', top:14, right:16, background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', borderRadius:7, fontSize:16, cursor:'pointer', color:'rgba(242,223,192,.7)', padding:'2px 9px', lineHeight:1 }}>✕</button>
            <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:15, marginBottom:6, color:'#f2dfc0' }}>Reset Admin Password</div>
            {fpStep === 1 ? (
              <>
                <p style={{ fontSize:12, color:'rgba(242,223,192,.5)', marginBottom:14 }}>Enter your recovery email to verify identity.</p>
                <input type="email" placeholder="Recovery email" value={fpEmail} onChange={e=>setFpEmail(e.target.value)}
                  style={{ ...inp, paddingLeft:14, marginBottom:6 }} onFocus={focusIn} onBlur={focusOut} />
                {fpEmailErr && <div style={{ fontSize:11, color:'#fca5a5', marginBottom:8 }}>{fpEmailErr}</div>}
                <button onClick={fpVerifyEmail} style={{ width:'100%', marginTop:6, padding:'12px', background:'linear-gradient(135deg,#9a7a20,#c9a84c,#e8c96c)', border:'none', borderRadius:10, fontWeight:800, fontSize:13, color:'#1a0a00', cursor:'pointer', fontFamily:'inherit', letterSpacing:1 }}>
                  Verify Email
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize:12, color:'rgba(242,223,192,.5)', marginBottom:14 }}>Set a new admin password.</p>
                <input type="password" placeholder="New password" value={fpNewPass} onChange={e=>setFpNewPass(e.target.value)}
                  style={{ ...inp, paddingLeft:14, marginBottom:8 }} onFocus={focusIn} onBlur={focusOut} />
                <input type="password" placeholder="Confirm password" value={fpConfPass} onChange={e=>setFpConfPass(e.target.value)}
                  style={{ ...inp, paddingLeft:14, marginBottom:6 }} onFocus={focusIn} onBlur={focusOut} />
                {fpPassErr && <div style={{ fontSize:11, color:'#fca5a5', marginBottom:8 }}>{fpPassErr}</div>}
                <button onClick={fpResetPass} style={{ width:'100%', marginTop:6, padding:'12px', background:'linear-gradient(135deg,#9a7a20,#c9a84c,#e8c96c)', border:'none', borderRadius:10, fontWeight:800, fontSize:13, color:'#1a0a00', cursor:'pointer', fontFamily:'inherit', letterSpacing:1 }}>
                  Reset Password
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
