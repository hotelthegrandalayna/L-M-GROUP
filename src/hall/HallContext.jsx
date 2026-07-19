
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { hasHallSupabaseConfig, loadHallInvoicesFromSupabase, persistHallInvoiceBundle } from "./lib/hallSupabase";
import { hasSupabase, upsertRow, upsertRows, deleteRow, loadRows } from "../utils/supabaseSync";
import { restoreUserPasswords } from "../utils/userPass";
import { onRemoteChange } from "../utils/realtimeSync";
import { syncNtfyConfigFromSupabase } from "../utils/ntfy";
import { runDailyBackup } from "../utils/dailyBackup";
import { supabase } from "../lib/supabaseClient";

const Ctx = createContext(null);

const BASE_USERS = {
  admin:  { pass: "amelia2024", role: "admin"  },
  staff:  { pass: "staff123",   role: "staff"  },
  staff2: { pass: "staff456",   role: "staff"  },
};

function resolveUsers() {
  const u = {};
  Object.keys(BASE_USERS).forEach(k => { u[k] = { ...BASE_USERS[k] }; });
  Object.keys(u).forEach(k => { const s = localStorage.getItem("a_pass_" + k); if (s) u[k].pass = s; });
  try {
    const rn = JSON.parse(localStorage.getItem("a_renames") || "{}");
    Object.keys(rn).forEach(old => {
      const nw = rn[old]; if (!nw || old === nw) return;
      const e = u[old] || BASE_USERS[old]; if (!e) return;
      u[nw] = { ...e }; delete u[old];
      const s = localStorage.getItem("a_pass_" + nw); if (s) u[nw].pass = s;
    });
  } catch {}
  return u;
}

function loadLS(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") || def; } catch { return def; } }

// ── Deleted-ID ledger — a record deleted on this device can never be
// re-pushed to the cloud from a stale cache (prevents resurrection).
const DELETED_IDS_KEY = "a_deleted_ids_v1";
export function loadDeletedIds() {
  try { return JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || "{}"); } catch { return {}; }
}
export function recordDeletedId(kind, id) {
  try {
    const m = loadDeletedIds();
    m[kind] = [...new Set([...(m[kind] || []), String(id)])].slice(-500);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(m));
  } catch {}
}
// Local rows missing from the cloud (failed save) are KEPT and re-pushed —
// a sync must never erase data that only exists on this device.
function localOnlyRows(remote, cacheKey, kind) {
  let local = []; try { local = JSON.parse(localStorage.getItem(cacheKey) || "[]"); } catch {}
  if (!Array.isArray(local)) return [];
  const del = new Set(loadDeletedIds()[kind] || []);
  const rIds = new Set(remote.map(x => String(x.id)));
  return local.filter(x => x && x.id != null && !rIds.has(String(x.id)) && !del.has(String(x.id)));
}

export const EV_TYPES = [
  { v:"Wedding",        i:"💒", g:"wedding", bg:"#fff0f0", border:"#e07070", accent:"#9B1212" },
  { v:"Holud",          i:"🌼", g:"holud",   bg:"#fffbe8", border:"#d4a800", accent:"#8a6200" },
  { v:"Wedding + Holud",i:"💒🌼",g:"wh",    bg:"#f5f0ff", border:"#9370DB", accent:"#6030b0" },
  { v:"Reception",      i:"🎊", g:"wedding", bg:"#f0f8ff", border:"#4a90d9", accent:"#1a5fa0" },
  { v:"Engagement",     i:"💍", g:"wedding", bg:"#fff0f8", border:"#d060a0", accent:"#a03070" },
  { v:"Mazbani",        i:"🍛", g:"generic", bg:"#fdf4e8", border:"#c98a3a", accent:"#8a5a10" },
  { v:"Birthday",       i:"🎂", g:"generic", bg:"#fff5ee", border:"#e0803a", accent:"#b05010" },
  { v:"Corporate Event",i:"🏢", g:"generic", bg:"#f0f4ff", border:"#4060c8", accent:"#204090" },
  { v:"Others",         i:"🎉", g:"generic", bg:"#f0fff4", border:"#30a060", accent:"#1a7040" },
];

