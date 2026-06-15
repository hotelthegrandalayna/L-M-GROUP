
import { useState } from "react";
import { useHall, hallLogin } from "../HallContext";

export default function HallLogin({ onSwitchApp }) {
  const { login } = useHall();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err,  setErr]  = useState("");
  const [showPass, setShowPass] = useState(false);

  function doLogin(e) {
    e?.preventDefault();
    if (!user.trim()) { setErr("Please enter your username."); return; }
    const result = hallLogin(user, pass);
    if (result) { login(result.user, result.role); }
    else { setErr("Invalid username or password."); }
  }

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"radial-gradient(ellipse at 30% 20%, #3d0a0a 0%, #1a0404 40%, #0d0101 100%)",
      padding:20, fontFamily:"'DM Sans', sans-serif", position:"relative", overflow:"hidden",
    }}>
      {/* Decorative background rings */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-15%", left:"-10%", width:500, height:500, borderRadius:"50%", border:"1px solid rgba(201,168,76,.08)", }} />
        <div style={{ position:"absolute", top:"-10%", left:"-5%",  width:700, height:700, borderRadius:"50%", border:"1px solid rgba(201,168,76,.05)", }} />
        <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:600, height:600, borderRadius:"50%", border:"1px solid rgba(123,18,18,.25)", }} />
        <div style={{ position:"absolute", bottom:"-10%", right:"-5%",  width:800, height:800, borderRadius:"50%", border:"1px solid rgba(123,18,18,.12)", }} />
        {/* Gold shimmer bar at top */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg, transparent, #c9a84c, #f0d080, #c9a84c, transparent)" }} />
      </div>

      {/* Card */}
      <div style={{
        position:"relative", zIndex:1,
        background:"linear-gradient(160deg, rgba(90,10,10,.92) 0%, rgba(45,5,5,.96) 100%)",
        border:"1px solid rgba(201,168,76,.25)",
        borderRadius:20, width:"100%", maxWidth:400,
        boxShadow:"0 30px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(201,168,76,.08), inset 0 1px 0 rgba(201,168,76,.15)",
        overflow:"hidden",
      }}>

        {/* Gold top accent stripe */}
        <div style={{ height:3, background:"linear-gradient(90deg, #8B1A1A, #c9a84c, #f0d080, #c9a84c, #8B1A1A)" }} />

        {/* Header section */}
        <div style={{ padding:"36px 36px 28px", textAlign:"center" }}>
          {/* SVG Logo */}
          <div style={{ marginBottom:16, display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:70, height:70, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(123,18,18,.6), rgba(60,5,5,.8))",
            border:"1.5px solid rgba(201,168,76,.35)",
            boxShadow:"0 0 24px rgba(123,18,18,.4), inset 0 1px 0 rgba(201,168,76,.2)",
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 90" width="52" height="25">
              <polygon points="8,78 19,78 46,18 35,18" fill="#f2dfc0"/>
              <polygon points="35,18 46,18 71,78 60,78" fill="#f2dfc0"/>
              <rect x="24" y="49" width="30" height="7" fill="#f2dfc0"/>
              <polygon points="36,18 40,3 44,18" fill="#f2dfc0"/>
              <rect x="4" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
              <rect x="56" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
              <circle cx="95" cy="44" r="5" fill="#c9a84c"/>
              <rect x="112" y="18" width="11" height="60" fill="#f2dfc0"/>
              <rect x="149" y="18" width="11" height="60" fill="#f2dfc0"/>
              <rect x="112" y="42" width="48" height="8" fill="#f2dfc0"/>
              <polygon points="113,18 117,3 122,18" fill="#f2dfc0"/>
              <polygon points="150,18 154,3 159,18" fill="#f2dfc0"/>
              <rect x="108" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
              <rect x="145" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
            </svg>
          </div>

          {/* Hall name */}
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:30, fontWeight:700, color:"#f2dfc0",
            letterSpacing:1, lineHeight:1.1, marginBottom:5,
            textShadow:"0 2px 12px rgba(0,0,0,.4)",
          }}>Amelia</div>
          <div style={{ fontSize:11, color:"#c9a84c", letterSpacing:5, textTransform:"uppercase",
            fontWeight:600, marginBottom:6,
          }}>Convention Hall</div>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"18px 0 0" }}>
            <div style={{ flex:1, height:1, background:"linear-gradient(90deg, transparent, rgba(201,168,76,.35))" }} />
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#c9a84c", opacity:.7 }} />
            <div style={{ flex:1, height:1, background:"linear-gradient(90deg, rgba(201,168,76,.35), transparent)" }} />
          </div>
        </div>

        {/* Form section */}
        <div style={{ padding:"0 36px 32px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"rgba(242,223,192,.6)", letterSpacing:.5,
            textAlign:"center", marginBottom:22, textTransform:"uppercase", fontSize:10, letterSpacing:2,
          }}>Staff Sign In</div>

          <form onSubmit={doLogin}>
            {/* Username */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"rgba(201,168,76,.7)", textTransform:"uppercase",
                letterSpacing:1.2, marginBottom:7,
              }}>Username</div>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)",
                  fontSize:14, opacity:.5,
                }}>👤</span>
                <input
                  type="text" value={user}
                  onChange={e => { setUser(e.target.value); setErr(""); }}
                  placeholder="Enter username"
                  autoComplete="off"
                  style={{
                    width:"100%", boxSizing:"border-box",
                    padding:"13px 14px 13px 38px",
                    background:"rgba(255,255,255,.07)",
                    border:"1.5px solid rgba(201,168,76,.2)",
                    borderRadius:11, color:"#f2dfc0", fontSize:14,
                    fontFamily:"inherit", outline:"none",
                    transition:"border-color .2s, background .2s, box-shadow .2s",
                  }}
                  onFocus={e => { e.target.style.borderColor="#c9a84c"; e.target.style.background="rgba(255,255,255,.11)"; e.target.style.boxShadow="0 0 0 3px rgba(201,168,76,.12)"; }}
                  onBlur={e  => { e.target.style.borderColor="rgba(201,168,76,.2)"; e.target.style.background="rgba(255,255,255,.07)"; e.target.style.boxShadow="none"; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom:22 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"rgba(201,168,76,.7)", textTransform:"uppercase",
                letterSpacing:1.2, marginBottom:7,
              }}>Password</div>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)",
                  fontSize:14, opacity:.5,
                }}>🔒</span>
                <input
                  type={showPass ? "text" : "password"} value={pass}
                  onChange={e => { setPass(e.target.value); setErr(""); }}
                  placeholder="Enter password"
                  style={{
                    width:"100%", boxSizing:"border-box",
                    padding:"13px 44px 13px 38px",
                    background:"rgba(255,255,255,.07)",
                    border:"1.5px solid rgba(201,168,76,.2)",
                    borderRadius:11, color:"#f2dfc0", fontSize:14,
                    fontFamily:"inherit", outline:"none",
                    transition:"border-color .2s, background .2s, box-shadow .2s",
                  }}
                  onFocus={e => { e.target.style.borderColor="#c9a84c"; e.target.style.background="rgba(255,255,255,.11)"; e.target.style.boxShadow="0 0 0 3px rgba(201,168,76,.12)"; }}
                  onBlur={e  => { e.target.style.borderColor="rgba(201,168,76,.2)"; e.target.style.background="rgba(255,255,255,.07)"; e.target.style.boxShadow="none"; }}
                />
                <button type="button" onClick={()=>setShowPass(v=>!v)} style={{
                  position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", fontSize:14, opacity:.5, padding:2,
                  color:"#f2dfc0",
                }}>{showPass ? "🙈" : "👁"}</button>
              </div>
            </div>

            {/* Error */}
            {err && (
              <div style={{
                marginBottom:14, padding:"10px 14px", borderRadius:9,
                background:"rgba(192,57,43,.2)", border:"1px solid rgba(192,57,43,.45)",
                color:"#fca5a5", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:7,
              }}>
                <span>⚠️</span> {err}
              </div>
            )}

            {/* Sign In button */}
            <button type="submit" style={{
              width:"100%", padding:"14px",
              background:"linear-gradient(135deg, #9a7a20, #c9a84c, #e8c96c, #c9a84c)",
              backgroundSize:"200% 100%",
              border:"none", borderRadius:11,
              fontWeight:800, fontSize:14, color:"#1a0a00",
              cursor:"pointer", fontFamily:"inherit",
              letterSpacing:1.5, textTransform:"uppercase",
              boxShadow:"0 4px 20px rgba(201,168,76,.35), inset 0 1px 0 rgba(255,255,255,.25)",
              transition:"opacity .2s, transform .15s, box-shadow .2s",
            }}
            onMouseEnter={e => { e.target.style.opacity=".92"; e.target.style.transform="translateY(-1px)"; e.target.style.boxShadow="0 8px 28px rgba(201,168,76,.45), inset 0 1px 0 rgba(255,255,255,.25)"; }}
            onMouseLeave={e => { e.target.style.opacity="1"; e.target.style.transform=""; e.target.style.boxShadow="0 4px 20px rgba(201,168,76,.35), inset 0 1px 0 rgba(255,255,255,.25)"; }}
            >
              Sign In
            </button>
          </form>

          {/* Hint */}
          <div style={{ textAlign:"center", marginTop:16, fontSize:11, color:"rgba(242,223,192,.35)", lineHeight:1.5 }}>
            Use your assigned credentials to access the system
          </div>

          {/* Divider */}
          <div style={{ height:1, background:"rgba(201,168,76,.12)", margin:"20px 0" }} />

          {/* Switch to Hotel */}
          <button onClick={onSwitchApp} style={{
            width:"100%", padding:"11px",
            background:"transparent",
            border:"1px solid rgba(201,168,76,.25)", borderRadius:10,
            color:"rgba(201,168,76,.75)", fontSize:12, fontWeight:700,
            cursor:"pointer", fontFamily:"inherit", letterSpacing:.5,
            transition:"border-color .2s, color .2s, background .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(201,168,76,.5)"; e.currentTarget.style.color="#c9a84c"; e.currentTarget.style.background="rgba(201,168,76,.06)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(201,168,76,.25)"; e.currentTarget.style.color="rgba(201,168,76,.75)"; e.currentTarget.style.background="transparent"; }}
          >
            ⇄ Switch to Hotel
          </button>
        </div>

        {/* Bottom accent */}
        <div style={{ height:3, background:"linear-gradient(90deg, #8B1A1A, rgba(201,168,76,.4), #8B1A1A)" }} />
      </div>
    </div>
  );
}
