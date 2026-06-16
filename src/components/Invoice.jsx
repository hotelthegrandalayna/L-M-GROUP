
import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { todayStr, money, maxId } from "../utils/helpers";

const HOTEL_INFO = {
  name: "Hotel The Grand Alayna",
  address: "Hajari Road, Ward No. 09, Shibpur, Sitakund-4310, Chittagong, Bangladesh",
  phone: "+8801883352526",
  email: "info@hotelthegrandalayna.com",
  web: "hotelthegrandalayna.com",
};

const TC_TERMS = ["চেক-ইনের সময় অতিথিদের অবশ্যই জাতীয় পরিচয়পত্র নিশ্চিত করতে হবে। সেক্ষেত্রে বাংলাদেশি নাগরিকঃ জাতীয় পরিচয়পত্র, পাসপোর্ট অথবা ড্রাইভিং লাইসেন্স এবং বিদেশি অতিথিঃ বৈধ পাসপোর্ট ও ভিসা নিশ্চিত করে চেক-ইন করতে পারবে।","দম্পতি অতিথিদের ক্ষেত্রে শুধুমাত্র প্রমান (বিবাহ সনদ/নিকাহনামা) প্রদর্শন সাপেক্ষেই চেক-ইন করতে পারবে। প্রমান প্রদানে ব্যর্থ এবং জাল সনদ ব্যবহারে অবিলম্বে বুকিং বাতিল করা হবে এবং সেক্ষেত্রে পূর্বে রিজার্ভেশন সাপেক্ষে প্রদানকৃত অর্থ থাকলে তা ফেরতযোগ্য নয়।","চেক-ইন এবং চেক-আউটের নির্ধারিত সময় যথাক্রমে দুপুর ২:০০ এবং দুপুর ১২:০০ (বুকিং এর তারিখ সাপেক্ষে)। অগ্রিম বা বিলম্বিত চেক-ইন/চেক-আউট কক্ষের প্রাপ্যতার উপর নির্ভরশীল এবং সেক্ষেত্রে অতিরিক্ত চার্জ প্রযোজ্য হতে পারে।","কাঙ্খিত কক্ষের সর্বোচ্চ অতিথি ধারণক্ষমতা সাপেক্ষেই বুকিং নিশ্চিত হবে। শুধুমাত্র নিবন্ধনকৃত অতিথিরাই কক্ষে থাকতে পারবেন এবং অতিরিক্ত গেস্ট রাতে অবস্থান করতে পারবে না।","বুকিং এর নির্ধারিত ভাড়া অবশ্যই চেক-ইন পূর্বক পরিশোধ করতে হবে এবং অথোরিটির অনুমোদন সাপেক্ষে সকল বকেয়া অবশ্যই চেক-আউট কালীন সময়ে পরিশোধ নিশ্চিত করতে হবে।","সকলের নিরাপত্তার স্বার্থে হোটেলের প্রধান প্রবেশদ্বার বন্ধের নির্ধারিত সময় রাত ১২:০০টা। উক্ত সময়ের পরে প্রধান প্রবেশদ্বার খোলার প্রয়োজন হলে অবশ্যই তা পূর্বে রিসিপশনে অবগত করতে হবে।","হোটেল কর্তৃক প্রদানকৃত সকল সামগ্রী (যেমনঃ টিভি, এসি, রিমোট, তোয়ালে, বেডশিট, কম্বল, রুমের চাবি ইত্যাদি) হোটেলের নিজস্ব সম্পত্তি। অতিথি কর্তৃক কোনো সামগ্রী হারানো বা ক্ষতিগ্রস্ত হলে উক্ত জিনিসের জন্য প্রতিস্থাপন মূল্য নেওয়া হবে।","শুধুমাত্র হোটেল কর্তৃক নির্ধারিত এলাকায় ধূমপান করা যাবে এবং উক্ত এরিয়া বাদে ধুমপান করলে জরিমানার বিধান রয়েছে। হোটেল কক্ষের ভেতরে সকল প্রকার রান্না সহ গ্যাসের সিলিন্ডার, বৈদ্যুতিক চুলা, হিটার বা এ জাতীয় সরঞ্জাম ব্যবহার সম্পূর্ণ নিষিদ্ধ।","সকল অতিথির বিশ্রামের স্বার্থে রাত ১০:০০টা থেকে সকাল ৭:০০টা সময়ে অতিরিক্ত শব্দ, উচ্চশব্দে বাদ্যসামগ্রী সহ অন্য অতিথির বিশ্রাম বিঘ্ন হয় এমন সকল আচরণ সম্পূর্ণ নিষিদ্ধ।","অতিথির সাথে আগত শিশু এবং ব্যক্তি মালিকানার সকল মালামাল ও সম্পত্তির নিরাপত্তার দায়িত্ব অতিথির উপর বর্তায় এবং উক্ত সামগ্রীর হারানো অথবা ক্ষতি সাধন হলে হোটেল কর্তপক্ষ দায়ী নয়।","পরিচালনা, হাউসকিপিং, রক্ষণাবেক্ষণ, জরুরি পরিস্থিতি এবং নিরাপত্তার স্বার্থে হোটেলের স্টাফ কক্ষে প্রবেশ করতে পারবে এবং নির্ধারিত সময় রুম ক্লিনিং এর স্বার্থে কক্ষ সাময়িক সময়ের জন্য ছেড়ে দিতে হবে।","হোটেল দ্যা গ্র্যান্ড আলায়না বাংলাদেশ সরকার কর্তৃক প্রণোদিত সকল আইনের নিকট বাধিত এবং অতিথি কর্তৃক উক্ত আইন লঙ্ঘন সাধন হলে কর্তৃপক্ষ অবিলম্বে বুকিং বাতিল এবং নিরাপত্তার স্বার্থে প্রশাসনের সহযোগিতা নিতে পারবে।","মদ্যজাতীয় পানীয় রাখা ও পান করার ক্ষেত্রে বাংলাদেশের সরকার কর্তৃক প্রণোদিত সকল আইন প্রযোজ্য হবে এবং মদ্যপান অবস্থায় কেউ বিশৃঙ্খলা সৃষ্টি করলে কর্তপক্ষ সকলের নিরাপত্তার স্বার্থে সকল ব্যবস্থা গ্রহণ করতে পারবে।","প্রতিষ্ঠানের সুনাম ও শৃঙ্খলার স্বার্থে কর্তৃপক্ষ কক্ষ বুকিং সীমিত করার অধিকার রাখে।","প্রাকৃতিক দুর্যোগ, সরকারি নিষেধাজ্ঞা, বিদ্যুৎ বিভ্রাট, ধর্মঘট সহ যেকোন জনজরুরি পরিস্থিতিতে হোটেলের নিয়ন্ত্রণের বাইরের যেকোনো কারণে হোটেল সেবা বিঘ্নিত হলে হোটেল কর্তৃপক্ষ দায়ী থাকবে না।"];
const TC_BN    = ["১","২","৩","৪","৫","৬","৭","৮","৯","১০","১১","১২","১৩","১৪","১৫"];

function fmtDate(d) {
  if (!d) return "";
  const p = d.split("-");
  if (p.length !== 3) return d;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return p[2] + " " + months[parseInt(p[1])-1] + " " + p[0];
}

