
import { useState } from "react";
import Welcome  from "./components/Welcome";
import HallApp  from "./hall/HallApp";
import HotelApp from "./HotelApp";

export default function App() {
  const [app, setApp] = useState(null); // null | "hotel" | "hall"

  if (!app)            return <Welcome onChoose={setApp} />;
  if (app === "hall")  return <HallApp  onSwitchApp={()=>setApp(null)} />;
  return                      <HotelApp onSwitchApp={()=>setApp(null)} />;
}
