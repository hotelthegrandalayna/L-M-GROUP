
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { hasHallSupabaseConfig, loadHallInvoicesFromSupabase } from "./lib/hallSupabase";
import { hasSupabase, upsertRow, upsertRows, deleteRow, loadRows } from "../utils/supabaseSync";
import { syncNtfyConfigFromSupabase } from "../utils/ntfy";

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

export const EV_TYPES = [
  { v:"Wedding",        i:"💒", g:"wedding", bg:"#fff0f0", border:"#e07070", accent:"#9B1212" },
  { v:"Holud",          i:"🌼", g:"holud",   bg:"#fffbe8", border:"#d4a800", accent:"#8a6200" },
  { v:"Wedding + Holud",i:"💒🌼",g:"wh",    bg:"#f5f0ff", border:"#9370DB", accent:"#6030b0" },
  { v:"Reception",      i:"🎊", g:"wedding", bg:"#f0f8ff", border:"#4a90d9", accent:"#1a5fa0" },
  { v:"Engagement",     i:"💍", g:"wedding", bg:"#fff0f8", border:"#d060a0", accent:"#a03070" },
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
  const [activeTab, setActiveTab] = useState("invoice");
  const [notification, setNotification] = useState(null);
  const [invoiceJumpSignal, setInvoiceJumpSignal] = useState(0);
  const bumpInvoiceJump = useCallback(() => setInvoiceJumpSignal(n => n+1), []);

  const syncHallFromSupabase = useCallback(async () => {
    if (!hasHallSupabaseConfig()) return;

    syncNtfyConfigFromSupabase().catch(() => {});

    try {
      const remoteInvoices = await loadHallInvoicesFromSupabase();
      if (remoteInvoices.length) {
        setInvoicesRaw(remoteInvoices);
        localStorage.setItem("a_inv", JSON.stringify(remoteInvoices));
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
        setLeadsRaw(leads);
        localStorage.setItem("a_crm_leads", JSON.stringify(leads));
      }
    } catch {}

    try {
      const rows = await loadRows("hall_expenses");
      if (rows && rows.length) {
        const exps = rows.map(r => ({
          id: r.id, date: r.date, category: r.category,
          amount: r.amount, note: r.note, by: r.by,
        }));
        setExpensesRaw(exps);
        localStorage.setItem("a_exp", JSON.stringify(exps));
      }
    } catch {}

    try {
      const rows = await loadRows("hall_revenues");
      if (rows && rows.length) {
        const revs = rows.map(r => ({
          id: r.id, date: r.date, source: r.source,
          amount: r.amount, note: r.note, by: r.by,
        }));
        setRevenuesRaw(revs);
        localStorage.setItem("a_hall_rev", JSON.stringify(revs));
      }
    } catch {}
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

    // Poll every 5 minutes — tab focus catches most changes anyway
    const interval = setInterval(() => syncHallFromSupabase(), 300_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
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
    // Sync new/changed entries to Supabase
    if (hasSupabase()) {
      const rows = v.map(e => ({ id: String(e.id), date: e.date, category: e.category, amount: e.amount || 0, note: e.note || "", by: e.by || "" }));
      upsertRows("hall_expenses", rows).catch(() => {});
    }
  }, [expenses]);

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
    <Ctx.Provider value={{ curUser, curRole, login, logout, invoices, setInvoices, expenses, setExpenses, revenues, setRevenues, leads, setLeads, activeTab, setActiveTab, notification, notify, invoiceJumpSignal, bumpInvoiceJump }}>
      {children}
    </Ctx.Provider>
  );
}

export function useHall() { return useContext(Ctx); }
