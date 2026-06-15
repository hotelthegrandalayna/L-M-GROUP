const WA_KEY = "ga_wa_config";
const DEFAULT_WA_TEMPLATE_HALL  = "🏛 *New Hall Booking!*\n\nClient: {name}\nEvent: {evType}\nDate: {date}\nTotal: {amount}\nAdvance: {advance}\nBalance: {balance}\nInvoice: {invNum}\nPhone: {phone}";
const DEFAULT_WA_TEMPLATE_HOTEL = "🏨 *New Hotel Booking!*\n\nGuest: {guest}\nRoom: {room}\nCheck-in: {checkin}\nCheck-out: {checkout}\nNights: {nights}\nTotal: {total}\nAdvance: {advance}";

export function loadWaConfig() {
  try {
    return JSON.parse(localStorage.getItem(WA_KEY) || "null") ||
      { enabled:false, num1:"", key1:"", num2:"", key2:"", hallTemplate:DEFAULT_WA_TEMPLATE_HALL, hotelTemplate:DEFAULT_WA_TEMPLATE_HOTEL };
  } catch {
    return { enabled:false, num1:"", key1:"", num2:"", key2:"", hallTemplate:DEFAULT_WA_TEMPLATE_HALL, hotelTemplate:DEFAULT_WA_TEMPLATE_HOTEL };
  }
}

export function saveWaConfig(cfg) { localStorage.setItem(WA_KEY, JSON.stringify(cfg)); }

async function _sendWa(phone, apiKey, message) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  return { ok: res.ok, status: res.status };
}

export async function sendWhatsAppAlert(message) {
  const cfg = loadWaConfig();
  if (!cfg.enabled) return;
  const tasks = [];
  if (cfg.num1 && cfg.key1) tasks.push(_sendWa(cfg.num1, cfg.key1, message).catch(() => ({ ok:false })));
  if (cfg.num2 && cfg.key2) tasks.push(_sendWa(cfg.num2, cfg.key2, message).catch(() => ({ ok:false })));
  if (tasks.length) await Promise.all(tasks);
}

function fmtD(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });
}

export function buildHallWaMessage(inv) {
  const cfg = loadWaConfig();
  return (cfg.hallTemplate || DEFAULT_WA_TEMPLATE_HALL)
    .replace(/{name}/g,    inv.client||"")
    .replace(/{evType}/g,  inv.evType||"")
    .replace(/{date}/g,    fmtD(inv.evDate))
    .replace(/{amount}/g,  "৳"+(inv.grand||0).toLocaleString())
    .replace(/{advance}/g, "৳"+(parseFloat(inv.adv)||0).toLocaleString())
    .replace(/{balance}/g, "৳"+(Math.max(0,(inv.grand||0)-(parseFloat(inv.adv)||0))).toLocaleString())
    .replace(/{invNum}/g,  inv.num||"")
    .replace(/{phone}/g,   inv.phone||"");
}

export function buildHotelWaMessage(bk) {
  const cfg = loadWaConfig();
  return (cfg.hotelTemplate || DEFAULT_WA_TEMPLATE_HOTEL)
    .replace(/{guest}/g,    bk.guest||"")
    .replace(/{room}/g,     "Rm "+(bk.room||""))
    .replace(/{checkin}/g,  fmtD(bk.checkin))
    .replace(/{checkout}/g, fmtD(bk.checkout))
    .replace(/{nights}/g,   String(bk.nights||""))
    .replace(/{total}/g,    "৳"+(bk.amount||0).toLocaleString())
    .replace(/{advance}/g,  "৳"+(bk.advance||0).toLocaleString());
}