function moneyH(n) { return "\u09F3" + (n||0).toLocaleString("en-IN"); }

// ─── Invoice HTML builder (mirrors original renderInvoice) ─────────────────
function buildInvoiceHTML(b, rooms, invExtras, mode) {
  if (!b) return "";
  const disc    = b.discAmt || b.invoiceDiscount || 0;
  const base    = b.baseAmount || b.amount || 0;
  const roomTotal = Math.max(0, base - disc);
  const validExtras = (invExtras || []).filter(x => x.desc && x.rate > 0);
  const extrasTotal = validExtras.reduce((s,x) => s + x.qty * x.rate, 0);
  const epCharge    = (b.extraPersonCharge && b.extraPersonCharge.total) || 0;
  const combinedExtras = extrasTotal + epCharge;
  const grandTotal  = roomTotal + combinedExtras;
  const advance     = b.advance || 0;
  const extAdv      = b.extrasAdvance || 0;
  const totalAdv    = advance + extAdv;
  const balanceDue  = Math.max(0, grandTotal - totalAdv);

  const roomStatus    = advance >= roomTotal && roomTotal > 0 ? "paid" : advance > 0 ? "partial" : "unpaid";
  const extrasStatus  = combinedExtras === 0 ? "unpaid" : extAdv >= combinedExtras ? "paid" : extAdv > 0 ? "partial" : "unpaid";
  const invNum = "GA-" + String(b.id).padStart(4,"0");
  const invDate = b.invoiceDate || todayStr();

  const ro = (rooms || []).find(x => x.number === b.room);
  const rName = ro && ro.name ? " — " + ro.name : "";
  const rType = ro ? ro.type : (b.type || "");

  function mr(label, val) {
    return '<div style="display:flex;gap:5px;font-size:11.5px;line-height:1.9;"><span style="min-width:90px;color:#444;font-size:11px;font-weight:600;">' + label + '</span><span style="color:#888;">:</span><span style="font-weight:700;color:#111;">' + val + '</span></div>';
  }

  function statusBox(status) {
    const m = { paid:{c:"#1a7040",t:"PAID"}, unpaid:{c:"#c0392b",t:"UNPAID"}, partial:{c:"#b07800",t:"PARTIAL"} };
    const s = m[status] || m.unpaid;
    return '<div style="border:2px solid '+s.c+';border-radius:7px;padding:12px 14px;text-align:center;">'
      + '<div style="font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:5px;">Payment Status</div>'
      + '<div style="font-size:22px;font-weight:900;letter-spacing:3px;color:'+s.c+';font-family:Georgia,serif;margin-bottom:6px;">'+s.t+'</div>'
      + '<div style="height:1px;background:linear-gradient(90deg,transparent,'+s.c+',transparent);margin-bottom:7px;"></div>'
      + '<div style="font-size:8.5px;color:#aaa;">'+HOTEL_INFO.name+'</div>'
      + '</div>';
  }

  const header =
    '<div style="padding:18px 24px 14px;border-bottom:2px solid #1a1a2e;">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">'
      + '<div style="display:flex;flex-direction:column;gap:2px;">'
        + '<div style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;font-weight:600;">— Hotel —</div>'
        + '<div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#1a1a2e;letter-spacing:.5px;line-height:1.1;">The Grand Alayna</div>'
        + '<div style="display:flex;align-items:center;gap:6px;margin:4px 0 3px;"><span style="width:28px;height:0.8px;background:#C9A84C;display:inline-block;"></span><span style="color:#C9A84C;font-size:8px;">♦</span><span style="width:28px;height:0.8px;background:#C9A84C;display:inline-block;"></span></div>'
        + '<div style="font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#aaa;">Luxury for all</div>'
      + '</div>'
      + '<div style="text-align:right;">'
        + '<div style="display:inline-block;border:2px solid #1a1a2e;border-radius:4px;padding:5px 16px;margin-bottom:8px;"><span style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#1a1a2e;letter-spacing:4px;">INVOICE</span></div>'
        + '<div>' + mr("Invoice No.",invNum) + mr("Date",fmtDate(invDate)) + '</div>'
      + '</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding-top:12px;border-top:1px solid #e8e4dc;">'
      + '<div style="padding-right:18px;">'
        + '<div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:6px;">Bill To</div>'
        + '<div style="font-size:18px;font-weight:700;color:#000;font-family:Georgia,serif;margin-bottom:4px;">'+b.guest+'</div>'
        + '<div style="font-size:10px;color:#555;margin-bottom:2px;">'+b.phone+'</div>'
        + (b.idNum ? '<div style="font-size:9.5px;color:#aaa;">'+b.idType+': '+b.idNum+'</div>' : '')
      + '</div>'
      + '<div style="padding-left:18px;border-left:1px solid #e8e4dc;">'
        + '<div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#1a1a2e;margin-bottom:6px;">Stay Details</div>'
        + mr("Room","Room "+b.room+rName)
        + (rType ? mr("Room Type",rType) : "")
        + (b.acChoice ? mr("AC / Non-AC", b.acChoice==="AC" ? "❄️  AC" : "🌬️  Non-AC") : "")
        + mr("Check-In",fmtDate(b.checkin))
        + mr("Check-Out",fmtDate(b.checkout))
        + mr("Nights",b.nights+" Night"+(b.nights>1?"s":""))
        + (function(){ const a=b.adults||b.adult||0;const c=b.children||0; if(!a&&!c)return "";
            const g=(a?a+" Adult"+(a>1?"s":""):"")+(a&&c?", ":"")+(c?c+" Child"+(c>1?"ren":""):"");
            return mr("Guests",g); })()
      + '</div>'
    + '</div>'
    + '</div>';

  const thS = "padding:9px 10px;color:#C9A84C;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;";
  const thead = '<thead><tr style="background:#eeeae2;border-bottom:2px solid #1a1a2e;">'
    + '<th style="'+thS+'text-align:left;">Date</th>'
    + '<th style="'+thS+'text-align:left;">Description</th>'
    + '<th style="'+thS+'text-align:center;">Qty</th>'
    + '<th style="'+thS+'text-align:right;">Rate (\u09F3)</th>'
    + '<th style="'+thS+'text-align:right;">Amount (\u09F3)</th>'
    + '</tr></thead>';

  const discLabel = b.discReason ? "Discount — " + b.discReason : "Discount";
  const dRow = disc > 0
    ? '<tr style="background:#fffbf5;"><td style="padding:7px 10px;border-bottom:1px solid #eee;color:#B7770D;font-size:10px;">—</td><td style="padding:7px 10px;border-bottom:1px solid #eee;color:#B7770D;font-size:10px;">'+discLabel+'</td><td colspan="2" style="border-bottom:1px solid #eee;"></td><td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;color:#B7770D;font-weight:700;font-size:10px;">-'+moneyH(disc)+'</td></tr>'
    : "";

  const roomRow = '<tr>'
    + '<td style="padding:9px 10px;border-bottom:1px solid #eee;color:#555;font-size:11px;">'+fmtDate(b.checkin)+'</td>'
    + '<td style="padding:9px 10px;border-bottom:1px solid #eee;color:#111;font-size:11px;font-weight:500;">Room '+b.room+rName+' — Accommodation ('+b.nights+' Night'+(b.nights>1?'s':'')+')'+(b.acChoice?' ['+b.acChoice+']':'')+'</td>'
    + '<td style="padding:9px 10px;border-bottom:1px solid #eee;text-align:center;color:#333;font-size:11px;">'+b.nights+'</td>'
    + '<td style="padding:9px 10px;border-bottom:1px solid #ddd;text-align:right;color:#333;font-size:11px;">'+(b.baseAmount?moneyH(Math.round(b.baseAmount/b.nights)):moneyH(b.amount))+'</td>'
    + '<td style="padding:9px 10px;border-bottom:1px solid #ddd;text-align:right;color:#000;font-weight:700;font-size:12px;">'+moneyH(b.baseAmount||b.amount)+'</td>'
    + '</tr>';

  const epRow = (b.extraPersonCharge && b.extraPersonCharge.total > 0)
    ? '<tr><td style="padding:9px 10px;border-bottom:1px solid #eee;color:#555;font-size:11px;">'+fmtDate(b.checkin)+'</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid #eee;color:#111;font-size:11px;font-weight:500;">Extra Person Charge ('+b.extraPersonCharge.qty+' additional guest'+(b.extraPersonCharge.qty>1?'s':'')+')</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid #eee;text-align:center;color:#333;font-size:11px;">'+b.extraPersonCharge.qty+'</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid #eee;text-align:right;color:#333;font-size:11px;">'+moneyH(b.extraPersonCharge.rate)+'</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid #eee;text-align:right;color:#B7770D;font-weight:700;font-size:12px;">'+moneyH(b.extraPersonCharge.total)+'</td></tr>'
    : "";

  const eRows = validExtras.map(ex => {
    const exDate = ex.date ? fmtDate(ex.date) : fmtDate(b.checkin);
    return '<tr><td style="padding:9px 10px;border-bottom:1px solid #eee;color:#555;font-size:11px;">'+exDate+'</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid #eee;color:#111;font-size:11px;font-weight:500;">'+ex.desc+'</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid #eee;text-align:center;color:#333;font-size:11px;">'+ex.qty+'</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid #eee;text-align:right;color:#333;font-size:11px;">'+moneyH(ex.rate)+'</td>'
      + '<td style="padding:9px 10px;border-bottom:1px solid #eee;text-align:right;color:#B7770D;font-weight:700;font-size:12px;">'+moneyH(ex.qty*ex.rate)+'</td></tr>';
  }).join("");

  function secHdr(label) {
    return '<tr style="background:#f0ece2;"><td colspan="5" style="padding:6px 10px 5px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#1a1a2e;border-bottom:1px solid #ccc;border-top:2px solid #1a1a2e;">'+label+'</td></tr>';
  }
  function subTot(label, amt) {
    return '<tr style="background:#faf8f4;"><td colspan="4" style="padding:6px 10px;font-size:11px;font-weight:700;color:#333;text-align:right;border-top:1px solid #ddd;">'+label+'</td><td style="padding:6px 10px;font-size:12px;font-weight:800;color:#1a1a2e;text-align:right;border-top:1px solid #ddd;">'+moneyH(amt)+'</td></tr>';
  }

  const hasExtras = validExtras.length > 0 || epCharge > 0;
  let tableBody = hasExtras
    ? secHdr("Accommodation Charges") + roomRow + dRow + subTot("Accommodation Sub-total", roomTotal)
      + secHdr("Additional Charges") + epRow + eRows + subTot("Additional Charges Sub-total", combinedExtras)
    : roomRow + dRow;

  const payHist = b.paymentHistory || [];
  if (payHist.length) {
    const pTD = "padding:7px 10px;border-bottom:1px solid #e0f0e8;font-size:10px;";
    tableBody += secHdr("Payments Received");
    payHist.forEach(h => {
      const pd = new Date(h.ts || h.date || "");
      const pDate = isNaN(pd) ? "—" : pd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})+(h.ts?" "+pd.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"");
      const pDesc = (h.type==="service"?"Service":"Room") + " Payment — " + h.method + (h.note?" · "+h.note:"");
      tableBody += '<tr style="background:#f5fff8;">'
        + '<td style="'+pTD+'color:#555;">'+pDate+'</td>'
        + '<td style="'+pTD+'color:#1a7040;font-style:italic;">'+pDesc+'</td>'
        + '<td colspan="2" style="'+pTD+'"></td>'
        + '<td style="'+pTD+'text-align:right;color:#1a7040;font-weight:700;">-'+moneyH(h.amount)+'</td>'
        + '</tr>';
    });
    const balRow = Math.max(0, grandTotal - totalAdv);
    const balClr = balRow > 0 ? "#c0392b" : "#1a7040";
    const balBg  = balRow > 0 ? "#fff0f0" : "#f0fff4";
    tableBody += '<tr style="background:'+balBg+';border-top:2px solid '+balClr+';">'
      + '<td colspan="4" style="padding:9px 10px;font-size:9.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;text-align:right;color:'+balClr+';">'+(balRow>0?"Balance Due":"✔ Fully Paid")+'</td>'
      + '<td style="padding:9px 10px;font-size:13px;font-weight:800;text-align:right;color:'+balClr+';">'+moneyH(balRow)+'</td>'
      + '</tr>';
  }

  const table = '<div style="padding:12px 24px;"><table style="width:100%;border-collapse:collapse;">'
    + thead + '<tbody>' + tableBody + '</tbody></table></div>';

  const totals = '<div style="display:flex;flex-direction:column;gap:0;">'
    + (validExtras.length
      ? '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:10px;border-bottom:1px solid #eee;color:#555;"><span>Room Total</span><span>'+moneyH(roomTotal)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:10px;border-bottom:1px solid #eee;color:#B7770D;"><span>Service Charges Total</span><span>'+moneyH(extrasTotal)+'</span></div>'
      : "")
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;background:#1a1a2e;border-radius:4px;margin-top:6px;">'
      + '<span style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#C9A84C;">Total Amount (\u09F3)</span>'
      + '<span style="font-size:17px;font-weight:800;color:#C9A84C;font-family:Georgia,serif;">'+moneyH(grandTotal)+'</span>'
    + '</div>'
    + (advance>0 ? '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:10px;border-bottom:1px solid #eee;color:#1a7040;margin-top:4px;"><span>✔ Room Advance</span><span style="font-weight:700;">-'+moneyH(advance)+'</span></div>' : "")
    + (extAdv>0  ? '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:10px;border-bottom:1px solid #eee;color:#1a7040;"><span>✔ Service Advance</span><span style="font-weight:700;">-'+moneyH(extAdv)+'</span></div>' : "")
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;border-radius:4px;margin-top:4px;'
      + (balanceDue>0 ? 'background:#fff0f0;border:1.5px solid #c0392b;' : 'background:#f0fff4;border:1.5px solid #1a7040;') + '">'
      + '<span style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:'+(balanceDue>0?"#c0392b":"#1a7040")+'">'+(balanceDue>0?"Balance Due (\u09F3)":"Fully Paid ✔")+'</span>'
      + '<span style="font-size:17px;font-weight:800;color:'+(balanceDue>0?"#c0392b":"#1a7040")+';font-family:Georgia,serif;">'+moneyH(balanceDue)+'</span>'
    + '</div></div>';

  const mid = '<div style="padding:0 24px 12px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">'
    + (validExtras.length > 0
      ? '<div style="display:flex;flex-direction:column;gap:8px;">'+statusBox(roomStatus)+statusBox(extrasStatus)+'</div>'
      : '<div>'+statusBox(roomStatus)+'</div>')
    + '<div>'+totals+'</div>'
    + '</div>';

  const sig = '<div style="padding:10px 24px 0;border-top:1px solid #e0dbd2;">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-bottom:12px;">'
      + '<div>'
        + '<div style="font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#1a1a2e;margin-bottom:22px;">Guest Signature</div>'
        + '<div style="border-bottom:1px dotted #aaa;margin-bottom:6px;"></div>'
        + '<div style="font-size:9px;color:#888;">Name: <strong style="color:#333;">'+b.guest+'</strong></div>'
        + '<div style="font-size:9px;color:#888;margin-top:2px;">Date: <span style="border-bottom:1px dotted #ccc;display:inline-block;width:80px;">&nbsp;</span></div>'
      + '</div>'
      + '<div style="text-align:center;">'
        + '<div style="font-family:Georgia,serif;font-size:15px;font-style:italic;color:#C9A84C;margin-bottom:1px;">Thank you</div>'
        + '<div style="font-size:9.5px;color:#777;margin-bottom:13px;">for staying with us.</div>'
        + '<div style="border-bottom:1px dotted #aaa;width:120px;margin:0 auto 5px;"></div>'
        + '<div style="font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#1a1a2e;">Front Office Manager</div>'
        + '<div style="font-size:8.5px;color:#aaa;margin-top:1px;">'+HOTEL_INFO.name+'</div>'
      + '</div>'
    + '</div></div>';

  const footer = '<div style="border-top:2px solid #1a1a2e;padding:12px 24px;background:#fafaf8;">'
    + '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;align-items:start;">'
      + '<div><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;">Address</div><div style="font-size:9px;color:#333;line-height:1.6;">'+HOTEL_INFO.address+'</div></div>'
      + '<div><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;">Phone</div><div style="font-size:9px;color:#333;">'+HOTEL_INFO.phone+'</div></div>'
      + '<div><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;">Email</div><div style="font-size:9px;color:#333;">'+HOTEL_INFO.email+'</div></div>'
      + '<div><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;">Website</div><div style="font-size:9px;color:#333;">'+HOTEL_INFO.web+'</div><div style="font-size:8px;color:#C9A84C;margin-top:1px;">24x7 Guest Assistance</div></div>'
    + '</div>'
    + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e8e4dc;text-align:center;font-size:8px;color:#aaa;font-style:italic;">This is a computer-generated invoice. Thank you for choosing '+HOTEL_INFO.name+'.</div>'
    + '</div>';

  return '<div style="width:100%;min-height:257mm;border:1.5px solid #1a1a2e;border-radius:6px;overflow:hidden;font-family:DM Sans,sans-serif;background:#fff;color:#1a1a2e;box-sizing:border-box;display:flex;flex-direction:column;">'
    + header + table + mid
    + '<div style="flex:1;min-height:4px;"></div>'
    + sig + footer + '</div>';
}

