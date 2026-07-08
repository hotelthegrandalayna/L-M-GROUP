import { useState, useEffect } from "react";

/* ── Staff portal (original two-card picker) ── */
function StaffPortal({ onChoose, onBack }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(160deg,#0e0720 0%,#1a0e3a 40%,#0f1a30 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:24, position:"relative", overflow:"hidden",
      fontFamily:"'DM Sans',sans-serif",
    }}>
      <style>{`
        @keyframes rotateBorder{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.4)}50%{box-shadow:0 0 0 12px rgba(201,168,76,0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}
        @keyframes starTwinkle{0%,100%{opacity:.15}50%{opacity:.7}}
        .sp-card:hover{transform:translateY(-10px) scale(1.03)!important}
      `}</style>
      {Array.from({length:40}).map((_,i)=>(
        <div key={i} style={{position:"absolute",width:i%5===0?2.5:i%3===0?1.5:1,height:i%5===0?2.5:i%3===0?1.5:1,borderRadius:"50%",background:"#fff",top:`${(i*73+17)%98}%`,left:`${(i*47+11)%98}%`,animation:`starTwinkle ${2+(i%4)}s ease-in-out infinite`,animationDelay:`${(i*0.3)%4}s`,pointerEvents:"none"}} />
      ))}
      <div style={{position:"relative",zIndex:2,textAlign:"center",width:"100%",animation:"fadeUp .9s ease forwards"}}>
        <div style={{marginBottom:18,display:"flex",justifyContent:"center"}}>
          <div style={{position:"relative",width:90,height:90,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{position:"absolute",inset:-3,borderRadius:"50%",background:"conic-gradient(from 0deg,transparent 60%,rgba(201,168,76,.8) 75%,transparent 90%)",animation:"rotateBorder 6s linear infinite"}} />
            <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"linear-gradient(135deg,#1a0e3a,#0e0720)",border:"1.5px solid rgba(201,168,76,.3)",animation:"pulse 3s ease-in-out infinite"}} />
            <span style={{position:"relative",zIndex:1,fontFamily:"'Playfair Display',Georgia,serif",fontSize:28,fontWeight:700,color:"#e8d5a0",letterSpacing:1,lineHeight:1}}>L<span style={{color:"#c9a84c",fontSize:22}}>&amp;</span>M</span>
          </div>
        </div>
        <div style={{fontSize:42,fontWeight:800,fontFamily:"'Playfair Display',Georgia,serif",background:"linear-gradient(135deg,#f5e6c0 0%,#c9a84c 50%,#f5e6c0 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:2,lineHeight:1.1,marginBottom:8}}>Staff Portal</div>
        <div style={{fontSize:12,color:"rgba(232,213,160,.4)",letterSpacing:4,textTransform:"uppercase",marginBottom:40}}>Select your system</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,maxWidth:640,margin:"0 auto"}}>
          <button className="sp-card" onClick={()=>onChoose("hotel")} onMouseEnter={()=>setHovered("hotel")} onMouseLeave={()=>setHovered(null)} style={{padding:"40px 28px 32px",background:hovered==="hotel"?"linear-gradient(155deg,rgba(120,70,20,.5),rgba(60,20,100,.6),rgba(20,10,50,.7))":"linear-gradient(155deg,rgba(80,40,10,.3),rgba(40,15,80,.35),rgba(15,8,35,.4))",border:`1.5px solid ${hovered==="hotel"?"rgba(201,168,76,.7)":"rgba(201,168,76,.2)"}`,borderRadius:20,cursor:"pointer",textAlign:"center",transition:"all .35s cubic-bezier(.4,0,.2,1)",fontFamily:"inherit",transform:"translateY(0) scale(1)",boxShadow:hovered==="hotel"?"0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(201,168,76,.25)":"0 8px 40px rgba(0,0,0,.4)",backdropFilter:"blur(16px)"}}>
            <div style={{fontSize:40,marginBottom:12}}>🏨</div>
            <div style={{fontSize:22,fontWeight:700,color:"#f0e4c8",fontFamily:"'Playfair Display',Georgia,serif",marginBottom:4}}>Hotel</div>
            <div style={{fontSize:10,color:"#c9a84c",letterSpacing:4,textTransform:"uppercase",fontWeight:700,marginBottom:12}}>The Grand Alayna</div>
            <div style={{fontSize:11,color:"rgba(232,213,160,.45)",borderTop:"1px solid rgba(201,168,76,.15)",paddingTop:12}}>Rooms · Bookings · Invoices</div>
          </button>
          <button className="sp-card" onClick={()=>onChoose("hall")} onMouseEnter={()=>setHovered("hall")} onMouseLeave={()=>setHovered(null)} style={{padding:"40px 28px 32px",background:hovered==="hall"?"linear-gradient(155deg,rgba(10,60,100,.6),rgba(10,40,80,.65),rgba(5,20,50,.7))":"linear-gradient(155deg,rgba(10,40,80,.3),rgba(5,25,60,.35),rgba(5,15,40,.4))",border:`1.5px solid ${hovered==="hall"?"rgba(80,180,220,.7)":"rgba(80,160,200,.2)"}`,borderRadius:20,cursor:"pointer",textAlign:"center",transition:"all .35s cubic-bezier(.4,0,.2,1)",fontFamily:"inherit",transform:"translateY(0) scale(1)",boxShadow:hovered==="hall"?"0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(80,180,220,.2)":"0 8px 40px rgba(0,0,0,.4)",backdropFilter:"blur(16px)"}}>
            <div style={{fontSize:40,marginBottom:12}}>🏛️</div>
            <div style={{fontSize:22,fontWeight:700,color:"#dceeff",fontFamily:"'Playfair Display',Georgia,serif",marginBottom:4}}>Convention Hall</div>
            <div style={{fontSize:10,color:"rgba(80,200,240,.9)",letterSpacing:4,textTransform:"uppercase",fontWeight:700,marginBottom:12}}>Amelia</div>
            <div style={{fontSize:11,color:"rgba(180,220,255,.4)",borderTop:"1px solid rgba(80,160,200,.15)",paddingTop:12}}>Events · Bookings · Calendar</div>
          </button>
        </div>
        <button onClick={onBack} style={{marginTop:32,background:"none",border:"none",color:"rgba(201,168,76,.5)",fontSize:12,cursor:"pointer",letterSpacing:2,textTransform:"uppercase"}}>← Back to Website</button>
      </div>
    </div>
  );
}

