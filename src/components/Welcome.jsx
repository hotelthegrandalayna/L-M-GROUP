import { useState, useEffect } from "react";

export default function Welcome({ onChoose }) {
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#0e0720 0%,#1a0e3a 40%,#0f1a30 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative", overflow: "hidden",
      fontFamily: "'DM Sans',sans-serif",
    }}>

      <style>{`
        @keyframes drift1 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(30px,-40px) scale(1.12)} }
        @keyframes drift2 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(-25px,35px) scale(1.08)} }
        @keyframes drift3 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(20px,28px) scale(1.15)} }
        @keyframes drift4 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(-18px,-24px) scale(1.06)} }
        @keyframes shimmer { 0%{opacity:.5} 50%{opacity:1} 100%{opacity:.5} }
        @keyframes rotateBorder {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.4)} 50%{box-shadow:0 0 0 12px rgba(201,168,76,0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        @keyframes starTwinkle { 0%,100%{opacity:.15} 50%{opacity:.7} }
        .card-hotel:hover  { transform: translateY(-10px) scale(1.03) !important; }
        .card-hall:hover   { transform: translateY(-10px) scale(1.03) !important; }
      `}</style>

      {/* Star field */}
      {Array.from({length:40}).map((_,i) => (
        <div key={i} style={{
          position:"absolute",
          width: i%5===0 ? 2.5 : i%3===0 ? 1.5 : 1,
          height: i%5===0 ? 2.5 : i%3===0 ? 1.5 : 1,
          borderRadius:"50%",
          background:"#fff",
          top: `${(i*73+17)%98}%`,
          left: `${(i*47+11)%98}%`,
          animation: `starTwinkle ${2+(i%4)}s ease-in-out infinite`,
          animationDelay: `${(i*0.3)%4}s`,
          pointerEvents:"none",
        }} />
      ))}

      {/* Ambient glow orbs */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <div style={{ position:"absolute", width:700, height:700, top:"-20%", left:"-15%", borderRadius:"50%", background:"radial-gradient(circle,rgba(80,30,180,.22) 0%,transparent 65%)", animation:"drift1 11s ease-in-out infinite alternate" }} />
        <div style={{ position:"absolute", width:500, height:500, bottom:"-10%", right:"-10%", borderRadius:"50%", background:"radial-gradient(circle,rgba(201,168,76,.13) 0%,transparent 65%)", animation:"drift2 14s ease-in-out infinite alternate" }} />
        <div style={{ position:"absolute", width:400, height:400, top:"40%", right:"20%", borderRadius:"50%", background:"radial-gradient(circle,rgba(20,80,160,.18) 0%,transparent 65%)", animation:"drift3 9s ease-in-out infinite alternate" }} />
        <div style={{ position:"absolute", width:300, height:300, bottom:"20%", left:"15%", borderRadius:"50%", background:"radial-gradient(circle,rgba(201,168,76,.08) 0%,transparent 65%)", animation:"drift4 13s ease-in-out infinite alternate" }} />
      </div>

      {/* Fine grid */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"linear-gradient(rgba(201,168,76,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.03) 1px,transparent 1px)", backgroundSize:"80px 80px" }} />

      {/* ── Main content ── */}
      <div style={{
        position:"relative", zIndex:2, textAlign:"center", width:"100%",
        animation: visible ? "fadeUp .9s ease forwards" : "none",
        opacity: visible ? undefined : 0,
      }}>

        {/* Monogram */}
        <div style={{ marginBottom:18, display:"flex", justifyContent:"center" }}>
          <div style={{
            position:"relative", width:90, height:90,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {/* Rotating ring */}
            <div style={{
              position:"absolute", inset:-3, borderRadius:"50%",
              background:"conic-gradient(from 0deg, transparent 60%, rgba(201,168,76,.8) 75%, transparent 90%)",
              animation:"rotateBorder 6s linear infinite",
            }} />
            <div style={{
              position:"absolute", inset:0, borderRadius:"50%",
              background:"linear-gradient(135deg,#1a0e3a,#0e0720)",
              border:"1.5px solid rgba(201,168,76,.3)",
              animation:"pulse 3s ease-in-out infinite",
            }} />
            <span style={{
              position:"relative", zIndex:1,
              fontFamily:"'Playfair Display',Georgia,serif",
              fontSize:28, fontWeight:700, color:"#e8d5a0", letterSpacing:1, lineHeight:1,
            }}>L<span style={{ color:"#c9a84c", fontSize:22 }}>&amp;</span>M</span>
          </div>
        </div>

        {/* Title */}
        <div style={{
          fontSize:52, fontWeight:800,
          fontFamily:"'Playfair Display',Georgia,serif",
          background:"linear-gradient(135deg,#f5e6c0 0%,#c9a84c 50%,#f5e6c0 100%)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          backgroundClip:"text",
          letterSpacing:2, lineHeight:1.1, marginBottom:10,
          filter:"drop-shadow(0 2px 20px rgba(201,168,76,.3))",
        }}>L&amp;M Group</div>

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:8 }}>
          <div style={{ width:80, height:1, background:"linear-gradient(90deg,transparent,rgba(201,168,76,.6))" }} />
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <div style={{ width:4, height:4, borderRadius:"50%", background:"rgba(201,168,76,.5)" }} />
            <span style={{ fontSize:11, color:"rgba(201,168,76,.85)", letterSpacing:5, textTransform:"uppercase", fontWeight:600 }}>Hospitality</span>
            <div style={{ width:4, height:4, borderRadius:"50%", background:"rgba(201,168,76,.5)" }} />
          </div>
          <div style={{ width:80, height:1, background:"linear-gradient(90deg,rgba(201,168,76,.6),transparent)" }} />
        </div>

        <div style={{ fontSize:12, color:"rgba(232,213,160,.4)", letterSpacing:4, textTransform:"uppercase", marginBottom:52 }}>
          Select a system to continue
        </div>

        {/* ── Cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:28, maxWidth:740, margin:"0 auto" }}>

          {/* Hotel card — warm gold/purple */}
          <button
            className="card-hotel"
            onClick={() => onChoose("hotel")}
            onMouseEnter={() => setHovered("hotel")}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding:"44px 32px 36px",
              background: hovered==="hotel"
                ? "linear-gradient(155deg,rgba(120,70,20,.5) 0%,rgba(60,20,100,.6) 60%,rgba(20,10,50,.7) 100%)"
                : "linear-gradient(155deg,rgba(80,40,10,.3) 0%,rgba(40,15,80,.35) 60%,rgba(15,8,35,.4) 100%)",
              border: `1.5px solid ${hovered==="hotel" ? "rgba(201,168,76,.7)" : "rgba(201,168,76,.2)"}`,
              borderRadius:24, cursor:"pointer", textAlign:"center",
              transition:"all .35s cubic-bezier(.4,0,.2,1)",
              fontFamily:"inherit",
              transform: "translateY(0) scale(1)",
              boxShadow: hovered==="hotel"
                ? "0 30px 80px rgba(0,0,0,.6), 0 0 60px rgba(201,100,0,.12), inset 0 1px 0 rgba(201,168,76,.25)"
                : "0 8px 40px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)",
              backdropFilter:"blur(16px)",
              position:"relative", overflow:"hidden",
            }}>

            {/* Gold top accent line */}
            <div style={{
              position:"absolute", top:0, left:"20%", right:"20%", height:2,
              background:"linear-gradient(90deg,transparent,rgba(201,168,76,.8),transparent)",
              opacity: hovered==="hotel" ? 1 : 0.4, transition:"opacity .3s",
            }} />

            {/* Icon circle */}
            <div style={{
              display:"inline-flex", alignItems:"center", justifyContent:"center",
              width:90, height:90, borderRadius:"50%", marginBottom:22,
              background: hovered==="hotel"
                ? "linear-gradient(135deg,rgba(201,140,40,.25),rgba(120,60,200,.2))"
                : "linear-gradient(135deg,rgba(201,140,40,.12),rgba(80,30,150,.12))",
              border:`1.5px solid ${hovered==="hotel" ? "rgba(201,168,76,.6)" : "rgba(201,168,76,.2)"}`,
              boxShadow: hovered==="hotel" ? "0 0 30px rgba(201,140,40,.25)" : "none",
              transition:"all .35s",
            }}>
              {/* Hotel SVG */}
              <svg viewBox="0 0 56 56" width="46" height="46" fill="none">
                <rect x="6" y="22" width="44" height="30" rx="2" fill="rgba(201,168,76,.15)" stroke="#c9a84c" strokeWidth="1.4"/>
                <polygon points="3,24 28,8 53,24" fill="rgba(201,168,76,.2)" stroke="#c9a84c" strokeWidth="1.4"/>
                <rect x="14" y="30" width="7" height="7" rx="1" fill="#c9a84c" opacity=".6"/>
                <rect x="25" y="30" width="7" height="7" rx="1" fill="#c9a84c" opacity=".6"/>
                <rect x="36" y="30" width="7" height="7" rx="1" fill="#c9a84c" opacity=".6"/>
                <rect x="22" y="40" width="12" height="12" rx="1" fill="#c9a84c" opacity=".35"/>
                <circle cx="28" cy="8" r="2.5" fill="#c9a84c" opacity=".9"/>
                <line x1="28" y1="5" x2="28" y2="12" stroke="#c9a84c" strokeWidth="1.2"/>
              </svg>
            </div>

            <div style={{
              fontSize:24, fontWeight:700, color:"#f0e4c8",
              fontFamily:"'Playfair Display',Georgia,serif",
              marginBottom:6, letterSpacing:.5,
              textShadow: hovered==="hotel" ? "0 0 20px rgba(201,168,76,.4)" : "none",
              transition:"text-shadow .3s",
            }}>Hotel</div>

            <div style={{ fontSize:10, color:"#c9a84c", letterSpacing:4, textTransform:"uppercase", fontWeight:700, marginBottom:16 }}>
              The Grand Alayna
            </div>

            <div style={{
              fontSize:12, color:"rgba(232,213,160,.45)",
              borderTop:"1px solid rgba(201,168,76,.15)", paddingTop:14,
              letterSpacing:.5,
            }}>Rooms · Bookings · Invoices</div>

            <div style={{
              marginTop:16, fontSize:20, color:"#c9a84c",
              opacity: hovered==="hotel" ? 1 : 0,
              transform: hovered==="hotel" ? "translateX(0)" : "translateX(-10px)",
              transition:"all .3s",
            }}>→</div>
          </button>

          {/* Hall card — cool blue/teal */}
          <button
            className="card-hall"
            onClick={() => onChoose("hall")}
            onMouseEnter={() => setHovered("hall")}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding:"44px 32px 36px",
              background: hovered==="hall"
                ? "linear-gradient(155deg,rgba(10,60,100,.6) 0%,rgba(10,40,80,.65) 60%,rgba(5,20,50,.7) 100%)"
                : "linear-gradient(155deg,rgba(10,40,80,.3) 0%,rgba(5,25,60,.35) 60%,rgba(5,15,40,.4) 100%)",
              border: `1.5px solid ${hovered==="hall" ? "rgba(80,180,220,.7)" : "rgba(80,160,200,.2)"}`,
              borderRadius:24, cursor:"pointer", textAlign:"center",
              transition:"all .35s cubic-bezier(.4,0,.2,1)",
              fontFamily:"inherit",
              transform: "translateY(0) scale(1)",
              boxShadow: hovered==="hall"
                ? "0 30px 80px rgba(0,0,0,.6), 0 0 60px rgba(30,100,180,.15), inset 0 1px 0 rgba(80,180,220,.2)"
                : "0 8px 40px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)",
              backdropFilter:"blur(16px)",
              position:"relative", overflow:"hidden",
            }}>

            {/* Blue top accent line */}
            <div style={{
              position:"absolute", top:0, left:"20%", right:"20%", height:2,
              background:"linear-gradient(90deg,transparent,rgba(80,180,220,.8),transparent)",
              opacity: hovered==="hall" ? 1 : 0.3, transition:"opacity .3s",
            }} />

            {/* Icon circle */}
            <div style={{
              display:"inline-flex", alignItems:"center", justifyContent:"center",
              width:90, height:90, borderRadius:"50%", marginBottom:22,
              background: hovered==="hall"
                ? "linear-gradient(135deg,rgba(30,100,180,.3),rgba(10,60,120,.25))"
                : "linear-gradient(135deg,rgba(30,80,150,.15),rgba(10,40,100,.12))",
              border:`1.5px solid ${hovered==="hall" ? "rgba(80,180,220,.6)" : "rgba(80,160,200,.2)"}`,
              boxShadow: hovered==="hall" ? "0 0 30px rgba(40,140,200,.25)" : "none",
              transition:"all .35s",
            }}>
              {/* Hall SVG */}
              <svg viewBox="0 0 56 56" width="46" height="46" fill="none">
                <rect x="4" y="24" width="48" height="28" rx="2" fill="rgba(80,160,220,.12)" stroke="rgba(80,180,220,.8)" strokeWidth="1.4"/>
                <path d="M4 32 Q28 18 52 32" stroke="rgba(80,180,220,.8)" strokeWidth="1.4" fill="none"/>
                <ellipse cx="16" cy="38" rx="5" ry="5" fill="rgba(80,160,220,.25)" stroke="rgba(80,180,220,.7)" strokeWidth="1"/>
                <ellipse cx="28" cy="35" rx="5" ry="5" fill="rgba(80,160,220,.25)" stroke="rgba(80,180,220,.7)" strokeWidth="1"/>
                <ellipse cx="40" cy="38" rx="5" ry="5" fill="rgba(80,160,220,.25)" stroke="rgba(80,180,220,.7)" strokeWidth="1"/>
                <path d="M6 24 L28 10 L50 24" fill="rgba(80,160,220,.15)" stroke="rgba(80,180,220,.7)" strokeWidth="1.4"/>
                <rect x="24" y="10" width="8" height="14" rx="1" fill="rgba(80,160,220,.2)"/>
                <line x1="12" y1="52" x2="16" y2="43" stroke="rgba(80,180,220,.5)" strokeWidth="1"/>
                <line x1="44" y1="52" x2="40" y2="43" stroke="rgba(80,180,220,.5)" strokeWidth="1"/>
                <line x1="24" y1="52" x2="28" y2="40" stroke="rgba(80,180,220,.5)" strokeWidth="1"/>
              </svg>
            </div>

            <div style={{
              fontSize:24, fontWeight:700, color:"#dceeff",
              fontFamily:"'Playfair Display',Georgia,serif",
              marginBottom:6, letterSpacing:.5,
              textShadow: hovered==="hall" ? "0 0 20px rgba(80,180,220,.4)" : "none",
              transition:"text-shadow .3s",
            }}>Convention Hall</div>

            <div style={{ fontSize:10, color:"rgba(80,200,240,.9)", letterSpacing:4, textTransform:"uppercase", fontWeight:700, marginBottom:16 }}>
              Amelia
            </div>

            <div style={{
              fontSize:12, color:"rgba(180,220,255,.4)",
              borderTop:"1px solid rgba(80,160,200,.15)", paddingTop:14,
              letterSpacing:.5,
            }}>Events · Bookings · Calendar</div>

            <div style={{
              marginTop:16, fontSize:20, color:"rgba(80,200,240,.9)",
              opacity: hovered==="hall" ? 1 : 0,
              transform: hovered==="hall" ? "translateX(0)" : "translateX(-10px)",
              transition:"all .3s",
            }}>→</div>
          </button>
        </div>

        {/* Footer */}
        <div style={{ marginTop:48, fontSize:10, color:"rgba(201,168,76,.25)", letterSpacing:3, textTransform:"uppercase" }}>
          L&amp;M Group · Hospitality Management System
        </div>
      </div>
    </div>
  );
}
