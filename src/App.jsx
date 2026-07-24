
import { useState } from "react";
import Welcome  from "./components/Welcome";
import HallApp  from "./hall/HallApp";
import HotelApp from "./HotelApp";
import ConnectionBanner from "./components/ConnectionBanner";

export default function App() {
  const [app, setApp] = useState(null); // null | "hotel" | "hall"

  return (
    <>
      <ConnectionBanner />
      {!app
        ? <Welcome onChoose={setApp} />
        : app === "hall"
          ? <HallApp  onSwitchApp={()=>setApp(null)} />
          : <HotelApp onSwitchApp={()=>setApp(null)} />}
    </>
  );
}