// ─── Terms & Conditions HTML ───────────────────────────────────────────────
function buildTCHtml(b) {
  const rows = TC_TERMS.map((t,i) =>
    '<tr><td style="padding:4px 8px 4px 2px;font-weight:800;color:#8B1A1A;font-size:12px;vertical-align:top;white-space:nowrap;">'+TC_BN[i]+'.</td>'
    + '<td style="padding:4px 2px;font-size:11.5px;color:#1a1a1a;line-height:1.65;">'+t+'</td></tr>'
  ).join("");
  const parts = (b && b.checkin) ? b.checkin.split("-") : [];
  const fmtCI = parts.length===3 ? parts[2]+"/"+parts[1]+"/"+parts[0] : (b&&b.checkin)||"";
  return '<div style="border:2px solid #8B1A1A;border-radius:10px;overflow:hidden;font-family:Kalpurush,Noto Sans Bengali,Arial,sans-serif;">'
    + '<div style="background:#8B1A1A;padding:10px 18px;text-align:center;">'
      + '<div style="font-size:15px;font-weight:700;color:#f5d67a;letter-spacing:1px;">HOTEL THE GRAND ALAYNA</div>'
      + '<div style="font-size:13px;font-weight:700;color:#fff;margin-top:2px;">\u0985\u09A4\u09BF\u09A5\u09BF \u09A8\u09BF\u09AF\u09BC\u09AE\u09BE\u09AC\u09B2\u09C0 \u0993 \u09B6\u09B0\u09CD\u09A4\u09B8\u09AE\u09C2\u09B9</div>'
      + '<div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:2px;">\u09B8\u09C0\u09A4\u09BE\u0995\u09C1\u09A3\u09CD\u09A1, \u099A\u099F\u09CD\u099F\u0997\u09CD\u09B0\u09BE\u09AE, \u09AC\u09BE\u0982\u09B2\u09BE\u09A6\u09C7\u09B6</div>'
    + '</div>'
    + '<div style="padding:12px 16px;background:#fff9f9;">'
      + '<table style="width:100%;border-collapse:collapse;"><tbody>'+rows+'</tbody></table>'
      + '<div style="margin-top:12px;padding:10px 12px;background:#fff3e0;border:1.5px solid #e0a040;border-radius:8px;font-size:11.5px;color:#5a3000;line-height:1.6;">\u0986\u09AE\u09BF \u0989\u0995\u09CD\u09A4 \u09B6\u09B0\u09CD\u09A4\u09BE\u09AC\u09B2\u09C0 \u09B8\u099C\u09CD\u099E\u09BE\u09A8\u09C7 \u09B8\u09AE\u09CD\u09AA\u09C2\u09B0\u09CD\u09A3 \u09AA\u09DC\u09C7\u099B\u09BF \u098F\u09AC\u0982 \u09B8\u09AE\u09CD\u09AE\u09A4\u09BF\u0995\u09CD\u09B0\u09AE\u09C7 \u09B8\u09CD\u09AC\u09BE\u0995\u09CD\u09B7\u09B0 \u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4 \u0995\u09B0\u09B2\u09BE\u09AE\u0964</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:16px;">'
        + '<div><div style="border-top:1.5px solid #8B1A1A;padding-top:5px;text-align:center;">'
          + '<div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">'+(b&&b.guest?b.guest:"")+'</div>'
          + '<div style="font-size:10px;color:#555;">\u0985\u09A4\u09BF\u09A5\u09BF\u09B0 \u09B8\u09CD\u09AC\u09BE\u0995\u09CD\u09B7\u09B0 / Guest Signature</div>'
        + '</div></div>'
        + '<div><div style="border-top:1.5px solid #8B1A1A;padding-top:5px;text-align:center;">'
          + '<div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">'+fmtCI+'</div>'
          + '<div style="font-size:10px;color:#555;">\u09A4\u09BE\u09B0\u09BF\u0996 / Date</div>'
        + '</div></div>'
      + '</div>'
    + '</div></div>';
}

