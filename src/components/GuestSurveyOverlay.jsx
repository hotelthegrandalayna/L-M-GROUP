import { useState } from "react";
import { useApp } from "../context/AppContext";
import { todayStr } from "../utils/helpers";

const QUESTIONS = [
  { key: "cleanliness", label: "Room Cleanliness",   icon: "🧹" },
  { key: "staff",       label: "Staff Friendliness", icon: "😊" },
  { key: "value",       label: "Value for Money",    icon: "💰" },
  { key: "facilities",  label: "Facilities",         icon: "🏛️" },
  { key: "overall",     label: "Overall Experience", icon: "⭐" },
];

export default function GuestSurveyOverlay({ booking, onClose }) {
  const { surveyData, setSurveys, notify } = useApp();
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [avg, setAvg] = useState(null);

  function setRating(key, val) {
    setRatings(prev => ({ ...prev, [key]: val }));
  }

  function submit() {
    const scores = Object.values(ratings).map(Number);
    if (scores.length < 3) { alert("Please rate at least 3 categories before submitting."); return; }
    const average = scores.reduce((s, v) => s + v, 0) / scores.length;
    const entry = {
      bookingId: booking.id,
      guest: booking.guest,
      phone: booking.phone,
      room: booking.room,
      date: todayStr(),
      ...ratings,
      avg: parseFloat(average.toFixed(1)),
      comment,
      source: "guest",
    };
    setSurveys([...(surveyData || []), entry]);
    notify("Survey saved · Avg: " + average.toFixed(1) + "/5", "success");
    setAvg(average);
    setSubmitted(true);
  }

  const overlayStyle = {
    position: "fixed", inset: 0,
    background: "#0E1E3A",
    zIndex: 9999,
    display: "flex", flexDirection: "column",
    overflowY: "auto",
    fontFamily: "inherit",
  };

  if (submitted) {
    const stars = "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));
    const emoji = avg >= 4 ? "🎉" : avg >= 3 ? "😊" : "🙏";
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={{ maxWidth: 400, margin: "0 auto", width: "100%", padding: "40px 22px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 18 }}>{emoji}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 10 }}>Thank You!</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,.7)", lineHeight: 1.7, marginBottom: 24 }}>
            Your feedback means everything to us.<br />We look forward to welcoming you back!
          </div>
          <div style={{ fontSize: 28, color: "#E8C96A", letterSpacing: 5, marginBottom: 8 }}>{stars}</div>
          <div style={{ fontSize: 16, color: "#E8C96A", fontWeight: 700 }}>{avg.toFixed(1)} / 5</div>
          <div style={{ marginTop: 28, fontSize: 12, color: "rgba(255,255,255,.25)" }}>
            Staff: tap anywhere to return to the desk
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={{ maxWidth: 540, margin: "0 auto", width: "100%", padding: "30px 22px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Hotel header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,#C9983A,#E8C96A)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#0E1E3A", margin: "0 auto 10px" }}>GA</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>Hotel The Grand Alayna</div>
          <div style={{ fontSize: 12, color: "#E8C96A", marginTop: 3 }}>Sitakunda · Chattogram</div>
        </div>

        {/* Guest greeting */}
        <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 13, padding: 18, textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>🙏</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Thank you, {booking.guest}!</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.6 }}>
            We hope you had a wonderful stay in Room {booking.room}.<br />
            Please take 30 seconds to rate your experience.
          </div>
        </div>

        {/* Rating questions */}
        {QUESTIONS.map((q, qi) => (
          <div key={q.key} style={{ background: "rgba(255,255,255,.05)", border: "1px solid " + (ratings[q.key] ? "rgba(201,152,58,.5)" : "rgba(255,255,255,.08)"), borderRadius: 12, padding: 16, marginBottom: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>{q.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{q.label}</span>
              {ratings[q.key] && <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: "#E8C96A" }}>{ratings[q.key]} / 5</span>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(q.key, s)} style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: ratings[q.key] >= s ? "linear-gradient(135deg,#C9983A,#E8C96A)" : "rgba(255,255,255,.08)",
                  border: "2px solid " + (ratings[q.key] >= s ? "#C9983A" : "rgba(255,255,255,.1)"),
                  cursor: "pointer", fontSize: 22, color: ratings[q.key] >= s ? "#fff" : "rgba(255,255,255,.3)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  transition: "all .15s",
                }}>★</button>
              ))}
            </div>
          </div>
        ))}

        {/* Comment */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,.5)", display: "block", marginBottom: 7 }}>Any comments? (optional)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder="Tell us what you loved..."
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 9, padding: 11, color: "#fff", fontSize: 13, resize: "none", fontFamily: "inherit" }}
          />
        </div>

        {/* Submit */}
        <button onClick={submit} style={{ width: "100%", padding: 17, background: "linear-gradient(135deg,#C9983A,#B8832A)", color: "#fff", border: "none", borderRadius: 13, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Submit My Rating
        </button>

        <button onClick={onClose} style={{ marginTop: 14, background: "none", border: "none", color: "rgba(255,255,255,.3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Skip
        </button>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "rgba(255,255,255,.2)" }}>
          Hotel The Grand Alayna · Sitakund-4310, Chittagong
        </div>
      </div>
    </div>
  );
}
