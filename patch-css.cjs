const fs = require('fs');
const cssPath = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/styles/app.css';
const patch = `

/* ── React app class aliases & missing definitions ── */
#hotelApp .modal-box { background:var(--bg2);border-radius:var(--r-xl);padding:28px;width:100%;max-width:640px;margin:auto;box-shadow:var(--shadow-lg);border:1px solid rgba(255,255,255,.8);animation:modalIn .2s cubic-bezier(.34,1.56,.64,1); }
#hotelApp .modal-overlay.open { display:flex; }
#hotelApp .form-group { display:flex;flex-direction:column;gap:5px;margin-bottom:12px; }
#hotelApp .form-group label { font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px; }
#hotelApp .form-group input,
#hotelApp .form-group select,
#hotelApp .form-group textarea { width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;background:var(--bg4);color:var(--text);transition:var(--transition);outline:none; }
#hotelApp .form-group input:focus,
#hotelApp .form-group select:focus,
#hotelApp .form-group textarea:focus { border-color:var(--gold);background:#fff;box-shadow:0 0 0 3px rgba(201,168,76,.1); }
#hotelApp .room-number { font-size:22px;font-weight:800;font-family:'Playfair Display',serif;color:var(--navy2);margin-bottom:2px; }
#hotelApp .room-name-lbl { font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px; }
#hotelApp .room-type-lbl { font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px; }
#hotelApp .room-rate-lbl { font-size:12px;font-weight:700;color:var(--gold2);margin:4px 0; }
#hotelApp .room-status { font-size:10px;font-weight:700;text-transform:capitalize;margin-top:4px; }
#hotelApp .room-card { position:relative;border-radius:12px;padding:14px;border:1.5px solid var(--border);cursor:pointer;transition:.2s; }
#hotelApp .room-card:hover { transform:translateY(-2px);box-shadow:var(--shadow); }
#hotelApp .arr-item { display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid var(--border);border-radius:9px;margin-bottom:6px;background:var(--bg4); }
#hotelApp .arr-room { width:38px;height:38px;border-radius:9px;background:var(--navy);color:var(--gold);font-size:10px;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;line-height:1.2; }
#hotelApp .role-badge.manager { background:rgba(37,99,235,.15);color:#2563eb;border:1px solid rgba(37,99,235,.3); }
#hotelApp .role-badge.receptionist { background:rgba(22,101,52,.15);color:#166534;border:1px solid rgba(22,101,52,.3); }
#hotelApp .role-badge.accountant { background:rgba(91,33,182,.15);color:#5b21b6;border:1px solid rgba(91,33,182,.3); }
#hotelApp .metric.blue .metric-icon { background:var(--blue-bg);color:var(--blue2); }
#hotelApp .metric.gold .metric-icon { background:var(--gold4);color:var(--gold); }
#hotelApp .metric.green .metric-icon { background:var(--green-bg);color:var(--green2); }
#hotelApp .metric.amber .metric-icon { background:var(--amber-bg);color:var(--amber2); }
`;
fs.appendFileSync(cssPath, patch, 'utf8');
console.log('CSS patched OK');