// ─── Print helper (same logic as original _hotelPrint) ────────────────────
function hotelPrint(invHTML, tcHTML) {
  const old = document.getElementById("_hpm");
  if (old) old.remove();
  const d = document.createElement("div");
  d.id = "_hpm";
  d.innerHTML = '<div style="font-family:DM Sans,sans-serif;padding:0;max-width:100%;margin:0;color:#1a1a2e;background:#fff;">' + invHTML + '</div>'
    + (tcHTML ? '<div id="_hpm_tc">' + tcHTML + '</div>' : "");
  d.style.display = "none";
  document.body.appendChild(d);
  document.body.classList.add("hotel-print-mode");
  setTimeout(() => {
    const cleanup = () => {
      document.body.classList.remove("hotel-print-mode");
      if (d.parentNode) d.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }, 300);
}

// ─── Main Invoice Component ────────────────────────────────────────────────
export default function Invoice() {
  const { curUser, curRole, bookings, rooms, updateBookings, revenues, updateRevenues, notify, pendingInvoiceId, setPendingInvoiceId } = useApp();

  const [selId,    setSelId]    = useState("");
  const [mode,     setMode]     = useState("room");
  const [extras,   setExtras]   = useState([]);
  const [roomAmt,  setRoomAmt]  = useState("");
  const [roomMtd,  setRoomMtd]  = useState("Cash");
  const [roomNote, setRoomNote] = useState("");
  const [extAmt,   setExtAmt]   = useState("");
  const [extMtd,   setExtMtd]   = useState("Cash");
  const [extNote,  setExtNote]  = useState("");

  const selBk = useMemo(() => bookings.find(b => b.id === parseInt(selId)), [bookings, selId, extras]);

  useEffect(() => {
    if (pendingInvoiceId != null) {
      setSelId(String(pendingInvoiceId));
      setPendingInvoiceId(null);
    }
  }, [pendingInvoiceId]);

  useEffect(() => {
    if (!selBk) { setExtras([]); setRoomAmt(""); setExtAmt(""); return; }
    const loadedExtras = (selBk.invoiceExtras || []).map(e => ({ ...e }));
    setExtras(loadedExtras);
    // Auto-fill amount with current balance due
    const _base = selBk.baseAmount || selBk.amount || 0;
    const _disc = selBk.discAmt || selBk.invoiceDiscount || 0;
    const _rTotal = Math.max(0, _base - _disc);
    const _ep = (selBk.extraPersonCharge && selBk.extraPersonCharge.total) || 0;
    const _exTotal = loadedExtras.filter(x=>x.desc&&x.rate>0).reduce((s,x)=>s+x.qty*x.rate,0);
    const _grand = _rTotal + _exTotal + _ep;
    const _adv = selBk.advance || 0;
    const _extAdv = selBk.extrasAdvance || 0;
    const _bal = Math.max(0, _grand - _adv - _extAdv);
    setRoomAmt(_bal > 0 ? String(_bal) : "");
    setExtAmt(_ep + _exTotal > 0 ? String(Math.max(0, _ep + _exTotal - _extAdv)) : "");
  }, [selId]);

  // Derive computed values
  const disc         = selBk ? (selBk.discAmt || selBk.invoiceDiscount || 0) : 0;
  const base         = selBk ? (selBk.baseAmount || selBk.amount || 0) : 0;
  const roomTotal    = Math.max(0, base - disc);
  const validExtras  = extras.filter(x => x.desc && x.rate > 0);
  const extrasTotal  = validExtras.reduce((s,x) => s + x.qty * x.rate, 0);
  const epCharge     = selBk ? ((selBk.extraPersonCharge && selBk.extraPersonCharge.total) || 0) : 0;
  const combinedExt  = extrasTotal + epCharge;
  const grandTotal   = roomTotal + combinedExt;
  const advance      = selBk ? (selBk.advance || 0) : 0;
  const extAdv       = selBk ? (selBk.extrasAdvance || 0) : 0;
  const totalPaid    = advance + extAdv;
  const totalBal     = Math.max(0, grandTotal - totalPaid);
  const roomBalDue   = Math.max(0, grandTotal - totalPaid);
  const extBalDue    = Math.max(0, combinedExt - extAdv);

  const roomStatus   = advance >= roomTotal && roomTotal > 0 ? "paid" : advance > 0 ? "partial" : "unpaid";
  const extrasStatus = combinedExt === 0 ? "unpaid" : extAdv >= combinedExt ? "paid" : extAdv > 0 ? "partial" : "unpaid";

  const BADGE_MAP = {
    paid:    { bg:"#d4f5e2", color:"#074d22", border:"#2e8b57", icon:"✅", text:"Fully Paid" },
    partial: { bg:"#fef0b0", color:"#5a3800", border:"#c8960a", icon:"⏳", text:"Partial — Balance Due" },
    unpaid:  { bg:"#fcd5d5", color:"#6b0000", border:"#c03030", icon:"❌", text:"Unpaid" },
  };

  function PayBadge({ status }) {
    const m = BADGE_MAP[status] || BADGE_MAP.unpaid;
    return (
      <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"8px 12px", borderRadius:7,
        fontSize:12, fontWeight:700, background:m.bg, color:m.color, border:"1.5px solid "+m.border }}>
        {m.icon} {m.text}
      </div>
    );
  }

  const invPreviewHTML = useMemo(() => {
    if (!selBk) return "";
    return buildInvoiceHTML(selBk, rooms, extras, mode);
  }, [selBk, rooms, extras, mode, bookings]);

  function addExtraRow() {
    if (!selBk) { notify("Select a booking first","error"); return; }
    setExtras(prev => [...prev, { desc:"", qty:1, rate:0, date:todayStr() }]);
  }
  function removeExtra(i) { setExtras(prev => prev.filter((_,idx) => idx !== i)); }
  function updateExtra(i, field, val) {
    setExtras(prev => prev.map((x,idx) => idx===i ? {...x,[field]:field==="qty"||field==="rate"?+val:val} : x));
  }

  function saveChanges(silent) {
    if (!selBk) { if(!silent) notify("Select a booking first","error"); return; }
    const newTotal = Math.max(0, base + validExtras.reduce((s,x) => s+x.qty*x.rate, 0) - disc);
    const updated = bookings.map(b => b.id === selBk.id ? {
      ...b,
      invoiceExtras: validExtras,
      invoiceTotal: newTotal,
      invoiceDate: b.invoiceDate || todayStr(),
    } : b);
    updateBookings(updated);
    if (!silent) notify("Invoice saved — GA-" + String(selBk.id).padStart(4,"0"),"success");
  }

  function collectPayment(type) {
    if (!selBk) { notify("Select a booking first","error"); return; }
    const amt    = parseFloat(type==="room" ? roomAmt : extAmt) || 0;
    const method = type==="room" ? roomMtd : extMtd;
    const note   = type==="room" ? roomNote : extNote;
    const balDue = type==="room" ? roomBalDue : extBalDue;
    if (amt <= 0) { notify("Enter a valid amount","error"); return; }
    if (amt > balDue + 0.01) { notify("Amount exceeds balance due (" + money(balDue) + ")","error"); return; }
    const entry = { ts:new Date().toISOString(), amount:amt, method, note:note||"", type:type==="room"?"room":"service", by:curUser||"staff" };
    const updated = bookings.map(b => {
      if (b.id !== selBk.id) return b;
      const hist = [...(b.paymentHistory || []), entry];
      const newAdv   = type==="room"  ? (b.advance||0)+amt : (b.advance||0);
      const newExtAdv= type==="extras"? (b.extrasAdvance||0)+amt : (b.extrasAdvance||0);
      return { ...b, paymentHistory:hist, advance:newAdv, extrasAdvance:newExtAdv };
    });
    updateBookings(updated);
    const rev = { id:maxId(revenues), source:"Room Rent", amount:amt, date:todayStr(),
      note:selBk.guest+" Rm "+selBk.room+" - "+(note||type+" payment")+" ("+method+")", bookingId:selBk.id };
    updateRevenues([...revenues, rev]);
    notify("Payment of " + money(amt) + " recorded","success");
    // After payment, clear note and set remaining balance in amount field
    const remaining = Math.max(0, balDue - amt);
    if (type==="room") { setRoomAmt(remaining > 0 ? String(remaining) : ""); setRoomNote(""); }
    else               { setExtAmt(remaining > 0 ? String(remaining) : ""); setExtNote(""); }
  }

  function printRoomOnly() {
    if (!selBk) { notify("Select a booking first","error"); return; }
    saveChanges(true);
    const html = buildInvoiceHTML(selBk, rooms, [], mode);
    const tcEnabled = localStorage.getItem("ga_tc_enabled") !== "false";
    const needsTC   = tcEnabled && !selBk.tcPrinted;
    hotelPrint(html, needsTC ? buildTCHtml(selBk) : null);
    if (needsTC) {
      updateBookings(bookings.map(b => b.id===selBk.id ? {...b, tcPrinted:true} : b));
    }
  }

  function printExtrasInvoice() {
    if (!selBk) { notify("Select a booking first","error"); return; }
    if (!validExtras.length) { notify("No additional service charges added yet","error"); return; }
    saveChanges(true);
    // Build a service-only invoice
    const extHtml = buildExtrasOnlyHTML(selBk, validExtras, extAdv, combinedExt);
    hotelPrint(extHtml, null);
  }

  function printComplete() {
    if (!selBk) { notify("Select a booking first","error"); return; }
    saveChanges(true);
    const html = buildInvoiceHTML(selBk, rooms, validExtras, mode);
    const tcEnabled = localStorage.getItem("ga_tc_enabled") !== "false";
    const needsTC   = tcEnabled && !selBk.tcPrinted;
    hotelPrint(html, needsTC ? buildTCHtml(selBk) : null);
    if (needsTC) {
      updateBookings(bookings.map(b => b.id===selBk.id ? {...b, tcPrinted:true} : b));
    }
  }

  function printWithTC() {
    if (!selBk) { notify("Select a booking first","error"); return; }
    saveChanges(true);
    const html = buildInvoiceHTML(selBk, rooms, validExtras, mode);
    hotelPrint(html, buildTCHtml(selBk));
  }

  const activeBookings = bookings.filter(b => b.status !== "cancelled");

  return (
    <div style={{ padding:"18px 20px 32px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"380px 1fr", gap:16, alignItems:"start" }}>

        {/* ── Left Panel ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>

          {/* Title */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <i className="ti ti-file-invoice" style={{ fontSize:18, color:"var(--gold2)" }} />
            <span style={{ fontSize:15, fontWeight:800, color:"var(--navy)" }}>Generate Invoice</span>
          </div>

          {/* Booking select */}
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Select Booking</label>
            <select value={selId} onChange={e => setSelId(e.target.value)}>
              <option value="">— Choose a booking —</option>
              {activeBookings.map(b => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.guest} · Rm {b.room} · {b.checkin}
                </option>
              ))}
            </select>
          </div>

          {/* Info banner */}
          {selBk && (
            <div style={{ background:"var(--green-bg)", border:"1px solid var(--green-bd)", borderRadius:7, padding:"8px 12px", fontSize:11.5, color:"var(--green2)", lineHeight:1.6 }}>
              {selBk.guest} · Room {selBk.room} · {selBk.checkin} → {selBk.checkout} · {money(selBk.amount)}
            </div>
          )}

          {/* Mode toggle */}
          <div style={{ display:"flex", gap:0, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:9, padding:3 }}>
            {[["room","🏠 Room Invoice"],["extras","🧾 Service Invoice"]].map(([k,l]) => (
              <button key={k} onClick={() => setMode(k)} style={{
                flex:1, padding:"9px 12px", border:"none", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                background: mode===k ? "var(--navy)" : "transparent",
                color: mode===k ? "#E8C96A" : "var(--text3)",
              }}>{l}</button>
            ))}
          </div>

          {/* ── ROOM MODE ── */}
          {mode === "room" && (
            <div style={{ border:"1px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
              <div style={{ background:"var(--navy)", padding:"9px 14px", display:"flex", alignItems:"center", gap:7 }}>
                <i className="ti ti-home-2" style={{ color:"var(--gold2)", fontSize:14 }} />
                <span style={{ fontSize:11, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:.8 }}>Room Charge</span>
              </div>
              <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label>Payment Status <span style={{ fontSize:9, color:"var(--text3)", fontWeight:400 }}>(auto-calculated)</span></label>
                  <PayBadge status={selBk ? roomStatus : "unpaid"} />
                </div>

                {/* Collect payment — only when balance > 0 */}
                {selBk && roomBalDue > 0 && (
                  <div style={{ border:"1.5px solid #c0392b", borderRadius:8, overflow:"hidden" }}>
                    <div style={{ background:"#c0392b", padding:"7px 12px", display:"flex", alignItems:"center", gap:6 }}>
                      <i className="ti ti-cash" style={{ color:"#fff", fontSize:13 }} />
                      <span style={{ fontSize:11, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:.8 }}>Collect Payment</span>
                      <span style={{ marginLeft:"auto", fontSize:11, fontWeight:800, color:"#ffe0e0" }}>Total Due: {money(roomBalDue)}</span>
                    </div>
                    <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:8, background:"#fff8f8" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                        <div className="form-group" style={{ marginBottom:0 }}>
                          <label>Amount (৳)</label>
                          <input type="number" value={roomAmt} onChange={e=>setRoomAmt(e.target.value)} placeholder="0" min="1" style={{ fontWeight:700 }} />
                        </div>
                        <div className="form-group" style={{ marginBottom:0 }}>
                          <label>Method</label>
                          <select value={roomMtd} onChange={e=>setRoomMtd(e.target.value)}>
                            {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m=><option key={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label>Note (optional)</label>
                        <input value={roomNote} onChange={e=>setRoomNote(e.target.value)} placeholder="e.g. final settlement" />
                      </div>
                      <button onClick={() => collectPayment("room")} style={{ width:"100%", padding:9, background:"#1a7040", color:"#fff", border:"none", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        <i className="ti ti-check" /> Confirm Payment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SERVICE MODE ── */}
          {mode === "extras" && (
            <div style={{ border:"1px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
              <div style={{ background:"linear-gradient(135deg,#5a3000,#7a4500)", padding:"9px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <i className="ti ti-room-service" style={{ color:"#f5d99a", fontSize:14 }} />
                  <span style={{ fontSize:11, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:.8 }}>Additional Service Charge</span>
                </div>
                <button onClick={addExtraRow} style={{ padding:"3px 10px", background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", borderRadius:6, color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                  <i className="ti ti-plus" /> Add Item
                </button>
              </div>
              <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                {extras.map((ex, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 50px 80px auto", gap:5, alignItems:"center" }}>
                    <input placeholder="e.g. BBQ Night" value={ex.desc} onChange={e=>updateExtra(i,"desc",e.target.value)} style={{ fontSize:12 }} />
                    <input type="number" placeholder="Qty" value={ex.qty} onChange={e=>updateExtra(i,"qty",e.target.value)} style={{ fontSize:12 }} />
                    <input type="number" placeholder="Rate" value={ex.rate} onChange={e=>updateExtra(i,"rate",e.target.value)} style={{ fontSize:12 }} />
                    <button className="btn sm danger icon-btn" onClick={()=>removeExtra(i)}><i className="ti ti-trash" /></button>
                  </div>
                ))}
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label>Payment Status <span style={{ fontSize:9, color:"var(--text3)", fontWeight:400 }}>(auto-calculated)</span></label>
                  <PayBadge status={selBk ? extrasStatus : "unpaid"} />
                </div>
                {selBk && extBalDue > 0 && (
                  <div style={{ border:"1.5px solid #c0392b", borderRadius:8, overflow:"hidden" }}>
                    <div style={{ background:"#c0392b", padding:"7px 12px", display:"flex", alignItems:"center", gap:6 }}>
                      <i className="ti ti-cash" style={{ color:"#fff", fontSize:13 }} />
                      <span style={{ fontSize:11, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:.8 }}>Collect Payment</span>
                      <span style={{ marginLeft:"auto", fontSize:11, fontWeight:800, color:"#ffe0e0" }}>Due: {money(extBalDue)}</span>
                    </div>
                    <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:8, background:"#fff8f8" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                        <div className="form-group" style={{ marginBottom:0 }}>
                          <label>Amount (৳)</label>
                          <input type="number" value={extAmt} onChange={e=>setExtAmt(e.target.value)} placeholder="0" min="1" style={{ fontWeight:700 }} />
                        </div>
                        <div className="form-group" style={{ marginBottom:0 }}>
                          <label>Method</label>
                          <select value={extMtd} onChange={e=>setExtMtd(e.target.value)}>
                            {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m=><option key={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label>Note (optional)</label>
                        <input value={extNote} onChange={e=>setExtNote(e.target.value)} placeholder="e.g. game zone settled" />
                      </div>
                      <button onClick={() => collectPayment("extras")} style={{ width:"100%", padding:9, background:"#1a7040", color:"#fff", border:"none", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        <i className="ti ti-check" /> Confirm Payment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview + Save */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
            <button className="btn gold" onClick={() => {
              saveChanges(true);
              notify("Invoice preview updated","success");
            }} style={{ justifyContent:"center" }}>
              <i className="ti ti-eye" /> Preview
            </button>
            <button onClick={() => saveChanges(false)} style={{ background:"#1a7040", color:"#fff", border:"none", borderRadius:8, padding:"10px 14px", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:"'DM Sans',sans-serif" }}>
              <i className="ti ti-device-floppy" /> Save
            </button>
          </div>

          {/* PRINT section */}
          <div style={{ border:"2px solid var(--navy)", borderRadius:10, overflow:"hidden", boxShadow:"0 3px 14px rgba(10,22,40,.13)" }}>
            <div style={{ background:"var(--navy)", padding:"11px 14px", display:"flex", alignItems:"center", gap:8 }}>
              <i className="ti ti-printer" style={{ color:"#E8C96A", fontSize:17 }} />
              <span style={{ fontSize:12, fontWeight:800, color:"#fff", textTransform:"uppercase", letterSpacing:1.2 }}>Print Invoice</span>
            </div>

            {/* T&C notice */}
            {selBk && !selBk.tcPrinted && localStorage.getItem("ga_tc_enabled") !== "false" && (
              <div style={{ margin:"8px 8px 0", background:"#e8f5e9", border:"1.5px solid #27ae60", borderRadius:8, padding:"9px 12px", fontSize:11, color:"#1a5a2e", lineHeight:1.6 }}>
                <b>📋 First Print:</b> Terms &amp; Conditions (অতিথি নিয়মাবলী) will be included as page 2.<br/>
                <span style={{ color:"#555" }}>💡 Enable <b>Two-sided (Duplex)</b> printing in your printer dialog to print it on the back of this page.</span>
              </div>
            )}

            <div style={{ padding:8, display:"flex", flexDirection:"column", gap:7, background:"var(--bg2)" }}>
              {/* Print Room Invoice */}
              <button onClick={printRoomOnly} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"2px solid rgba(10,22,40,.18)", borderRadius:8, background:"rgba(10,22,40,.04)", cursor:"pointer", width:"100%", textAlign:"left", fontFamily:"'DM Sans',sans-serif" }}>
                <div style={{ width:38, height:38, background:"var(--navy)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <i className="ti ti-printer" style={{ color:"#E8C96A", fontSize:17 }} />
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:"var(--navy)" }}>🏠 Print Room Invoice</div>
                  <div style={{ fontSize:10.5, color:"var(--text3)", marginTop:2 }}>Room charges only</div>
                </div>
              </button>

              {/* Print Service Charge Invoice */}
              <button onClick={printExtrasInvoice} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"2px solid rgba(201,168,76,.4)", borderRadius:8, background:"rgba(201,168,76,.06)", cursor:"pointer", width:"100%", textAlign:"left", fontFamily:"'DM Sans',sans-serif" }}>
                <div style={{ width:38, height:38, background:"linear-gradient(135deg,#C9A84C,#E8C96A)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <i className="ti ti-printer" style={{ color:"#0d1b2e", fontSize:17 }} />
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#7a5500" }}>🧾 Print Service Charge Invoice</div>
                  <div style={{ fontSize:10.5, color:"var(--text3)", marginTop:2 }}>Additional service charges only</div>
                </div>
              </button>

              {/* Print Complete Invoice */}
              <button onClick={printComplete} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"2px solid rgba(26,112,64,.3)", borderRadius:8, background:"rgba(26,112,64,.06)", cursor:"pointer", width:"100%", textAlign:"left", fontFamily:"'DM Sans',sans-serif" }}>
                <div style={{ width:38, height:38, background:"linear-gradient(135deg,#1a7040,#22a05a)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <i className="ti ti-printer" style={{ color:"#fff", fontSize:17 }} />
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#1a5a2e" }}>📄 Print Complete Invoice</div>
                  <div style={{ fontSize:10.5, color:"var(--text3)", marginTop:2 }}>Room + all service charges combined</div>
                </div>
              </button>

              {/* Print with T&C */}
              <button onClick={printWithTC} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"2px dashed rgba(139,26,26,.4)", borderRadius:8, background:"rgba(139,26,26,.04)", cursor:"pointer", width:"100%", textAlign:"left", fontFamily:"'DM Sans',sans-serif" }}>
                <div style={{ width:38, height:38, background:"linear-gradient(135deg,#8B1A1A,#b02020)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <i className="ti ti-file-text" style={{ color:"#f5d67a", fontSize:17 }} />
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#8B1A1A" }}>📋 Print with Terms &amp; Conditions</div>
                  <div style={{ fontSize:10.5, color:"var(--text3)", marginTop:2 }}>Complete invoice + T&amp;C page (manual override)</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Panel: live preview ── */}
        <div id="hotel-print-area" style={{ position:"sticky", top:8, background:"var(--bg3)", borderRadius:10, padding:16 }}>
          {!selBk && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--text3)", gap:10 }}>
              <i className="ti ti-file-invoice" style={{ fontSize:48, opacity:.3 }} />
              <div style={{ fontSize:14, fontWeight:600 }}>Select a booking to preview the invoice</div>
            </div>
          )}
          {selBk && (
            <div dangerouslySetInnerHTML={{ __html: invPreviewHTML }} />
          )}
        </div>
      </div>
    </div>
  );
}

// Extras-only invoice builder
function buildExtrasOnlyHTML(b, validExtras, extAdv, combinedExt) {
  const extrasTotal = validExtras.reduce((s,x) => s + x.qty * x.rate, 0);
  const extBal = Math.max(0, combinedExt - extAdv);
  const extStatus = extAdv >= combinedExt && combinedExt > 0 ? "paid" : extAdv > 0 ? "partial" : "unpaid";
  const sc = extStatus==="paid" ? "#1a7040" : extStatus==="partial" ? "#b07800" : "#c0392b";
  const st = extStatus==="paid" ? "PAID" : extStatus==="partial" ? "PARTIAL" : "UNPAID";
  const invNum = "GA-" + String(b.id).padStart(4,"0") + "-EXT";

  const eRows = validExtras.map(ex => {
    const exDate = ex.date ? fmtDate(ex.date) : fmtDate(b.checkin);
    return '<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;color:#777;font-size:10px;">'+exDate+'</td>'
      + '<td style="padding:8px 10px;border-bottom:1px solid #eee;color:#222;font-size:10px;">'+ex.desc+'</td>'
      + '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;color:#555;font-size:10px;">'+ex.qty+'</td>'
      + '<td style="padding:8px 10px;border-bottom:1px solid #ddd;text-align:right;color:#333;font-size:10px;">\u09F3'+ex.rate.toLocaleString("en-IN")+'</td>'
      + '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;color:#B7770D;font-weight:700;font-size:10px;">\u09F3'+(ex.qty*ex.rate).toLocaleString("en-IN")+'</td></tr>';
  }).join("");

  return '<div style="width:100%;min-height:257mm;border:1.5px solid #1a1a2e;border-radius:6px;overflow:hidden;font-family:DM Sans,sans-serif;background:#fff;box-sizing:border-box;display:flex;flex-direction:column;">'
    + '<div style="padding:18px 24px 14px;border-bottom:2px solid #1a1a2e;display:grid;grid-template-columns:1fr 160px 1fr;gap:12px;align-items:start;">'
      + '<div><div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:7px;">Bill To</div>'
        + '<div style="font-size:17px;font-weight:700;color:#1a1a2e;font-family:Georgia,serif;margin-bottom:6px;">'+b.guest+'</div>'
        + '<div style="font-size:10px;color:#555;">'+b.phone+'</div>'
        + (b.idNum ? '<div style="font-size:9.5px;color:#aaa;">'+b.idType+': '+b.idNum+'</div>' : '')
      + '</div>'
      + '<div style="text-align:center;">'
        + '<div style="font-family:Georgia,serif;font-size:19px;font-weight:700;color:#1a1a2e;line-height:1.2;margin-bottom:3px;">The Grand Alayna</div>'
        + '<div style="font-size:7.5px;letter-spacing:3px;color:#aaa;text-transform:uppercase;">Luxury for all</div>'
      + '</div>'
      + '<div style="text-align:right;">'
        + '<div style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#C9A84C;letter-spacing:1px;line-height:1;">ADDITIONAL SERVICE CHARGE</div>'
        + '<div style="font-size:11px;line-height:1.9;margin-top:6px;">'
          + '<div><span style="color:#444;font-size:11px;font-weight:600;min-width:90px;display:inline-block;">Invoice No.</span>: <strong>'+invNum+'</strong></div>'
          + '<div><span style="color:#444;font-size:11px;font-weight:600;min-width:90px;display:inline-block;">Guest Name</span>: <strong>'+b.guest+'</strong></div>'
          + '<div><span style="color:#444;font-size:11px;font-weight:600;min-width:90px;display:inline-block;">Room No.</span>: <strong>'+b.room+'</strong></div>'
        + '</div>'
      + '</div>'
    + '</div>'
    + '<div style="padding:12px 24px;"><table style="width:100%;border-collapse:collapse;">'
      + '<thead><tr style="background:#eeeae2;border-bottom:2px solid #1a1a2e;">'
        + '<th style="padding:8px 10px;text-align:left;color:#C9A84C;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Date</th>'
        + '<th style="padding:8px 10px;text-align:left;color:#C9A84C;font-size:8px;text-transform:uppercase;font-weight:700;">Description</th>'
        + '<th style="padding:8px 10px;text-align:center;color:#C9A84C;font-size:8px;text-transform:uppercase;font-weight:700;">Qty</th>'
        + '<th style="padding:8px 10px;text-align:right;color:#C9A84C;font-size:8px;text-transform:uppercase;font-weight:700;">Rate</th>'
        + '<th style="padding:8px 10px;text-align:right;color:#C9A84C;font-size:8px;text-transform:uppercase;font-weight:700;">Amount</th>'
      + '</tr></thead>'
      + '<tbody>'+eRows+'</tbody>'
    + '</table></div>'
    + '<div style="padding:0 24px 12px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">'
      + '<div style="border:2px solid '+sc+';border-radius:7px;padding:12px 14px;text-align:center;">'
        + '<div style="font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:5px;">Payment Status</div>'
        + '<div style="font-size:22px;font-weight:900;letter-spacing:3px;color:'+sc+';font-family:Georgia,serif;margin-bottom:6px;">'+st+'</div>'
        + '<div style="font-size:8.5px;color:#aaa;">Hotel The Grand Alayna</div>'
      + '</div>'
      + '<div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;background:#1a1a2e;border-radius:4px;margin-bottom:4px;">'
          + '<span style="font-size:11px;font-weight:800;text-transform:uppercase;color:#C9A84C;">Total Amount (\u09F3)</span>'
          + '<span style="font-size:17px;font-weight:800;color:#C9A84C;font-family:Georgia,serif;">\u09F3'+extrasTotal.toLocaleString("en-IN")+'</span>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;border-radius:4px;margin-top:4px;'+(extBal>0?"background:#fff0f0;border:1.5px solid #c0392b;":"background:#f0fff4;border:1.5px solid #1a7040;")+'"><span style="font-size:8.5px;font-weight:800;text-transform:uppercase;color:'+(extBal>0?"#c0392b":"#1a7040")+'">'+(extBal>0?"Balance Due":"Fully Paid ✔")+'</span><span style="font-size:17px;font-weight:800;color:'+(extBal>0?"#c0392b":"#1a7040")+';font-family:Georgia,serif;">\u09F3'+extBal.toLocaleString("en-IN")+'</span></div>'
      + '</div>'
    + '</div>'
    + '<div style="flex:1;min-height:4px;"></div>'
    + '<div style="border-top:2px solid #1a1a2e;padding:12px 24px;background:#fafaf8;text-align:center;font-size:8px;color:#aaa;font-style:italic;">This is a computer-generated invoice. Thank you for choosing Hotel The Grand Alayna.</div>'
    + '</div>';
}