/* ── Public marketing landing page ── */
export default function Welcome({ onChoose }) {
  const [showPortal, setShowPortal] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (showPortal) return <StaffPortal onChoose={onChoose} onBack={() => setShowPortal(false)} />;

  const gold = "#c9a84c";

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", color:"#222", overflowX:"hidden" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        .lp-cta:hover{background:#b8943e!important;transform:translateY(-2px)!important;box-shadow:0 8px 30px rgba(201,168,76,.4)!important}
        .lp-room-card:hover{transform:translateY(-6px)!important;box-shadow:0 20px 50px rgba(0,0,0,.15)!important}
        .lp-room-card:hover .room-btn{background:#c9a84c!important;color:#fff!important}
        .lp-amen:hover{border-color:#c9a84c!important;transform:translateY(-3px)!important}
        @media(max-width:700px){
          .lp-hero-title{font-size:36px!important}
          .lp-rooms-grid{grid-template-columns:1fr!important}
          .lp-amen-grid{grid-template-columns:1fr 1fr!important}
          .lp-contact-grid{grid-template-columns:1fr!important}
          .lp-nav-links{display:none!important}
          .lp-stats{flex-direction:column!important;gap:16px!important}
          .lp-stats>div{border-right:none!important;border-bottom:1px solid rgba(255,255,255,.1)!important;padding-bottom:12px!important}
        }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:100,
        background:scrollY>60?"rgba(14,7,32,.97)":"transparent",
        backdropFilter:scrollY>60?"blur(16px)":"none",
        borderBottom:scrollY>60?"1px solid rgba(201,168,76,.15)":"none",
        transition:"all .4s",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 32px",height:64,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:22,fontWeight:700,color:gold,letterSpacing:1}}>L&amp;M</span>
          <span style={{fontSize:13,color:"rgba(255,255,255,.55)",fontWeight:500}}>Hotel The Grand Alayna</span>
        </div>
        <div className="lp-nav-links" style={{display:"flex",gap:4}}>
          {["Rooms","Amenities","Location","Contact"].map(label=>(
            <a key={label} href={`#${label.toLowerCase()}`} style={{color:"rgba(255,255,255,.7)",textDecoration:"none",fontSize:13,fontWeight:500,padding:"6px 16px",borderRadius:20,transition:"all .2s",letterSpacing:.5}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,168,76,.15)";e.currentTarget.style.color="#c9a84c";}}
              onMouseLeave={e=>{e.currentTarget.style.background="";e.currentTarget.style.color="rgba(255,255,255,.7)";}}>
              {label}
            </a>
          ))}
        </div>
        <button onClick={()=>setShowPortal(true)} style={{
          background:"rgba(201,168,76,.15)",border:"1px solid rgba(201,168,76,.4)",
          color:gold,fontSize:12,fontWeight:600,letterSpacing:1,
          padding:"8px 18px",borderRadius:20,cursor:"pointer",transition:"all .2s",
        }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(201,168,76,.3)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(201,168,76,.15)"}>
          Staff Login
        </button>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight:"100vh",
        background:"linear-gradient(160deg,#0e0720 0%,#1a0e3a 45%,#0f1a30 100%)",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        textAlign:"center",padding:"80px 24px 60px",position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",width:600,height:600,top:"-15%",left:"-10%",borderRadius:"50%",background:"radial-gradient(circle,rgba(80,30,180,.2) 0%,transparent 65%)",pointerEvents:"none"}} />
        <div style={{position:"absolute",width:400,height:400,bottom:"-10%",right:"-5%",borderRadius:"50%",background:"radial-gradient(circle,rgba(201,168,76,.1) 0%,transparent 65%)",pointerEvents:"none"}} />
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(201,168,76,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.025) 1px,transparent 1px)",backgroundSize:"80px 80px",pointerEvents:"none"}} />
        <div style={{position:"relative",zIndex:2,animation:"fadeUp 1s ease forwards",maxWidth:780}}>
          <div style={{display:"inline-block",background:"rgba(201,168,76,.12)",border:"1px solid rgba(201,168,76,.3)",borderRadius:30,padding:"6px 20px",fontSize:11,color:gold,letterSpacing:4,textTransform:"uppercase",fontWeight:600,marginBottom:28}}>
            ✦ Sitakund, Chittagong, Bangladesh ✦
          </div>
          <h1 className="lp-hero-title" style={{fontSize:58,fontWeight:800,fontFamily:"'Playfair Display',Georgia,serif",color:"#fff",lineHeight:1.1,margin:"0 0 10px"}}>
            Hotel The<br/>
            <span style={{background:"linear-gradient(135deg,#f5e6c0,#c9a84c,#f5e6c0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Grand Alayna</span>
          </h1>
          <p style={{fontSize:16,color:"rgba(232,213,160,.65)",lineHeight:1.7,maxWidth:560,margin:"18px auto 36px"}}>
            Experience premium comfort in the heart of Sitakund. AC &amp; Non-AC rooms, breathtaking views, and warm Bangladeshi hospitality — perfect for business and leisure.
          </p>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <a href="tel:+8801883352526" className="lp-cta" style={{display:"inline-flex",alignItems:"center",gap:8,background:gold,color:"#0e0720",fontWeight:700,fontSize:14,padding:"14px 28px",borderRadius:30,textDecoration:"none",transition:"all .25s",boxShadow:"0 4px 20px rgba(201,168,76,.3)",letterSpacing:.5}}>
              📞 Call to Book: +880 1883-352526
            </a>
            <a href="#rooms" style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.08)",border:"1.5px solid rgba(255,255,255,.2)",color:"#fff",fontWeight:600,fontSize:14,padding:"14px 28px",borderRadius:30,textDecoration:"none",transition:"all .25s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}>
              View Rooms →
            </a>
          </div>
          <div className="lp-stats" style={{display:"flex",justifyContent:"center",gap:0,marginTop:56,flexWrap:"wrap"}}>
            {[["24/7","Front Desk"],["AC & Non-AC","Room Types"],["Sitakund","Eco Park Nearby"],["bKash / Nagad","Payments Accepted"]].map(([val,lbl],i)=>(
              <div key={i} style={{padding:"0 28px",borderRight:i<3?"1px solid rgba(255,255,255,.1)":undefined,textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:700,color:gold,fontFamily:"'Playfair Display',Georgia,serif"}}>{val}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:2,letterSpacing:.5}}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROOMS */}
      <section id="rooms" style={{background:"#fafaf8",padding:"80px 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:56}}>
            <div style={{fontSize:11,color:gold,letterSpacing:5,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Accommodation</div>
            <h2 style={{fontSize:38,fontWeight:800,fontFamily:"'Playfair Display',Georgia,serif",color:"#1a1a2e",margin:0}}>Our Rooms</h2>
            <p style={{fontSize:14,color:"#666",marginTop:10,maxWidth:500,marginLeft:"auto",marginRight:"auto"}}>Comfortable, clean, and well-equipped rooms for every type of traveller</p>
          </div>
          <div className="lp-rooms-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:28}}>
            {[
              {name:"Standard Non-AC",icon:"🛏️",price:"From ৳1,200/night",color:"#4a6741",features:["Fan & ceiling light","Private bathroom","Free Wi-Fi","TV & charging points"],badge:null},
              {name:"Standard AC Room",icon:"❄️",price:"From ৳2,000/night",color:"#c9a84c",features:["Split AC unit","Private bathroom","Free Wi-Fi","TV & mini fridge"],badge:"Most Popular"},
              {name:"Deluxe AC Room",icon:"⭐",price:"From ৳2,800/night",color:"#9b59b6",features:["Premium split AC","En-suite bathroom","Free Wi-Fi","Smart TV, sofa & work desk"],badge:"Best View"},
            ].map((room,i)=>(
              <div key={i} className="lp-room-card" style={{background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.07)",transition:"all .3s",position:"relative"}}>
                {room.badge&&<div style={{position:"absolute",top:16,right:16,background:room.color,color:"#fff",fontSize:10,fontWeight:700,letterSpacing:1,padding:"4px 10px",borderRadius:20,textTransform:"uppercase"}}>{room.badge}</div>}
                <div style={{background:`linear-gradient(135deg,${room.color}22,${room.color}11)`,padding:"36px 28px 24px",textAlign:"center",borderBottom:"1px solid #f0f0f0"}}>
                  <div style={{fontSize:48,marginBottom:12}}>{room.icon}</div>
                  <h3 style={{fontSize:20,fontWeight:700,color:"#1a1a2e",margin:"0 0 4px",fontFamily:"'Playfair Display',Georgia,serif"}}>{room.name}</h3>
                  <div style={{fontSize:13,fontWeight:600,color:room.color}}>{room.price}</div>
                </div>
                <div style={{padding:"24px 28px 28px"}}>
                  <ul style={{listStyle:"none",margin:0,padding:0,display:"flex",flexDirection:"column",gap:10}}>
                    {room.features.map((f,j)=>(
                      <li key={j} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,color:"#444"}}>
                        <span style={{width:18,height:18,borderRadius:"50%",background:`${room.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:room.color,flexShrink:0}}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a href="tel:+8801883352526" className="room-btn" style={{display:"block",marginTop:22,textAlign:"center",padding:"11px 0",borderRadius:12,border:`1.5px solid ${room.color}`,color:room.color,fontWeight:600,fontSize:13,textDecoration:"none",transition:"all .2s",letterSpacing:.3}}>
                    Book This Room
                  </a>
                </div>
              </div>
            ))}
          </div>
          <p style={{textAlign:"center",marginTop:28,fontSize:13,color:"#888"}}>
            Call <a href="tel:+8801883352526" style={{color:gold,fontWeight:600}}>+880 1883-352526</a> for group bookings, special rates, or availability enquiries.
          </p>
        </div>
      </section>

      {/* AMENITIES */}
      <section id="amenities" style={{background:"linear-gradient(160deg,#0e0720,#1a0e3a,#0f1a30)",padding:"80px 24px"}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:52}}>
            <div style={{fontSize:11,color:gold,letterSpacing:5,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Why Choose Us</div>
            <h2 style={{fontSize:38,fontWeight:800,fontFamily:"'Playfair Display',Georgia,serif",color:"#fff",margin:0}}>Hotel Amenities</h2>
          </div>
          <div className="lp-amen-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
            {[
              ["🌐","Free Wi-Fi","High-speed internet in all rooms & common areas"],
              ["❄️","Air Conditioning","Split AC units with individual temperature control"],
              ["📺","Cable TV","Local & satellite channels in every room"],
              ["🅿️","Free Parking","Secure on-site parking for guests"],
              ["🔒","24/7 Security","Round-the-clock security & front desk service"],
              ["🚿","Hot Water","Hot water available in all bathrooms"],
              ["🍳","Room Service","Meals & snacks delivered to your room"],
              ["🏞️","Scenic Views","Overlooking the beautiful Sitakund landscape"],
            ].map(([icon,title,desc],i)=>(
              <div key={i} className="lp-amen" style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"24px 18px",textAlign:"center",transition:"all .3s",cursor:"default"}}>
                <div style={{fontSize:32,marginBottom:10}}>{icon}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:6}}>{title}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.45)",lineHeight:1.5}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LOCATION */}
      <section id="location" style={{background:"#fff",padding:"80px 24px"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:48}}>
            <div style={{fontSize:11,color:gold,letterSpacing:5,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Where We Are</div>
            <h2 style={{fontSize:38,fontWeight:800,fontFamily:"'Playfair Display',Georgia,serif",color:"#1a1a2e",margin:0}}>Our Location</h2>
          </div>
          <div style={{background:"linear-gradient(135deg,#fdf8ee,#fff8e6)",border:"1.5px solid rgba(201,168,76,.2)",borderRadius:24,padding:"40px 48px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:16}}>📍</div>
            <h3 style={{fontSize:24,fontWeight:700,fontFamily:"'Playfair Display',Georgia,serif",color:"#1a1a2e",margin:"0 0 8px"}}>Hotel The Grand Alayna</h3>
            <p style={{fontSize:15,color:"#555",lineHeight:1.7,margin:"0 0 28px"}}>
              Sitakund, Chittagong, Bangladesh<br/>
              Near Sitakund Eco Park &amp; Tourist Attractions
            </p>
            <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
              <a href="https://maps.google.com/?q=Hotel+The+Grand+Alayna+Sitakund+Chittagong" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,background:gold,color:"#0e0720",fontWeight:700,fontSize:13,padding:"11px 22px",borderRadius:22,textDecoration:"none"}}>
                🗺️ View on Google Maps
              </a>
              <a href="tel:+8801883352526" style={{display:"inline-flex",alignItems:"center",gap:8,background:"#fff",border:"1.5px solid rgba(201,168,76,.4)",color:"#1a1a2e",fontWeight:600,fontSize:13,padding:"11px 22px",borderRadius:22,textDecoration:"none"}}>
                📞 +880 1883-352526
              </a>
            </div>
            <div style={{marginTop:28,display:"flex",gap:20,justifyContent:"center",flexWrap:"wrap"}}>
              {[["🚌","Chittagong City","~35 min drive"],["🏞️","Sitakund Eco Park","Walking distance"],["🌊","Chandranath Hill","~10 min"],["🚂","Sitakund Railway","~5 min"]].map(([ic,place,dist],i)=>(
                <div key={i} style={{textAlign:"center",minWidth:80}}>
                  <div style={{fontSize:22}}>{ic}</div>
                  <div style={{fontSize:12,fontWeight:600,color:"#333",marginTop:4}}>{place}</div>
                  <div style={{fontSize:11,color:"#888"}}>{dist}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{background:"#fafaf8",padding:"80px 24px"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:48}}>
            <div style={{fontSize:11,color:gold,letterSpacing:5,textTransform:"uppercase",fontWeight:700,marginBottom:10}}>Get In Touch</div>
            <h2 style={{fontSize:38,fontWeight:800,fontFamily:"'Playfair Display',Georgia,serif",color:"#1a1a2e",margin:0}}>Contact Us</h2>
          </div>
          <div className="lp-contact-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            {[
              {icon:"📞",title:"Phone / WhatsApp",lines:["+880 1883-352526"],action:"tel:+8801883352526",label:"Call Now"},
              {icon:"📧",title:"Email",lines:["hotelthegrandalayna@gmail.com"],action:"mailto:hotelthegrandalayna@gmail.com",label:"Send Email"},
              {icon:"💳",title:"Payment Methods",lines:["Cash · bKash · Nagad"],action:null,label:null},
              {icon:"🕐",title:"Check-in / Check-out",lines:["Check-in: 12:00 PM","Check-out: 11:00 AM"],action:null,label:null},
            ].map((c,i)=>(
              <div key={i} style={{background:"#fff",border:"1.5px solid #f0ece0",borderRadius:16,padding:"28px",display:"flex",gap:16,alignItems:"flex-start",boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
                <div style={{fontSize:28,flexShrink:0}}>{c.icon}</div>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:gold,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{c.title}</div>
                  {c.lines.map((l,j)=><div key={j} style={{fontSize:14,color:"#333",marginBottom:2}}>{l}</div>)}
                  {c.action&&<a href={c.action} style={{display:"inline-block",marginTop:10,fontSize:12,fontWeight:600,color:gold,textDecoration:"none",borderBottom:`1px solid ${gold}`}}>{c.label} →</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{background:"linear-gradient(135deg,#0e0720,#1a0e3a)",padding:"60px 24px",textAlign:"center"}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <h2 style={{fontSize:32,fontWeight:800,fontFamily:"'Playfair Display',Georgia,serif",color:"#fff",margin:"0 0 12px"}}>Ready to Book Your Stay?</h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.55)",marginBottom:28}}>Call us directly — we will find the perfect room for you and confirm instantly.</p>
          <a href="tel:+8801883352526" className="lp-cta" style={{display:"inline-flex",alignItems:"center",gap:8,background:gold,color:"#0e0720",fontWeight:700,fontSize:15,padding:"16px 36px",borderRadius:30,textDecoration:"none",transition:"all .25s",boxShadow:"0 4px 20px rgba(201,168,76,.3)"}}>
            📞 Call: +880 1883-352526
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{background:"#0a0518",padding:"32px 24px",textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:700,fontFamily:"'Playfair Display',Georgia,serif",color:gold,marginBottom:6}}>Hotel The Grand Alayna</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginBottom:14}}>Sitakund, Chittagong, Bangladesh · +880 1883-352526 · hotelthegrandalayna@gmail.com</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.15)",borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:14}}>
          © {new Date().getFullYear()} L&amp;M Group · Hotel The Grand Alayna &amp; Convention Hall Amelia ·{" "}
          <button onClick={()=>setShowPortal(true)} style={{background:"none",border:"none",color:"rgba(201,168,76,.3)",fontSize:11,cursor:"pointer",padding:0,textDecoration:"underline"}}>Staff Portal</button>
        </div>
      </footer>
    </div>
  );
}
