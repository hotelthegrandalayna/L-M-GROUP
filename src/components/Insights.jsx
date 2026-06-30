import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { todayStr, formatDate } from '../utils/helpers';

function Panel({ title, icon, right, children }) {
  return (
    <div className="panel" style={{ marginBottom:14 }}>
      <div className="panel-header">
        <div className="panel-title"><i className={"ti "+icon} /> {title}</div>
        {right && <div style={{ display:'flex', alignItems:'center', gap:8 }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

function StatBadge({ label, value, icon, color }) {
  return (
    <div style={{ textAlign:'center', padding:'14px 10px', background:'var(--bg3)', borderRadius:10 }}>
      <i className={"ti "+icon} style={{ fontSize:22, color, display:'block', marginBottom:5 }} />
      <div style={{ fontSize:18, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:10, color:'var(--text3)', marginTop:3, fontWeight:600 }}>{label}</div>
    </div>
  );
}

export default function Insights() {
  const { bookings, rooms, loyaltyRules, setLoyaltyRules, surveyData, setSurveys,
          pricingRules, setPricing, notify, curUser } = useApp();

  const today = todayStr();
  const thisMonth = today.slice(0,7);

  const [showLoyaltyEditor, setShowLoyaltyEditor] = useState(false);
  const [lrEdit, setLrEdit] = useState({ ptsPerNight:10, ptsPerThousand:5, pointValue:1, silverThreshold:500, goldThreshold:1000, platinumThreshold:2000, ...loyaltyRules });
  const [showAddPricing, setShowAddPricing] = useState(false);
  const [editPricingId, setEditPricingId] = useState(null);
  const [pName, setPName] = useState(''); const [pType, setPType] = useState('weekend');
  const [pStart, setPStart] = useState(''); const [pEnd, setPEnd] = useState('');
  const [pUplift, setPUplift] = useState(10);
  const [surveyForm, setSurveyForm] = useState({ guest:'', cleanliness:5, staff:5, value:5, facilities:5, overall:5, comment:'' });
  const [showSurvey, setShowSurvey] = useState(false);
  const [showSurveyList, setShowSurveyList] = useState(false);

  // ── Reminders ─────────────────────────────────────────────
  const inHouse      = bookings.filter(b=>b.status==='checked-in'||(b.status==='confirmed'&&b.checkin<=today&&b.checkout>today));
  const checkinsToday  = bookings.filter(b=>b.checkin===today&&b.status==='confirmed');
  const checkoutsToday = bookings.filter(b=>b.checkout===today&&b.status==='checked-in');
  const pendingPay     = bookings.filter(b=>['confirmed','checked-in'].includes(b.status)&&(b.amount-(b.advance||0)-(b.extrasAdvance||0))>0);

  // ── Upcoming 7 days ────────────────────────────────────────
  const upcoming = useMemo(()=>{
    const days=[];
    for(let i=1;i<=7;i++){
      const d=new Date(today); d.setDate(d.getDate()+i);
      const ds=d.toISOString().split('T')[0];
      const dayName=d.toLocaleDateString('en-BD',{weekday:'short',month:'short',day:'numeric'});
      const arrivals=bookings.filter(b=>b.checkin===ds&&b.status==='confirmed');
      const departures=bookings.filter(b=>b.checkout===ds&&b.status==='checked-in');
      if(arrivals.length||departures.length) days.push({ ds, dayName, arrivals, departures });
    }
    return days;
  },[bookings,today]);

  // ── Room occupancy ─────────────────────────────────────────
  const roomStatus = useMemo(()=>rooms.map(r=>{
    const active = bookings.find(b=>b.room===r.number&&(b.status==='checked-in'||(b.status==='confirmed'&&b.checkin<=today&&b.checkout>today)));
    const upcoming = bookings.find(b=>b.room===r.number&&b.status==='confirmed'&&b.checkin>today);
    return { ...r, occupied:!!active, guest:active?.guest, upcoming:upcoming?.checkin, upcomingGuest:upcoming?.guest };
  }),[rooms,bookings,today]);

  const occupiedCount = roomStatus.filter(r=>r.occupied).length;
  const availableCount = roomStatus.filter(r=>!r.occupied).length;

  // ── Booking trends ─────────────────────────────────────────
  const mBookings = bookings.filter(b=>b.checkin?.startsWith(thisMonth)&&b.status!=='cancelled');
  const allActive = bookings.filter(b=>b.status!=='cancelled');
  const repeatGuests = useMemo(()=>{
    const map={};
    allActive.forEach(b=>{ const k=b.phone||b.guest; map[k]=(map[k]||0)+1; });
    return Object.values(map).filter(v=>v>1).length;
  },[allActive]);
  const uniqueGuests = useMemo(()=>{
    return new Set(allActive.map(b=>b.phone||b.guest)).size;
  },[allActive]);
  const repeatRate = uniqueGuests>0?Math.round(repeatGuests/uniqueGuests*100):0;
  const avgNights = mBookings.length?(mBookings.reduce((s,b)=>s+(b.nights||0),0)/mBookings.length).toFixed(1):0;

  const bySource = useMemo(()=>{
    const map={};
    allActive.forEach(b=>{ const s=b.source||'Walk-in'; map[s]=(map[s]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[allActive]);
  const maxSource = bySource.length?bySource[0][1]:1;

  // ── Day-of-week peaks ──────────────────────────────────────
  const dowCounts = useMemo(()=>{
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const count=[0,0,0,0,0,0,0];
    allActive.forEach(b=>{ if(b.checkin){ count[new Date(b.checkin).getDay()]++; } });
    const max=Math.max(...count,1);
    return days.map((d,i)=>({ day:d, count:count[i], pct:Math.round(count[i]/max*100) }));
  },[allActive]);

  // ── Loyalty ────────────────────────────────────────────────
  const loyaltyList = useMemo(()=>{
    const rules = loyaltyRules||{ ptsPerNight:10, ptsPerThousand:5, pointValue:1, silverThreshold:500, goldThreshold:1000, platinumThreshold:2000 };
    const map={};
    bookings.filter(b=>b.status!=='cancelled').forEach(b=>{
      const ph=b.phone||'unknown';
      if(!map[ph]) map[ph]={ phone:ph, guest:b.guest, nights:0, spent:0 };
      map[ph].nights+=b.nights||0; map[ph].spent+=b.amount||0;
    });
    return Object.values(map).map(g=>{
      const pts=g.nights*(rules.ptsPerNight||10)+Math.floor(g.spent/1000)*(rules.ptsPerThousand||5);
      const p=rules.platinumThreshold||2000,go=rules.goldThreshold||1000,s=rules.silverThreshold||500;
      const tier=pts>=p?'Platinum':pts>=go?'Gold':pts>=s?'Silver':'Bronze';
      return { ...g, pts, value:pts*(rules.pointValue||1), tier };
    }).sort((a,b)=>b.pts-a.pts);
  },[bookings,loyaltyRules]);
  const TIER_COLOR={ Platinum:'#5b3fa0', Gold:'#b8860b', Silver:'#777', Bronze:'#cd7f32' };

  // ── Referrals ──────────────────────────────────────────────
  const referrals = useMemo(()=>{
    const map={};
    bookings.filter(b=>b.referredBy&&b.status!=='cancelled').forEach(b=>{
      const r=b.referredBy; if(!map[r]) map[r]={name:r,count:0}; map[r].count++;
    });
    return Object.values(map).sort((a,b)=>b.count-a.count);
  },[bookings]);

  // ── Survey ─────────────────────────────────────────────────
  const surveyAvg = useMemo(()=>{
    const sd=surveyData||[]; if(!sd.length) return null;
    const keys=['cleanliness','staff','value','facilities','overall'];
    const avg={}; keys.forEach(k=>{ avg[k]=sd.reduce((s,x)=>s+(x[k]||0),0)/sd.length; });
    avg.total=keys.reduce((s,k)=>s+avg[k],0)/keys.length;
    return avg;
  },[surveyData]);
  const SURVEY_LABELS={ cleanliness:'Room Cleanliness', staff:'Staff', value:'Value for Money', facilities:'Facilities', overall:'Overall' };

  function submitSurvey() {
    if(!surveyForm.guest.trim()) { notify('Enter guest name','error'); return; }
    setSurveys([...(surveyData||[]),{ ...surveyForm, date:today, by:curUser||'staff' }]);
    notify('Survey submitted','success');
    setSurveyForm({ guest:'',cleanliness:5,staff:5,value:5,facilities:5,overall:5,comment:'' });
    setShowSurvey(false);
  }
  function deleteSurvey(i) { if(window.confirm('Delete this survey entry?')) setSurveys((surveyData||[]).filter((_,idx)=>idx!==i)); }

  // ── Dynamic Pricing ────────────────────────────────────────
  function openAddPricing() { setEditPricingId(null); setPName(''); setPType('weekend'); setPStart(''); setPEnd(''); setPUplift(10); setShowAddPricing(true); }
  function openEditPricing(r) { setEditPricingId(r.id); setPName(r.name); setPType(r.type); setPStart(r.start||''); setPEnd(r.end||''); setPUplift(r.uplift); setShowAddPricing(true); }
  function savePricingRule() {
    if(!pName.trim()) { notify('Rule name required','error'); return; }
    if(pType==='date'&&(!pStart||!pEnd||pEnd<pStart)) { notify('Check dates','error'); return; }
    const rule={ id:editPricingId||Date.now(), name:pName, type:pType, uplift:parseInt(pUplift)||10, start:pStart, end:pEnd, active:true };
    if(editPricingId) { setPricing((pricingRules||[]).map(r=>r.id===editPricingId?rule:r)); notify('Rule updated','success'); }
    else { setPricing([...(pricingRules||[]),rule]); notify('Rule added','success'); }
    setShowAddPricing(false);
  }
  function togglePricingActive(id) { setPricing((pricingRules||[]).map(r=>r.id===id?{...r,active:!r.active}:r)); }
  function deletePricingRule(id) { if(window.confirm('Delete this pricing rule?')) setPricing((pricingRules||[]).filter(r=>r.id!==id)); }

  function saveLoyaltyRules() { setLoyaltyRules(lrEdit); notify('Loyalty rules saved','success'); setShowLoyaltyEditor(false); }

  const pricingSuggestions = useMemo(()=>{
    const days=[];
    for(let i=1;i<=7;i++){
      const d=new Date(today); d.setDate(d.getDate()+i);
      const ds=d.toISOString().split('T')[0];
      const dayName=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
      const isWeekend=[0,5,6].includes(d.getDay());
      const rules=(pricingRules||[]).filter(r=>{ if(!r.active) return false; if(r.type==='weekend'&&isWeekend) return true; if(r.type==='date'&&ds>=r.start&&ds<=r.end) return true; return false; });
      if(rules.length){ const uplift=Math.max(...rules.map(r=>r.uplift)); const baseRate=rooms.length?Math.round(rooms.reduce((s,r)=>s+r.rate,0)/rooms.length):2500; days.push({ ds, dayName, uplift, suggestedRate:Math.round(baseRate*(1+uplift/100)) }); }
    }
    return days.slice(0,3);
  },[pricingRules,rooms,today]);

  return (
    <div style={{ padding:'20px 24px 32px' }}>

      {/* ── Top stats row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatBadge label="In-House Now"   value={inHouse.length}     icon="ti-home"          color="var(--navy)" />
        <StatBadge label="Rooms Available" value={availableCount}    icon="ti-door-enter"    color="var(--green)" />
        <StatBadge label="Rooms Occupied"  value={occupiedCount}     icon="ti-bed"           color="#5b3fa0" />
        <StatBadge label="Avg Stay (mth)"  value={avgNights+' n'}    icon="ti-moon"          color="var(--gold2)" />
        <StatBadge label="Repeat Rate"     value={repeatRate+'%'}    icon="ti-repeat"        color="var(--text2)" />
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* LEFT col */}
        <div>
          {/* Smart Reminders */}
          <Panel title="Smart Reminders" icon="ti-bell">
            <div style={{ padding:'4px 14px 12px' }}>
              {checkinsToday.length===0&&checkoutsToday.length===0&&pendingPay.length===0 ? (
                <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'10px 0' }}>
                  <i className="ti ti-check" style={{ color:'var(--green)', marginRight:6 }} />All clear — no urgent reminders today
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {checkinsToday.map(b=>(
                    <div key={b.id} style={{ display:'flex', gap:10, padding:'8px 10px', background:'var(--green-bg)', border:'1px solid var(--green-bd)', borderRadius:8, fontSize:12 }}>
                      <i className="ti ti-login" style={{ color:'var(--green)', fontSize:15, marginTop:1, flexShrink:0 }} />
                      <div><strong>Check-in today:</strong> {b.guest} — Rm {b.room}<div style={{ fontSize:11, color:'var(--text3)' }}>{formatDate(b.checkin)} → {formatDate(b.checkout)} · {b.nights} nights</div></div>
                    </div>
                  ))}
                  {checkoutsToday.map(b=>(
                    <div key={b.id} style={{ display:'flex', gap:10, padding:'8px 10px', background:'#fff8f0', border:'1px solid #f0c070', borderRadius:8, fontSize:12 }}>
                      <i className="ti ti-logout" style={{ color:'#b07800', fontSize:15, marginTop:1, flexShrink:0 }} />
                      <div><strong>Check-out today:</strong> {b.guest} — Rm {b.room}<div style={{ fontSize:11, color:'var(--text3)' }}>Balance: {Math.max(0,(b.amount||0)-(b.advance||0)-(b.extrasAdvance||0)).toLocaleString()} BDT</div></div>
                    </div>
                  ))}
                  {pendingPay.slice(0,4).map(b=>(
                    <div key={b.id} style={{ display:'flex', gap:10, padding:'8px 10px', background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:8, fontSize:12 }}>
                      <i className="ti ti-cash" style={{ color:'var(--red2)', fontSize:15, marginTop:1, flexShrink:0 }} />
                      <div><strong>Pending payment:</strong> {b.guest} — Rm {b.room}<div style={{ fontSize:11, color:'var(--text3)' }}>Due: {Math.max(0,(b.amount||0)-(b.advance||0)-(b.extrasAdvance||0)).toLocaleString()} BDT</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* Upcoming Arrivals / Departures */}
          <Panel title="Upcoming 7 Days" icon="ti-calendar-event">
            <div style={{ padding:'4px 14px 12px' }}>
              {upcoming.length===0 ? (
                <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:10 }}>No arrivals or departures in the next 7 days</div>
              ) : upcoming.map((d,i)=>(
                <div key={i} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'var(--navy)', letterSpacing:.5, marginBottom:5 }}>{d.dayName}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {d.arrivals.map(b=>(
                      <div key={b.id} style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, padding:'5px 8px', background:'var(--green-bg)', border:'1px solid var(--green-bd)', borderRadius:7 }}>
                        <i className="ti ti-plane-arrival" style={{ color:'var(--green)', fontSize:13 }} />
                        <span style={{ fontWeight:600 }}>{b.guest}</span><span style={{ color:'var(--text3)' }}>Rm {b.room} · {b.nights}n</span>
                      </div>
                    ))}
                    {d.departures.map(b=>(
                      <div key={b.id} style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, padding:'5px 8px', background:'#fff8f0', border:'1px solid #f0c070', borderRadius:7 }}>
                        <i className="ti ti-plane-departure" style={{ color:'#b07800', fontSize:13 }} />
                        <span style={{ fontWeight:600 }}>{b.guest}</span><span style={{ color:'var(--text3)' }}>Rm {b.room}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Room Status */}
          <Panel title="Room Status" icon="ti-building">
            <div style={{ padding:'4px 14px 12px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                {roomStatus.map(r=>(
                  <div key={r.number} style={{ padding:'9px 11px', borderRadius:9, border:'1.5px solid', borderColor:r.occupied?'var(--red-bd)':'var(--green-bd)', background:r.occupied?'var(--red-bg)':'var(--green-bg)' }}>
                    <div style={{ fontSize:13, fontWeight:800, color:r.occupied?'var(--red)':'var(--green)' }}>Rm {r.number}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', margin:'2px 0' }}>{r.type}</div>
                    <div style={{ fontSize:11, fontWeight:600 }}>{r.occupied ? (
                      <><i className="ti ti-bed" style={{ fontSize:10 }} /> {r.guest}</>
                    ) : r.upcoming ? (
                      <span style={{ color:'#b07800' }}><i className="ti ti-clock" style={{ fontSize:10 }} /> {r.upcomingGuest} on {r.upcoming}</span>
                    ) : (
                      <span style={{ color:'var(--green)' }}><i className="ti ti-check" style={{ fontSize:10 }} /> Available</span>
                    )}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* Loyalty Points */}
          <Panel title="Loyalty Points" icon="ti-star" right={
            <>
              <span style={{ fontSize:11, color:'var(--text3)' }}>{loyaltyRules?.ptsPerNight||10}pts/night</span>
              <button className="btn sm" onClick={()=>{ setLrEdit({ptsPerNight:10,ptsPerThousand:5,pointValue:1,silverThreshold:500,goldThreshold:1000,platinumThreshold:2000,...loyaltyRules}); setShowLoyaltyEditor(v=>!v); }}>
                <i className="ti ti-settings" /> Rules
              </button>
            </>
          }>
            {showLoyaltyEditor && (
              <div style={{ padding:'12px 14px', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                  {[['ptsPerNight','Pts per Night'],['ptsPerThousand','Pts per ৳1000'],['pointValue','Point value (৳)'],['silverThreshold','Silver pts'],['goldThreshold','Gold pts'],['platinumThreshold','Platinum pts']].map(([k,l])=>(
                    <div key={k} className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:10 }}>{l}</label>
                      <input type="number" value={lrEdit[k]||0} onChange={e=>setLrEdit(p=>({...p,[k]:+e.target.value}))} style={{ fontSize:13 }} />
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:7 }}>
                  <button className="btn sm" onClick={()=>setShowLoyaltyEditor(false)}>Cancel</button>
                  <button className="btn sm primary" onClick={saveLoyaltyRules}><i className="ti ti-check" /> Save</button>
                </div>
              </div>
            )}
            <div style={{ padding:'4px 14px 10px', maxHeight:220, overflowY:'auto' }}>
              {loyaltyList.length===0 ? (
                <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:10 }}>No bookings yet</div>
              ) : loyaltyList.map((g,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:TIER_COLOR[g.tier]+'22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className="ti ti-award" style={{ color:TIER_COLOR[g.tier], fontSize:14 }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>{g.guest||g.phone} <span style={{ fontSize:10, color:TIER_COLOR[g.tier], fontWeight:700, background:TIER_COLOR[g.tier]+'18', padding:'1px 6px', borderRadius:8 }}>{g.tier}</span></div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{g.pts} pts · {g.nights} nights</div>
                  </div>
                  <div style={{ textAlign:'right', fontSize:11, fontWeight:700, color:'var(--gold2)' }}>{g.value.toLocaleString()} ৳<div style={{ fontSize:9, color:'var(--text3)', fontWeight:400 }}>point value</div></div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* RIGHT col */}
        <div>
          {/* Booking Trends */}
          <Panel title="Booking Trends" icon="ti-trending-up">
            <div style={{ padding:'4px 14px 12px' }}>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>Booking Source</div>
                {bySource.length===0 ? <div style={{ fontSize:12, color:'var(--text3)' }}>No data</div>:bySource.map(([s,n])=>(
                  <div key={s} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                      <span style={{ fontWeight:600 }}>{s}</span>
                      <span style={{ fontWeight:700, color:'var(--navy)' }}>{n} booking{n!==1?'s':''}</span>
                    </div>
                    <div style={{ height:7, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:(n/maxSource*100)+'%', background:'#5b3fa0', borderRadius:4 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>Peak Check-in Days</div>
                <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:60 }}>
                  {dowCounts.map(d=>(
                    <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <div style={{ width:'100%', height:d.pct*0.5+'px', minHeight:3, background:d.pct>60?'var(--navy)':'var(--border)', borderRadius:'3px 3px 0 0', transition:'height .4s' }} />
                      <div style={{ fontSize:9, color:d.pct>60?'var(--navy)':'var(--text3)', fontWeight:d.pct>60?800:500 }}>{d.day}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* Dynamic Pricing */}
          <Panel title="Dynamic Pricing" icon="ti-chart-line" right={
            <button className="btn sm primary" onClick={openAddPricing}><i className="ti ti-plus" /> Add Rule</button>
          }>
            {showAddPricing && (
              <div style={{ padding:'12px 14px', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:10 }}>Rule Name</label>
                    <input value={pName} onChange={e=>setPName(e.target.value)} placeholder="e.g. Eid Special" style={{ fontSize:13 }} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:10 }}>Type</label>
                    <select value={pType} onChange={e=>setPType(e.target.value)} style={{ fontSize:13 }}>
                      <option value="weekend">Every Weekend (Fri-Sat)</option>
                      <option value="date">Date Range</option>
                    </select>
                  </div>
                  {pType==='date' && <>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:10 }}>From</label>
                      <input type="date" value={pStart} onChange={e=>setPStart(e.target.value)} style={{ fontSize:13 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:10 }}>To</label>
                      <input type="date" value={pEnd} onChange={e=>setPEnd(e.target.value)} style={{ fontSize:13 }} />
                    </div>
                  </>}
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:10 }}>Uplift %</label>
                    <input type="number" value={pUplift} onChange={e=>setPUplift(e.target.value)} min={1} max={200} style={{ fontSize:13 }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:7 }}>
                  <button className="btn sm" onClick={()=>setShowAddPricing(false)}>Cancel</button>
                  <button className="btn sm primary" onClick={savePricingRule}><i className="ti ti-check" /> {editPricingId?'Update':'Add Rule'}</button>
                </div>
              </div>
            )}
            <div style={{ padding:'4px 14px 10px' }}>
              {(pricingRules||[]).length===0&&!showAddPricing&&(
                <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:10 }}>No pricing rules yet. Click Add Rule to create one.</div>
              )}
              {(pricingRules||[]).map(r=>(
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{r.name}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{r.type==='weekend'?'Every Friday & Saturday':r.start+' → '+r.end}</div>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--green)', background:'var(--green-bg)', padding:'2px 8px', borderRadius:6, flexShrink:0 }}>+{r.uplift}%</span>
                  <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontSize:12, flexShrink:0 }}>
                    <input type="checkbox" checked={r.active} onChange={()=>togglePricingActive(r.id)} style={{ accentColor:'var(--navy)', width:14, height:14 }} />
                    <span style={{ color:r.active?'var(--navy)':'var(--text3)', fontWeight:700 }}>{r.active?'Active':'Off'}</span>
                  </label>
                  <button className="btn sm icon-btn" onClick={()=>openEditPricing(r)} style={{ padding:'3px 7px' }}><i className="ti ti-pencil" /></button>
                  <button className="btn sm icon-btn" onClick={()=>deletePricingRule(r.id)} style={{ padding:'3px 7px', color:'var(--red2)', borderColor:'var(--red-bd)' }}><i className="ti ti-trash" /></button>
                </div>
              ))}
              {pricingSuggestions.length>0 && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:9, fontWeight:800, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:7 }}>Upcoming Suggestions</div>
                  {pricingSuggestions.map((s,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', fontSize:12, borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontWeight:600 }}>{s.dayName}</span>
                      <span style={{ fontWeight:700, color:'var(--navy)' }}>{s.suggestedRate.toLocaleString()} ৳ <span style={{ color:'var(--green)', fontSize:11 }}>+{s.uplift}%</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* Referral Tracker */}
          <Panel title="Referral Tracker" icon="ti-users-group">
            <div style={{ padding:'4px 14px 12px' }}>
              {referrals.length===0 ? (
                <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:10 }}>No referrals recorded yet. Fill "Referred By" when adding bookings.</div>
              ) : referrals.map((r,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <i className="ti ti-user-check" style={{ color:'var(--navy)', fontSize:14 }} />
                    <span style={{ fontWeight:600 }}>{r.name}</span>
                  </div>
                  <span style={{ fontWeight:800, color:'var(--navy)', background:'var(--bg3)', padding:'2px 10px', borderRadius:8, fontSize:12 }}>{r.count} referral{r.count!==1?'s':''}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Guest Satisfaction */}
          <Panel title="Guest Satisfaction" icon="ti-clipboard-check" right={
            <>
              {surveyAvg && <span style={{ fontSize:11, color:'var(--text3)' }}>★ {surveyAvg.total.toFixed(1)}/5 ({(surveyData||[]).length})</span>}
              <button className="btn sm" onClick={()=>setShowSurveyList(v=>!v)}><i className="ti ti-list" /> All</button>
              <button className="btn sm primary" onClick={()=>setShowSurvey(v=>!v)}><i className="ti ti-plus" /> Add</button>
            </>
          }>
            {showSurvey && (
              <div style={{ padding:'12px 14px', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                <div className="form-group" style={{ marginBottom:8 }}>
                  <label style={{ fontSize:10 }}>Guest Name / Phone</label>
                  <input value={surveyForm.guest} onChange={e=>setSurveyForm(p=>({...p,guest:e.target.value}))} placeholder="Guest name" style={{ fontSize:13 }} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  {Object.entries(SURVEY_LABELS).map(([k,l])=>(
                    <div key={k} className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:10 }}>{l} (1-5)</label>
                      <input type="number" min={1} max={5} value={surveyForm[k]} onChange={e=>setSurveyForm(p=>({...p,[k]:Math.min(5,Math.max(1,+e.target.value))}))} style={{ fontSize:13 }} />
                    </div>
                  ))}
                </div>
                <div className="form-group" style={{ marginBottom:8 }}>
                  <label style={{ fontSize:10 }}>Comment (optional)</label>
                  <textarea value={surveyForm.comment} onChange={e=>setSurveyForm(p=>({...p,comment:e.target.value}))} rows={2} style={{ fontSize:12, width:'100%', boxSizing:'border-box' }} />
                </div>
                <div style={{ display:'flex', gap:7 }}>
                  <button className="btn sm" onClick={()=>setShowSurvey(false)}>Cancel</button>
                  <button className="btn sm primary" onClick={submitSurvey}><i className="ti ti-check" /> Submit</button>
                </div>
              </div>
            )}
            {showSurveyList && (surveyData||[]).length>0 && (
              <div style={{ padding:'4px 14px 12px', maxHeight:260, overflowY:'auto' }}>
                <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>All Survey Entries</div>
                {[...(surveyData||[])].reverse().map((sv,i)=>(
                  <div key={i} style={{ padding:'9px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <div style={{ fontWeight:700 }}>{sv.guest}</div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ fontSize:13, fontWeight:800, color:'var(--gold2)' }}>★ {sv.overall}</span>
                        <span style={{ fontSize:10, color:'var(--text3)' }}>{sv.date}</span>
                        <button className="btn sm icon-btn" onClick={()=>deleteSurvey((surveyData||[]).length-1-i)} style={{ padding:'2px 6px', color:'var(--red2)', borderColor:'var(--red-bd)' }}><i className="ti ti-trash" style={{ fontSize:11 }} /></button>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      {Object.entries(SURVEY_LABELS).map(([k,l])=>(
                        <span key={k} style={{ fontSize:10, color:'var(--text3)' }}>{l.split(' ')[0]}: <strong style={{ color:'var(--navy)' }}>{sv[k]}</strong></span>
                      ))}
                    </div>
                    {sv.comment&&<div style={{ fontSize:11, color:'var(--text2)', marginTop:4, fontStyle:'italic' }}>"{sv.comment}"</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding:'4px 14px 12px' }}>
              {!surveyAvg ? (
                <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:10 }}>No surveys yet. Add your first guest feedback!</div>
              ) : (
                <>
                  {Object.entries(SURVEY_LABELS).map(([k,l])=>(
                    <div key={k} style={{ marginBottom:9 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                        <span style={{ fontWeight:600 }}>{l}</span>
                        <span style={{ fontWeight:700, color:'var(--navy)' }}>{surveyAvg[k].toFixed(1)} / 5</span>
                      </div>
                      <div style={{ height:7, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:(surveyAvg[k]/5*100)+'%', background:'var(--green)', borderRadius:4 }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ textAlign:'center', marginTop:10, fontSize:13, fontWeight:700, color:'var(--navy)', padding:'8px', background:'var(--bg3)', borderRadius:8 }}>
                    Overall Score: {surveyAvg.total.toFixed(1)} / 5 ★  ({(surveyData||[]).length} {(surveyData||[]).length===1?'survey':'surveys'})
                  </div>
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
