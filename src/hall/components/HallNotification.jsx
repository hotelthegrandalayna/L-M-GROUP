
import { useHall } from "../HallContext";
export default function HallNotification() {
  const { notification } = useHall();
  if (!notification) return null;
  return <div className={"notif " + notification.type + " show"}>{notification.msg}</div>;
}
