import { useApp } from '../context/AppContext';

export default function Notification() {
  const { notification } = useApp();
  if (!notification) return null;
  return (
    <div className={'notif ' + notification.type + ' show'}>
      {notification.msg}
    </div>
  );
}
