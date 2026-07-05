import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { hasHotelSupabaseConfig, loadHotelBookingsFromSupabase, loadRoomsFromSupabase, saveRoomsToSupabase } from "../lib/hotelSupabase";
import { hasSupabase, upsertRows, loadRows } from "../utils/supabaseSync";
import { syncNtfyConfigFromSupabase } from "../utils/ntfy";

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

  // Central Supabase sync function — called on mount, on tab focus, and every 60s
  const syncFromSupabase = useCallback((opts = {}) => {
    if (!hasHotelSupabaseConfig()) return;
    const { silent = true } = opts;

    // Always sync ntfy config so notifications work from any device
    syncNtfyConfigFromSupabase().catch(() => {});

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
        setBookings(filtered);
        localStorage.setItem('ga_bookings', JSON.stringify(filtered));
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

    // Sync expenses (only on initial load)
    if (!silent) {
      loadRows("expenses")
        .then(rows => {
          if (!rows || !rows.length) return;
          const exps = rows.map(r => ({ id: r.id, date: r.date, category: r.category, amount: r.amount, note: r.note, by: r.by }));
          setExpenses(exps);
          localStorage.setItem('ga_expenses', JSON.stringify(exps));
        }).catch(() => {});
    }

    // Sync guest profiles and SMS templates from app_config
    const sbUrl = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
    const sbKey = ((import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY) || '').trim();
    if (sbUrl && sbKey) {
      fetch(sbUrl.replace(/\/$/, '') + '/rest/v1/app_config?key=in.(hotel_guest_profiles,hotel_sms_tpl)', {
        headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey },
      })
        .then(r => r.json())
        .then(rows => {
          if (!Array.isArray(rows)) return;
          rows.forEach(row => {
            if (row.key === 'hotel_guest_profiles' && row.value && typeof row.value === 'object') {
              setGuests(row.value);
              localStorage.setItem('ga_guests', JSON.stringify(row.value));
            }
            if (row.key === 'hotel_sms_tpl' && row.value && typeof row.value === 'object') {
              setSmsTemplatesRaw(row.value);
              localStorage.setItem('ga_sms_tpl', JSON.stringify(row.value));
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

    // Poll every 5 minutes — tab focus (visibilitychange) catches most real-time needs
    const interval = setInterval(() => syncFromSupabase(), 300_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [syncFromSupabase]);

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
      localStorage.setItem('ga_bookings', JSON.stringify(val));
      return val;
    });
  }, []);

  const updateRevenues = useCallback((next) => {
    setRevenues(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('ga_revenues', JSON.stringify(val));
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
      localStorage.setItem('ga_expenses', JSON.stringify(val));
      if (hasSupabase()) {
        const rows = val.map(e => ({ id: String(e.id), date: e.date, category: e.category, amount: e.amount || 0, note: e.note || "", by: e.by || "" }));
        upsertRows("expenses", rows).catch(() => {});
      }
      return val;
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
      loyaltyData, setLoyalty,
      surveyData, setSurveys,
      guestProfiles, setGuests, updateGuests,
      pricingRules, setPricing,
      loyaltyRules, setLoyaltyRules,
      invItems, setInvItems,
      extraPersonRules, setExtraPersonRules,
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
