
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error("Tab error:", err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:40, textAlign:"center", fontFamily:"DM Sans,sans-serif" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
          <div style={{ fontSize:15, fontWeight:700, color:"#7B1212", marginBottom:8 }}>
            Something went wrong in this tab
          </div>
          <div style={{ fontSize:12, color:"#888", marginBottom:20, maxWidth:400, margin:"0 auto 20px" }}>
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding:"9px 20px", background:"#7B1212", color:"#fff", border:"none", borderRadius:9, cursor:"pointer", fontWeight:700 }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
