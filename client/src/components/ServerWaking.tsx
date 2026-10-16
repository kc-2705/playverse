import { useEffect, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';

/** A small notice while the free server wakes up (its first request after a quiet spell is slow). */
export default function ServerWaking() {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setWaking(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener('pv:waking', on);
    return () => window.removeEventListener('pv:waking', on);
  }, []);
  if (!waking) return null;
  return (
    <div className="server-waking" role="status">
      <LoadingOutlined /> Waking up the game server… the first visit after a quiet spell can take up to a minute.
    </div>
  );
}
