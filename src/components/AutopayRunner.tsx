import { useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

/**
 * When Records opens, asks the server to add any autopay entries that have
 * fallen due (the daily cron does the same), then refreshes the list if any
 * were added. Renders nothing.
 */
export default function AutopayRunner({ onChanged }: { onChanged: () => void }) {
  useEffect(() => {
    let cancelled = false;
    api.post('/recurring/run')
      .then(({ data }) => {
        if (cancelled || !(data.created > 0)) return;
        toast.success(`${data.created} autopay ${data.created === 1 ? 'entry' : 'entries'} added`);
        onChanged();
      })
      .catch(() => { /* not fatal */ });
    return () => { cancelled = true; };
    // Once per time the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