export const EXP_CATS = {
  "Salary":         { i:"👤", bg:"rgba(52,152,219,.15)",  c:"#1a5276" },
  "Electricity":    { i:"⚡", bg:"rgba(241,196,15,.18)",   c:"#7d6608" },
  "Generator Oil":  { i:"🛢️",bg:"rgba(230,126,34,.18)",   c:"#784212" },
  "Internet":       { i:"🌐", bg:"rgba(142,68,173,.12)",   c:"#6c3483" },
  "Food & Kitchen": { i:"🍳", bg:"rgba(231,76,60,.12)",    c:"#922b21" },
  "Cleaning":       { i:"🧹", bg:"rgba(39,174,96,.12)",    c:"#1e8449" },
  "Maintenance":    { i:"🔧", bg:"rgba(149,165,166,.15)",  c:"#566573" },
  "Equipment":      { i:"📦", bg:"rgba(201,168,76,.15)",   c:"#7d6608" },
  "Security":       { i:"🔐", bg:"rgba(52,73,94,.15)",     c:"#2c3e50" },
  "Marketing":      { i:"📣", bg:"rgba(155,89,182,.12)",   c:"#6c3483" },
  "Tax":            { i:"📋", bg:"rgba(192,57,43,.12)",    c:"#922b21" },
  "Donation":       { i:"🤲", bg:"rgba(39,174,96,.15)",    c:"#1e8449" },
  "Personal Salary":{ i:"💼", bg:"rgba(155,89,182,.18)",   c:"#6c3483" },
  "Personal Other": { i:"👤", bg:"rgba(155,89,182,.12)",   c:"#6c3483" },
  "Other":          { i:"📌", bg:"rgba(0,0,0,.06)",        c:"#566573" },
};

export const PERSONAL_CATS = ["Personal Salary", "Donation", "Personal Other"];

// ── Expense type (business / nonbusiness) — single source of truth ─────────
// The type map is stored in Supabase app_config (key "hall_exp_types") and
// synced to every device. localStorage is only an offline cache.
const NONBIZ_CATS = ["Personal Salary", "Personal Other", "Donation", "Bank Transfer", "Owner Withdrawal", "Lending", "Personal Use", "Other Transfer"];
export function getExpTypesMap() {
  try { return JSON.parse(localStorage.getItem("a_exp_types_v2") || "{}"); } catch { return {}; }
}
export function expenseType(e, map = getExpTypesMap()) {
  const t = map[String(e.id)] || e.expType;
  if (t === "nonbusiness") return "nonbusiness";
  if (t === "business") return "business";
  // No explicit type known — infer from category (non-business categories are unique)
  if (["personal"].includes(t) || NONBIZ_CATS.includes(e.cat)) return "nonbusiness";
  return "business";
}
// Only business expenses count toward profit — use this in every P&L/profit calc
export function businessExpensesOnly(expenses, map = getExpTypesMap()) {
  return expenses.filter(e => expenseType(e, map) === "business");
}

// ── Single source of truth for invoice money math ──────────────────────────
// Every page MUST use these so Billed = Collected + Outstanding always holds.
export const invBilled      = inv => inv.grand || 0;
export const invOutstanding = inv => Math.max(0, (inv.grand || 0) - (parseFloat(inv.adv) || 0));
export const invCollected   = inv => invBilled(inv) - invOutstanding(inv);
// Month bucketing: event date first, invoice date as fallback
export const invInMonth     = (inv, m) => (inv.evDate || inv.invDate || "").startsWith(m);
export const sumBy = (list, fn) => list.reduce((s, x) => s + fn(x), 0);

export function checkHallAdminPass(pw) {
  const stored = localStorage.getItem("a_pass_admin");
  return pw === (stored || BASE_USERS.admin.pass);
}

export function hallLogin(user, pass) {
  const users = resolveUsers();
  const key = Object.keys(users).find(k => k.toLowerCase() === user.trim().toLowerCase());
  if (!key) return null;
  const u = users[key];
  const stored = localStorage.getItem("a_pass_" + key);
  if ((stored || u.pass) === pass) return { user: key, role: u.role };
  return null;
}

