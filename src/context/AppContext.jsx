import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { hasHotelSupabaseConfig, loadHotelBookingsFromSupabase, loadRoomsFromSupabase, saveRoomsToSupabase, persistHotelBookingBundle } from "../lib/hotelSupabase";
import { hasSupabase, upsertRows, loadRows, saveConfig, loadConfig } from "../utils/supabaseSync";
import { restoreUserPasswords } from "../utils/userPass";
import { onRemoteChange } from "../utils/realtimeSync";
import { runDailyBackup } from "../utils/dailyBackup";
import { syncNtfyConfigFromSupabase } from "../utils/ntfy";
import { supabase } from "../lib/supabaseClient";

const GA_ROOMS_VER = 'alayna-r1';

const DEFAULT_ROOMS = [
  { id: 1, number: '101', name: 'Orchid Blue',    type: 'Classic Single', rate: 2500, acRate: 2500, nonAcRate: 1800, status: 'vacant', notes: '' },
  { id: 2, number: '102', name: 'Lilly Blossom',  type: 'Classic Single', rate: 2500, acRate: 2500, nonAcRate: 1800, status: 'vacant', notes: '' },
  { id: 3, number: '103', name: 'Jasmine Dew',    type: 'AC Room',        rate: 4000, acRate: 4000, nonAcRate: 2800, status: 'vacant', notes: '' },
  { id: 4, number: '104', name: 'Rose Valley',    type: 'AC Room',        rate: 5000, acRate: 5000, nonAcRate: 3500, status: 'vacant', notes: '' },
  { id: 5, number: '105', name: 'Lavender Bloom',  type: 'Double Room',    rate: 3000, status: 'vacant', notes: '' },
  { id: 6, number: '106', name: 'Lotus Glow',      type: 'Double Room',    rate: 3000, status: 'vacant', notes: '' },
];

const DEFAULT_PRICING = [
  { id: 1, name: 'Weekend Uplift', type: 'weekend', uplift: 20, active: true },
  { id: 2, name: 'Eid-ul-Fitr',   type: 'date', start: '2026-03-30', end: '2026-04-03', uplift: 30, active: true },
  { id: 3, name: 'Eid-ul-Adha',   type: 'date', start: '2026-06-06', end: '2026-06-10', uplift: 30, active: true },
];

const DEFAULT_SMS_TEMPLATES = {
  booking: `Dear {guest}, your booking at Hotel The Grand Alayna is confirmed! 🏨\nRoom: {room} | Check-in: {checkin} | Check-out: {checkout} ({nights} night(s))\nTotal: {total} | Advance: {advance}\nWe look forward to welcoming you!\n📞 +8801883352526`,
  checkin: `Dear {guest}, welcome to Hotel The Grand Alayna! 🌟\nYou are now checked in to Room {room}.\nCheck-out: {checkout}\nWishing you a pleasant stay! For any assistance, please contact reception.\n📞 +8801883352526`,
  checkout: `Dear {guest}, thank you for staying at Hotel The Grand Alayna! 🙏\nWe hope you enjoyed your stay in Room {room}.\nPlease share your experience on Google & Facebook — your feedback means the world to us!\nHope to see you again soon! 💛`,
  referrer: `Dear {referrer}, thank you for referring {guest} to Hotel The Grand Alayna! 🙏\nYour referral has been recorded and we truly appreciate your support.\n📞 +8801883352526`,
};

const DEFAULT_LOYALTY_RULES = {
  ptsPerNight: 10, ptsPerThousand: 5, referralBonus: 200,
  pointValue: 1, silverThreshold: 500, goldThreshold: 1000, platinumThreshold: 2000,
};