export function HallProvider({ children }) {
  const [curUser, setCurUser] = useState(() => { const s = loadLS("a_sess", null); return s?.user || ""; });
  const [curRole, setCurRole] = useState(() => { const s = loadLS("a_sess", null); return s?.role || ""; });
  const [invoices, setInvoicesRaw] = useState(() => loadLS("a_inv", []));
  const [expenses, setExpensesRaw] = useState(() => loadLS("a_exp", []));
  const [revenues, setRevenuesRaw] = useState(() => loadLS("a_hall_rev", []));
  const [leads,    setLeadsRaw]    = useState(() => loadLS("a_crm_leads", []));
  const [expTypes, setExpTypesRaw] = useState(() => loadLS("a_exp_types_v2", {}));
  const [activeTab, setActiveTab] = useState("invoice");
  const [notification, setNotification] = useState(null);
  const [invoiceJumpSignal, setInvoiceJumpSignal] = useState(0);
  const bumpInvoiceJump = useCallback(() => setInvoiceJumpSignal(n => n+1), []);

  const syncHallFromSupabase = useCallback(async () => {
    if (!hasHallSupabaseConfig()) return;

    syncNtfyConfigFromSupabase().catch(() => {});

    // Pull password changes made on other devices
    restoreUserPasswords().catch(() => {});

    try {
      const remoteInvoices = await loadHallInvoicesFromSupabase();
      if (remoteInvoices.length) {
        const localOnly = localOnlyRows(remoteInvoices, "a_inv", "inv");
        // Re-push invoices that never reached the cloud (failed save)
        localOnly.forEach(inv => {
          persistHallInvoiceBundle(inv).then(res => {
            if (res?.skipped || !res?.invoice) return;
            setInvoicesRaw(prev => {
              const v = prev.map(x => (x.id === inv.id ? res.invoice : x));
              localStorage.setItem("a_inv", JSON.stringify(v));
              return v;
            });
          }).catch(() => {});
        });
        const mergedInv = [...remoteInvoices, ...localOnly];
        setInvoicesRaw(mergedInv);
        localStorage.setItem("a_inv", JSON.stringify(mergedInv));
      }
    } catch (err) {
      console.error("Failed to load hall invoices from Supabase:", err);
    }

    try {
      const rows = await loadRows("crm_leads");
      if (rows && rows.length) {
        const leads = rows.map(r => ({
          id: r.id, num: r.num, name: r.name, phone: r.phone,
          evType: r.ev_type, evDate: r.ev_date, guests: r.guests,
          source: r.source, stage: r.stage, followDate: r.follow_date,
          assigned: r.assigned, notes: r.notes,
          invoiceId: r.invoice_id, invoiceNum: r.invoice_num,
          createdAt: r.created_at, updatedAt: r.updated_at,
        }));
        const localOnly = localOnlyRows(leads, "a_crm_leads", "lead");
        if (localOnly.length) {
          upsertRows("crm_leads", localOnly.map(l => ({
            id: String(l.id), num: l.num || "", name: l.name || "", phone: l.phone || "",
            ev_type: l.evType || "", ev_date: l.evDate || "", guests: l.guests || "",
            source: l.source || "", stage: l.stage || "New Enquiry",
            follow_date: l.followDate || null, assigned: l.assigned || "admin",
            notes: l.notes || "", invoice_id: l.invoiceId || null, invoice_num: l.invoiceNum || null,
            updated_at: new Date().toISOString(),
          }))).catch(() => {});
        }
        const mergedLeads = [...leads, ...localOnly];
        setLeadsRaw(mergedLeads);
        localStorage.setItem("a_crm_leads", JSON.stringify(mergedLeads));
      }
    } catch {}

    // Sync hall config items from app_config
    try {
      const { loadConfig } = await import("../utils/supabaseSync");
      const [cutlery, renames, smsConfig, expTypesCfg] = await Promise.all([
        loadConfig("hall_cutlery"),
        loadConfig("hall_staff_renames"),
        loadConfig("hall_sms_config"),
        loadConfig("hall_exp_types"),
      ]);
      if (cutlery?.c1 && cutlery?.c2) localStorage.setItem("ameliaCutData", JSON.stringify(cutlery));
      if (renames && typeof renames === 'object') localStorage.setItem("a_renames", JSON.stringify(renames));
      if (smsConfig && typeof smsConfig === 'object') localStorage.setItem("ga_sms_config", JSON.stringify(smsConfig));
      if (expTypesCfg && typeof expTypesCfg === 'object') {
        setExpTypesRaw(prev => {
          // Merge: cloud wins for existing keys, but keep local-only keys so a
          // save made moments ago on this device isn't lost mid-sync
          const merged = { ...prev, ...expTypesCfg };
          localStorage.setItem("a_exp_types_v2", JSON.stringify(merged));
          return merged;
        });
      }
    } catch {}

    try {
      const rows = await loadRows("hall_expenses");
      if (rows && rows.length) {
        const exps = rows.map(r => ({ id: r.id, date: r.date, cat: r.category, desc: r.note, amount: r.amount, by: r.by }));
        const localOnly = localOnlyRows(exps, "a_exp", "exp");
        if (localOnly.length) {
          upsertRows("hall_expenses", localOnly.map(e => ({
            id: String(e.id), date: e.date, category: e.cat || e.category || "",
            amount: e.amount || 0, note: e.desc || e.note || "", by: e.by || "",
          }))).catch(() => {});
        }
        const mergedExps = [...exps, ...localOnly];
        setExpensesRaw(mergedExps);
        localStorage.setItem("a_exp", JSON.stringify(mergedExps));
      }
    } catch {}

    try {
      const rows = await loadRows("hall_revenues");
      if (rows && rows.length) {
        const revs = rows.map(r => ({
          id: r.id, date: r.date, source: r.source,
          amount: r.amount, note: r.note, by: r.by,
        }));
        const localOnly = localOnlyRows(revs, "a_hall_rev", "rev");
        if (localOnly.length) {
          upsertRows("hall_revenues", localOnly.map(r => ({
            id: String(r.id), date: r.date, source: r.source || "",
            amount: r.amount || 0, note: r.note || "", by: r.by || "",
          }))).catch(() => {});
        }
        const mergedRevs = [...revs, ...localOnly];
        setRevenuesRaw(mergedRevs);
        localStorage.setItem("a_hall_rev", JSON.stringify(mergedRevs));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runDailyBackup(), 90_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hasHallSupabaseConfig()) return;

    // Initial load
    syncHallFromSupabase();

    // Re-sync when tab becomes visible (catches edits made on another device)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncHallFromSupabase();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Poll every 60s as fallback
    const interval = setInterval(() => syncHallFromSupabase(), 60_000);

    // Instant broadcast ping from other devices (works even when the
    // postgres_changes publication is not enabled on the project)
    let pingTimer = null;
    const offPing = onRemoteChange(() => {
      clearTimeout(pingTimer);
      pingTimer = setTimeout(() => syncHallFromSupabase(), 500);
    });

    // Realtime — instant push on any hall data change
    let realtimeChannel = null;
    if (supabase) {
      realtimeChannel = supabase
        .channel("hall-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "hall_expenses" }, () => {
          loadRows("hall_expenses").then(rows => {
            if (!rows?.length) return;
            const exps = rows.map(r => ({ id: r.id, date: r.date, cat: r.category, desc: r.note, amount: r.amount, by: r.by }));
            const merged = [...exps, ...localOnlyRows(exps, "a_exp", "exp")];
            setExpensesRaw(merged);
            localStorage.setItem("a_exp", JSON.stringify(merged));
          }).catch(() => {});
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "hall_revenues" }, () => {
          loadRows("hall_revenues").then(rows => {
            if (!rows?.length) return;
            const revs = rows.map(r => ({ id: r.id, date: r.date, source: r.source, amount: r.amount, note: r.note, by: r.by }));
            const merged = [...revs, ...localOnlyRows(revs, "a_hall_rev", "rev")];
            setRevenuesRaw(merged);
            localStorage.setItem("a_hall_rev", JSON.stringify(merged));
          }).catch(() => {});
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
          syncHallFromSupabase();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => {
          loadRows("crm_leads").then(rows => {
            if (!rows?.length) return;
            const leads = rows.map(r => ({ id: r.id, num: r.num, name: r.name, phone: r.phone, evType: r.ev_type, evDate: r.ev_date, guests: r.guests, source: r.source, stage: r.stage, followDate: r.follow_date, assigned: r.assigned, notes: r.notes, invoiceId: r.invoice_id, invoiceNum: r.invoice_num, createdAt: r.created_at, updatedAt: r.updated_at }));
            const merged = [...leads, ...localOnlyRows(leads, "a_crm_leads", "lead")];
            setLeadsRaw(merged);
            localStorage.setItem("a_crm_leads", JSON.stringify(merged));
          }).catch(() => {});
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
  }, [syncHallFromSupabase]);

  const setInvoices = useCallback(next => {
    setInvoicesRaw(prev => {
      const v = typeof next === "function" ? next(prev) : next;
      localStorage.setItem("a_inv", JSON.stringify(v));
      return v;
    });
  }, []);

  const setExpenses = useCallback(next => {
    const v = typeof next === "function" ? next(expenses) : next;
    setExpensesRaw(v); localStorage.setItem("a_exp", JSON.stringify(v));
    // Upsert only — caller is responsible for deleting from Supabase when removing a row
    if (hasSupabase()) {
      const rows = v.map(e => ({ id: String(e.id), date: e.date, category: e.cat || e.category || "", amount: e.amount || 0, note: e.desc || e.note || "", by: e.by || "" }));
      upsertRows("hall_expenses", rows).catch(() => {});
    }
  }, [expenses]);

  const deleteExpense = useCallback((id) => {
    recordDeletedId("exp", id);
    setExpensesRaw(prev => {
      const next = prev.filter(e => String(e.id) !== String(id));
      localStorage.setItem("a_exp", JSON.stringify(next));
      return next;
    });
    if (hasSupabase()) {
      deleteRow("hall_expenses", id).catch(() => {});
    }
  }, []);

  // ── Expense type map — source of truth is Supabase app_config ──────────────
  const setExpenseType = useCallback((id, type) => {
    setExpTypesRaw(prev => {
      const v = { ...prev, [String(id)]: type };
      localStorage.setItem("a_exp_types_v2", JSON.stringify(v));
      if (hasSupabase()) {
        import("../utils/supabaseSync").then(({ saveConfig }) => saveConfig("hall_exp_types", v)).catch(() => {});
      }
      return v;
    });
  }, []);

  const removeExpenseType = useCallback((id) => {
    setExpTypesRaw(prev => {
      const v = { ...prev };
      delete v[String(id)];
      localStorage.setItem("a_exp_types_v2", JSON.stringify(v));
      if (hasSupabase()) {
        import("../utils/supabaseSync").then(({ saveConfig }) => saveConfig("hall_exp_types", v)).catch(() => {});
      }
      return v;
    });
  }, []);

  const setRevenues = useCallback(next => {
    const v = typeof next === "function" ? next(revenues) : next;
    setRevenuesRaw(v); localStorage.setItem("a_hall_rev", JSON.stringify(v));
    if (hasSupabase()) {
      const rows = v.map(r => ({ id: String(r.id), date: r.date, source: r.source, amount: r.amount || 0, note: r.note || "", by: r.by || "" }));
      upsertRows("hall_revenues", rows).catch(() => {});
    }
  }, [revenues]);

  const setLeads = useCallback(next => {
    const v = typeof next === "function" ? next(leads) : next;
    setLeadsRaw(v); localStorage.setItem("a_crm_leads", JSON.stringify(v));
    if (hasSupabase()) {
      const rows = v.map(l => ({
        id: String(l.id), num: l.num || "", name: l.name || "", phone: l.phone || "",
        ev_type: l.evType || "", ev_date: l.evDate || "", guests: l.guests || "",
        source: l.source || "", stage: l.stage || "New Enquiry",
        follow_date: l.followDate || null, assigned: l.assigned || "admin",
        notes: l.notes || "", invoice_id: l.invoiceId || null, invoice_num: l.invoiceNum || null,
        updated_at: new Date().toISOString(),
      }));
      upsertRows("crm_leads", rows).catch(() => {});
    }
  }, [leads]);

  const login  = useCallback((user, role) => { localStorage.setItem("a_sess", JSON.stringify({ user, role })); setCurUser(user); setCurRole(role); }, []);
  const logout = useCallback(() => { localStorage.removeItem("a_sess"); setCurUser(""); setCurRole(""); }, []);

  const notify = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3200);
  }, []);

  return (
    <Ctx.Provider value={{ curUser, curRole, login, logout, invoices, setInvoices, expenses, setExpenses, deleteExpense, expTypes, setExpenseType, removeExpenseType, revenues, setRevenues, leads, setLeads, activeTab, setActiveTab, notification, notify, invoiceJumpSignal, bumpInvoiceJump }}>
      {children}
    </Ctx.Provider>
  );
}

export function useHall() { return useContext(Ctx); }