const DEFAULT_INV = [
  { id: 1, name: 'Blanket',            category: 'Linen',    unit: 'pcs', minStock: 5  },
  { id: 2, name: 'Bed Sheet',          category: 'Linen',    unit: 'pcs', minStock: 10 },
  { id: 3, name: 'Pillow',             category: 'Linen',    unit: 'pcs', minStock: 10 },
  { id: 4, name: 'Pillow Cover',       category: 'Linen',    unit: 'pcs', minStock: 10 },
  { id: 5, name: 'Bath Towel',         category: 'Linen',    unit: 'pcs', minStock: 10 },
  { id: 6, name: 'Hand Towel',         category: 'Linen',    unit: 'pcs', minStock: 10 },
  { id: 7, name: 'Mattress Protector', category: 'Linen',    unit: 'pcs', minStock: 5  },
  { id: 8, name: 'Soap Bar',           category: 'Toiletry', unit: 'pcs', minStock: 20 },
  { id: 9, name: 'Shampoo Sachet',     category: 'Toiletry', unit: 'pcs', minStock: 20 },
];

function ls(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function initRooms() {
  if (localStorage.getItem('ga_rooms_ver') === GA_ROOMS_VER && localStorage.getItem('ga_rooms')) {
    return JSON.parse(localStorage.getItem('ga_rooms')) || DEFAULT_ROOMS.map(r => ({ ...r }));
  }
  return DEFAULT_ROOMS.map(r => ({ ...r }));
}

const AppContext = createContext(null);

// ── Hotel deleted-ID ledger — a record deleted here can never be re-pushed
// from a stale cache on this or another sync cycle (prevents resurrection).
const GA_DELETED_KEY = 'ga_deleted_ids_v1';
export function gaLoadDeleted() {
  try { return JSON.parse(localStorage.getItem(GA_DELETED_KEY) || '{}'); } catch { return {}; }
}
export function gaRecordDeleted(kind, id) {
  try {
    const m = gaLoadDeleted();
    m[kind] = [...new Set([...(m[kind] || []), String(id)])].slice(-500);
    localStorage.setItem(GA_DELETED_KEY, JSON.stringify(m));
  } catch {}
}

export function AppProvider({ children }) {
  // Auth — restore session from localStorage so page refresh keeps you logged in
  const [curRole, setCurRole] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('ga_sess')); return s?.role || ''; } catch { return ''; }
  });
  const [curUser, setCurUser] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('ga_sess')); return s?.user || ''; } catch { return ''; }
  });

  // Track last local rooms edit so poll doesn't overwrite it before Supabase save completes
  const roomsEditedAt = useRef(0);

  // Core data
  const [rooms,        setRoomsRaw]   = useState(initRooms);
  const [bookings,     setBookings]   = useState(() => ls('ga_bookings', []));
  const [revenues,     setRevenues]   = useState(() => ls('ga_revenues', []));
  const [expenses,     setExpenses]   = useState(() => ls('ga_expenses', []));
  const [expTypes,     setExpTypesRaw] = useState(() => ls('ga_exp_types', {}));
  // Companions (spouse/group members with phones) per booking id — synced via app_config
  const [companionsMap, setCompanionsMap] = useState(() => ls('ga_companions', {}));
  const [loyaltyData,  setLoyalty]    = useState(() => ls('ga_loyalty', {}));
  const [surveyData,   setSurveys]    = useState(() => ls('ga_surveys', []));
  const [guestProfiles,setGuests]     = useState(() => ls('ga_guests', {}));
  const [pricingRules, setPricing]    = useState(() => ls('ga_pricing', null) || DEFAULT_PRICING);
  const [loyaltyRules, setLoyaltyRules] = useState(() => ls('ga_loyalty_rules', null) || DEFAULT_LOYALTY_RULES);
  const [invItems,     setInvItems]   = useState(() => ls('ga_inv_items', null) || DEFAULT_INV.map(i => ({ ...i })));
  const [extraPersonRules, setExtraPersonRules] = useState(() => ls('ga_extra_person', null) || { threshold: 3, charge: 300 });
  const [smsTemplates, setSmsTemplatesRaw] = useState(() => ls('ga_sms_tpl', null) || DEFAULT_SMS_TEMPLATES);

  const setSmsTemplates = useCallback((next) => {
    const val = typeof next === 'function' ? next(smsTemplates) : next;
    setSmsTemplatesRaw(val);
    localStorage.setItem('ga_sms_tpl', JSON.stringify(val));
    if (hasHotelSupabaseConfig()) {
      const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_ANON_KEY } = import.meta.env || {};
      const url = (VITE_SUPABASE_URL || '').trim();
      const key = (VITE_SUPABASE_PUBLISHABLE_KEY || VITE_SUPABASE_ANON_KEY || '').trim();
      if (url && key) {
        fetch(url.replace(/\/$/, '') + '/rest/v1/app_config', {
          method: 'POST',
          headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ key: 'hotel_sms_tpl', value: val, updated_at: new Date().toISOString() }),
        }).catch(() => {});
      }
    }
  }, [smsTemplates]);

  // Syncing setters for config data
  const updatePricing = useCallback((next) => {
    setPricing(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_pricing', JSON.stringify(val));
      if (hasSupabase()) saveConfig('hotel_pricing', val).catch(() => {});
      return val;
    });
  }, []);

  const updateLoyaltyRules = useCallback((next) => {
    setLoyaltyRules(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_loyalty_rules', JSON.stringify(val));
      if (hasSupabase()) saveConfig('hotel_loyalty_rules', val).catch(() => {});
      return val;
    });
  }, []);

  const updateLoyalty = useCallback((next) => {
    setLoyalty(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_loyalty', JSON.stringify(val));
      if (hasSupabase()) saveConfig('hotel_loyalty_data', val).catch(() => {});
      return val;
    });
  }, []);

  const updateInvItems = useCallback((next) => {
    setInvItems(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_inv_items', JSON.stringify(val));
      if (hasSupabase()) saveConfig('hotel_inv_items', val).catch(() => {});
      return val;
    });
  }, []);

  const updateExtraPersonRules = useCallback((next) => {
    setExtraPersonRules(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_extra_person', JSON.stringify(val));
      if (hasSupabase()) saveConfig('hotel_extra_person', val).catch(() => {});
      return val;
    });
  }, []);

  const updateSurveys = useCallback((next) => {
    setSurveys(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_surveys', JSON.stringify(val));
      if (hasSupabase()) saveConfig('hotel_surveys', val).catch(() => {});
      return val;
    });
  }, []);

  // Central Supabase sync function — called on mount, on tab focus, and every 60s
  const syncFromSupabase = useCallback((opts = {}) => {
    if (!hasHotelSupabaseConfig()) return;
    const { silent = true } = opts;

    // Always sync ntfy config so notifications work from any device
    syncNtfyConfigFromSupabase().catch(() => {});

    // Pull password changes made on other devices
    restoreUserPasswords().catch(() => {});

    // Sync rooms — but skip if edited locally within last 30s to avoid overwriting a save in progress
    const roomsRecentlyEdited = Date.now() - roomsEditedAt.current < 30_000;
    if (!roomsRecentlyEdited) {
      loadRoomsFromSupabase()
        .then((remoteRooms) => {
          if (!remoteRooms) return;
          setRoomsRaw(remoteRooms);
          localStorage.setItem('ga_rooms_ver', GA_ROOMS_VER);
          localStorage.setItem('ga_rooms', JSON.stringify(remoteRooms));
        })
        .catch(() => {});
    }

    // Sync bookings
    loadHotelBookingsFromSupabase()
      .then((remoteBookings) => {
        if (!Array.isArray(remoteBookings) || remoteBookings.length === 0) return;
        const deletedIds = (() => {
          try { return new Set(JSON.parse(localStorage.getItem('ga_deleted_booking_ids') || '[]')); }
          catch { return new Set(); }
        })();
        const filtered = remoteBookings.filter(b => {
          const sbId = String(b.supabaseBookingId ?? b.id ?? '');
          const localId = String(b.id ?? '');
          return !deletedIds.has(sbId) && !deletedIds.has(localId);
        });
        // Preserve fields not in Supabase schema by merging with local version.
        const localSnap = (() => { try { return JSON.parse(localStorage.getItem('ga_bookings') || '[]'); } catch { return []; } })();
        // Companions synced via app_config — lets other devices restore spouse/group members
        const compSnap = (() => { try { return JSON.parse(localStorage.getItem('ga_companions') || '{}'); } catch { return {}; } })();
        const merged = filtered.map(sb => {
          // Match by Supabase id (local ids are now collision-proof and differ
          // from the cloud serial id), falling back to a plain id match for
          // legacy bookings created before the id-collision fix.
          const loc = localSnap.find(l => String(l.supabaseBookingId ?? l.id) === String(sb.id));
          const comp = compSnap[String(sb.id)] || null;
          if (!loc && !comp) return sb;
          const l = loc || {};
          return {
            ...sb,
            discAmt:          sb.discAmt        || l.discAmt        || 0,
            discType:         sb.discType       || l.discType       || "",
            discReason:       sb.discReason     || l.discReason     || "",
            baseAmount:       sb.baseAmount     || l.baseAmount     || 0,
            // No Supabase column — always restore from local
            invoiceExtras:    l.invoiceExtras?.length  ? l.invoiceExtras  : (sb.invoiceExtras  || []),
            extrasAdvance:    l.extrasAdvance != null  ? l.extrasAdvance  : (sb.extrasAdvance  || 0),
            paymentHistory:   l.paymentHistory?.length ? l.paymentHistory : (sb.paymentHistory || []),
            extraPersonCharge: l.extraPersonCharge || sb.extraPersonCharge || null,
            invoiceDate:      l.invoiceDate    || sb.invoiceDate    || "",
            tcPrinted:        l.tcPrinted      || sb.tcPrinted      || false,
            guestType:        l.guestType      || sb.guestType      || comp?.guestType || "single",
            spouseName:       l.spouseName     || sb.spouseName     || comp?.spouseName || "",
            spousePhone:      l.spousePhone    || sb.spousePhone    || comp?.spousePhone || "",
            groupMembers:     l.groupMembers?.length ? l.groupMembers : (sb.groupMembers?.length ? sb.groupMembers : (comp?.groupMembers || [])),
          };
        });
        // Never drop local bookings that haven't reached Supabase (failed insert) —
        // keep them visible and retry the push, so a save failure can't silently
        // lose a booking on the next sync.
        const remoteIds2 = new Set(filtered.map(b => String(b.id)));
        const localOnly = localSnap.filter(l =>
          l && l.id != null && l.guest &&
          !remoteIds2.has(String(l.id)) &&
          !remoteIds2.has(String(l.supabaseBookingId ?? '')) &&
          !deletedIds.has(String(l.id)) &&
          !deletedIds.has(String(l.supabaseBookingId ?? ''))
        );
        localOnly.forEach(b => { persistHotelBookingBundle(b).catch(() => {}); });
        const withLocalOnly = [...merged, ...localOnly];
        setBookings(withLocalOnly);
        const cutoff2 = new Date(); cutoff2.setMonth(cutoff2.getMonth() - 6);
        const cutoffStr2 = cutoff2.toISOString().slice(0, 10);
        const trimmed2 = withLocalOnly.filter(b => ['confirmed','checked-in'].includes(b.status) || (b.checkout && b.checkout >= cutoffStr2));
        try { localStorage.setItem('ga_bookings', JSON.stringify(trimmed2)); } catch { /* quota full */ }
      })
      .catch((err) => {
        console.error("Failed to load hotel bookings from Supabase:", err);
      });

    // Sync revenues — only last 2 months to reduce egress
    const revCutoff = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) + "-01"; })();
    loadRows("revenues", `&date=gte.${revCutoff}`)
      .then(rows => {
        const localRevs = (() => { try { return JSON.parse(localStorage.getItem('ga_revenues') || '[]'); } catch { return []; } })();
        const remoteIds = new Set((rows || []).map(r => String(r.id)));
        // Push any local revenues that are missing from Supabase
        const missing = localRevs.filter(r => !remoteIds.has(String(r.id)));
        if (missing.length > 0) {
          const dbRows = missing.map(r => ({ id: String(r.id), date: r.date, source: r.source || 'Room Rent', amount: r.amount || 0, note: r.note || '', by: r.by || '', booking_id: r.bookingId || null }));
          upsertRows("revenues", dbRows).catch(() => {});
        }
        if (rows && rows.length > 0) {
          // Merge Supabase rows with any local-only rows not yet confirmed
          const remoteRevs = rows.map(r => ({ id: r.id, date: r.date, source: r.source, amount: r.amount, note: r.note, by: r.by, bookingId: r.booking_id }));
          const merged = [...remoteRevs, ...missing];
          setRevenues(merged);
          localStorage.setItem('ga_revenues', JSON.stringify(merged));
        } else if (localRevs.length > 0) {
          const dbRows = localRevs.map(r => ({ id: String(r.id), date: r.date, source: r.source || 'Room Rent', amount: r.amount || 0, note: r.note || '', by: r.by || '', booking_id: r.bookingId || null }));
          upsertRows("revenues", dbRows).catch(() => {});
        }
      }).catch(() => {});

    // Sync expenses — pull remote, but NEVER drop local rows that failed to
    // reach Supabase; keep them and re-push (a sync must never lose data).
    loadRows("expenses", "&order=date.desc")
      .then(rows => {
        if (!rows || !rows.length) return;
        const exps = rows.map(r => ({ id: r.id, date: r.date, category: r.category, amount: r.amount, note: r.note, by: r.by }));
        const localExps = (() => { try { return JSON.parse(localStorage.getItem('ga_expenses') || '[]'); } catch { return []; } })();
        const delExp = new Set(gaLoadDeleted().exp || []);
        const remoteIds = new Set(exps.map(e => String(e.id)));
        const localOnly = localExps.filter(e => e && e.id != null && !remoteIds.has(String(e.id)) && !delExp.has(String(e.id)));
        if (localOnly.length) {
          upsertRows("expenses", localOnly.map(e => ({ id: String(e.id), date: e.date, category: e.category || "", amount: e.amount || 0, note: e.note || "", by: e.by || "" }))).catch(() => {});
        }
        const mergedExps = [...exps, ...localOnly];
        setExpenses(mergedExps);
        localStorage.setItem('ga_expenses', JSON.stringify(mergedExps));
      }).catch(() => {});

    // Sync all config from app_config in one request
    const sbUrl = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
    const sbKey = ((import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY) || '').trim();
    if (sbUrl && sbKey) {
      const configKeys = ['hotel_guest_profiles','hotel_sms_tpl','hotel_pricing','hotel_loyalty_rules','hotel_loyalty_data','hotel_inv_items','hotel_extra_person','hotel_surveys','hotel_staff','hotel_login_monitor','hotel_recovery_emails','hotel_exp_types','hotel_booking_companions','hall_staff_renames','hall_sms_config'];
      fetch(sbUrl.replace(/\/$/, '') + '/rest/v1/app_config?key=in.(' + configKeys.join(',') + ')', {
        headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey },
      })
        .then(r => r.json())
        .then(rows => {
          if (!Array.isArray(rows)) return;
          rows.forEach(row => {
            const v = row.value;
            if (!v) return;
            switch (row.key) {
              case 'hotel_guest_profiles':
                if (typeof v === 'object') { setGuests(v); localStorage.setItem('ga_guests', JSON.stringify(v)); }
                break;
              case 'hotel_sms_tpl':
                if (typeof v === 'object') { setSmsTemplatesRaw(v); localStorage.setItem('ga_sms_tpl', JSON.stringify(v)); }
                break;
              case 'hotel_pricing':
                if (Array.isArray(v)) { setPricing(v); localStorage.setItem('ga_pricing', JSON.stringify(v)); }
                break;
              case 'hotel_loyalty_rules':
                if (typeof v === 'object') { setLoyaltyRules(v); localStorage.setItem('ga_loyalty_rules', JSON.stringify(v)); }
                break;
              case 'hotel_loyalty_data':
                if (typeof v === 'object') { setLoyalty(v); localStorage.setItem('ga_loyalty', JSON.stringify(v)); }
                break;
              case 'hotel_inv_items':
                if (Array.isArray(v)) { setInvItems(v); localStorage.setItem('ga_inv_items', JSON.stringify(v)); }
                break;
              case 'hotel_extra_person':
                if (typeof v === 'object') { setExtraPersonRules(v); localStorage.setItem('ga_extra_person', JSON.stringify(v)); }
                break;
              case 'hotel_surveys':
                if (Array.isArray(v)) { setSurveys(v); localStorage.setItem('ga_surveys', JSON.stringify(v)); }
                break;
              case 'hotel_staff':
                if (Array.isArray(v)) localStorage.setItem('ga_staff', JSON.stringify(v));
                break;
              case 'hotel_login_monitor':
                if (v !== null && v !== undefined) localStorage.setItem('ga_login_monitor', JSON.stringify(v));
                break;
              case 'hotel_recovery_emails':
                if (Array.isArray(v)) localStorage.setItem('ga_recovery_emails', JSON.stringify(v));
                break;
              case 'hotel_exp_types':
                if (typeof v === 'object') {
                  setExpTypesRaw(prev => {
                    // Merge: cloud wins for existing keys, keep local-only keys
                    const merged = { ...prev, ...v };
                    localStorage.setItem('ga_exp_types', JSON.stringify(merged));
                    return merged;
                  });
                }
                break;
              case 'hotel_booking_companions':
                if (typeof v === 'object') {
                  setCompanionsMap(prev => {
                    const merged = { ...prev, ...v };
                    localStorage.setItem('ga_companions', JSON.stringify(merged));
                    return merged;
                  });
                }
                break;
              case 'hall_staff_renames':
                if (typeof v === 'object') localStorage.setItem('a_renames', JSON.stringify(v));
                break;
              case 'hall_sms_config':
                if (typeof v === 'object') localStorage.setItem('ga_sms_config', JSON.stringify(v));
                break;
            }
          });
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!hasHotelSupabaseConfig()) return undefined;

    // Initial load — also fetch expenses/revenues
    syncFromSupabase({ silent: false });

    // Re-sync when tab becomes visible (catches edits made on another device)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncFromSupabase();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Poll every 60s as fallback
    const interval = setInterval(() => syncFromSupabase(), 60_000);

    // Instant broadcast ping from other devices (works even when the
    // postgres_changes publication is not enabled on the project)
    let pingTimer = null;
    const offPing = onRemoteChange(() => {
      clearTimeout(pingTimer);
      pingTimer = setTimeout(() => syncFromSupabase(), 500);
    });

    // Realtime — instant push from Supabase on any data change (< 1 second)
    let realtimeChannel = null;
    if (supabase) {
      realtimeChannel = supabase
        .channel("hotel-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
          loadHotelBookingsFromSupabase().then(remoteBookings => {
            if (!Array.isArray(remoteBookings) || !remoteBookings.length) return;
            const deletedIds = (() => { try { return new Set(JSON.parse(localStorage.getItem('ga_deleted_booking_ids') || '[]')); } catch { return new Set(); } })();
            const filtered = remoteBookings.filter(b => !deletedIds.has(String(b.supabaseBookingId ?? b.id ?? '')) && !deletedIds.has(String(b.id ?? '')));
            setBookings(filtered);
            const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6);
            const cutoffStr = cutoff.toISOString().slice(0, 10);
            try { localStorage.setItem('ga_bookings', JSON.stringify(filtered.filter(b => ['confirmed','checked-in'].includes(b.status) || (b.checkout && b.checkout >= cutoffStr)))); } catch {}
          }).catch(() => {});
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "revenues" }, () => {
          const revCutoff = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) + "-01"; })();
          loadRows("revenues", `&date=gte.${revCutoff}`).then(rows => {
            if (!rows?.length) return;
            const revs = rows.map(r => ({ id: r.id, date: r.date, source: r.source, amount: r.amount, note: r.note, by: r.by, bookingId: r.booking_id }));
            setRevenues(revs);
            try { localStorage.setItem('ga_revenues', JSON.stringify(revs)); } catch {}
          }).catch(() => {});
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
          loadRows("expenses", "&order=date.desc").then(rows => {
            if (!rows?.length) return;
            const exps = rows.map(r => ({ id: r.id, date: r.date, category: r.category, amount: r.amount, note: r.note, by: r.by }));
            const localExps = (() => { try { return JSON.parse(localStorage.getItem('ga_expenses') || '[]'); } catch { return []; } })();
            const delExp = new Set(gaLoadDeleted().exp || []);
            const remoteIds = new Set(exps.map(e => String(e.id)));
            const localOnly = localExps.filter(e => e && e.id != null && !remoteIds.has(String(e.id)) && !delExp.has(String(e.id)));
            const mergedExps = [...exps, ...localOnly];
            setExpenses(mergedExps);
            try { localStorage.setItem('ga_expenses', JSON.stringify(mergedExps)); } catch {}
          }).catch(() => {});
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "app_config" }, () => {
          syncFromSupabase();
        })
        .subscribe();
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
      clearTimeout(pingTimer);
      offPing();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [syncFromSupabase]);

  // Safety: remove stuck hotel-print-mode class whenever tab becomes visible
  useEffect(() => {
    const clearPrintMode = () => document.body.classList.remove('hotel-print-mode');
    document.addEventListener('visibilitychange', clearPrintMode);
    return () => document.removeEventListener('visibilitychange', clearPrintMode);
  }, []);

  // UI
  const [activeTab,      setActiveTab]      = useState('desk');
  const [adminTab,       setAdminTab]       = useState('finance');
  const [notification,   setNotification]   = useState(null);
  const [modal,          setModal]          = useState(null); // { content: JSX }
  const [pendingInvoiceId, setPendingInvoiceId] = useState(null);

  // Persist helpers
  const save = useCallback((nextBookings, nextRevenues, nextExpenses, nextRooms) => {
    const b = nextBookings ?? bookings;
    const r = nextRevenues ?? revenues;
    const e = nextExpenses ?? expenses;
    const rm = nextRooms ?? rooms;
    localStorage.setItem('ga_rooms_ver', GA_ROOMS_VER);
    localStorage.setItem('ga_rooms', JSON.stringify(rm));
    localStorage.setItem('ga_bookings', JSON.stringify(b));
    localStorage.setItem('ga_revenues', JSON.stringify(r));
    localStorage.setItem('ga_expenses', JSON.stringify(e));
  }, [bookings, revenues, expenses, rooms]);

  const setRooms = useCallback((next, onSynced) => {
    setRoomsRaw(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_rooms_ver', GA_ROOMS_VER);
      localStorage.setItem('ga_rooms', JSON.stringify(val));
      roomsEditedAt.current = Date.now();
      saveRoomsToSupabase(val)
        .then(() => onSynced && onSynced(true))
        .catch(() => onSynced && onSynced(false));
      return val;
    });
  }, []);

  const updateGuests = useCallback((next) => {
    setGuests(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_guests', JSON.stringify(val));
      const gSbUrl = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
      const gSbKey = ((import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY) || '').trim();
      if (gSbUrl && gSbKey) {
        fetch(gSbUrl.replace(/\/$/, '') + '/rest/v1/app_config', {
          method: 'POST',
          headers: { apikey: gSbKey, Authorization: 'Bearer ' + gSbKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ key: 'hotel_guest_profiles', value: val, updated_at: new Date().toISOString() }),
        }).catch(() => {});
      }
      return val;
    });
  }, []);

  const updateBookings = useCallback((next) => {
    setBookings(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      // Keep only last 6 months + active bookings to avoid localStorage quota exceeded
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const trimmed = val.filter(b =>
        ['confirmed','checked-in'].includes(b.status) ||
        (b.checkout && b.checkout >= cutoffStr)
      );
      try { localStorage.setItem('ga_bookings', JSON.stringify(trimmed)); } catch { /* quota full */ }
      return val; // React state always has full data
    });
  }, []);

  // Daily rolling cloud backup — runs once per day, 90s after load so the
  // initial sync has settled and the snapshot reflects fresh data.
  useEffect(() => {
    const t = setTimeout(() => runDailyBackup(), 90_000);
    return () => clearTimeout(t);
  }, []);

  // Push companion info (spouse/group members) to Supabase app_config whenever
  // bookings change — there's no bookings column for it, and it must reach all devices.
  useEffect(() => {
    const comp = {};
    bookings.forEach(b => {
      if (b.spouseName || b.spousePhone || (b.groupMembers && b.groupMembers.length)) {
        comp[String(b.id)] = {
          guestType: b.guestType || "single",
          spouseName: b.spouseName || "", spousePhone: b.spousePhone || "",
          groupMembers: b.groupMembers || [],
        };
      }
    });
    if (!Object.keys(comp).length) return;
    setCompanionsMap(prev => {
      const merged = { ...prev, ...comp };
      if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
      try { localStorage.setItem('ga_companions', JSON.stringify(merged)); } catch { /* quota */ }
      if (hasSupabase()) saveConfig('hotel_booking_companions', merged).catch(() => {});
      return merged;
    });
  }, [bookings]);

  const updateRevenues = useCallback((next) => {
    setRevenues(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem('ga_revenues', JSON.stringify(val)); } catch { /* quota full */ }
      if (hasSupabase()) {
        const rows = val.map(r => ({ id: String(r.id), date: r.date, source: r.source, amount: r.amount || 0, note: r.note || "", by: r.by || "", booking_id: r.bookingId || null }));
        upsertRows("revenues", rows).catch(() => {});
      }
      return val;
    });
  }, []);

  const updateExpenses = useCallback((next) => {
    setExpenses(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem('ga_expenses', JSON.stringify(val)); } catch { /* quota full */ }
      if (hasSupabase()) {
        const rows = val.map(e => ({ id: String(e.id), date: e.date, category: e.category, amount: e.amount || 0, note: e.note || "", by: e.by || "" }));
        upsertRows("expenses", rows).catch(() => {});
      }
      return val;
    });
  }, []);

  // ── Expense type map (business/nonbusiness) — source of truth is Supabase app_config ──
  const setExpenseType = useCallback((id, type) => {
    setExpTypesRaw(prev => {
      const v = { ...prev, [String(id)]: type };
      localStorage.setItem('ga_exp_types', JSON.stringify(v));
      if (hasSupabase()) saveConfig('hotel_exp_types', v).catch(() => {});
      return v;
    });
  }, []);

  const removeExpenseType = useCallback((id) => {
    setExpTypesRaw(prev => {
      const v = { ...prev };
      delete v[String(id)];
      localStorage.setItem('ga_exp_types', JSON.stringify(v));
      if (hasSupabase()) saveConfig('hotel_exp_types', v).catch(() => {});
      return v;
    });
  }, []);

  const notify = useCallback((msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3200);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ga_sess');
    setCurRole('');
    setCurUser('');
  }, []);

  const login = useCallback((user, role) => {
    localStorage.setItem('ga_sess', JSON.stringify({ user, role }));
    setCurUser(user);
    setCurRole(role);
  }, []);

  return (
    <AppContext.Provider value={{
      // auth
      curRole, curUser, login, logout,
      // data
      rooms, setRooms,
      bookings, updateBookings,
      revenues, updateRevenues,
      expenses, updateExpenses,
      expTypes, setExpenseType, removeExpenseType,
      loyaltyData, setLoyalty: updateLoyalty,
      surveyData, setSurveys: updateSurveys,
      guestProfiles, setGuests, updateGuests,
      pricingRules, setPricing: updatePricing,
      loyaltyRules, setLoyaltyRules: updateLoyaltyRules,
      invItems, setInvItems: updateInvItems,
      extraPersonRules, setExtraPersonRules: updateExtraPersonRules,
      smsTemplates, setSmsTemplates,
      save,
      // ui
      activeTab, setActiveTab,
      adminTab, setAdminTab,
      notification,
      notify,
      modal, setModal,
      pendingInvoiceId, setPendingInvoiceId,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
