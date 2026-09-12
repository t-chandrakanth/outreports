import { useEffect, useState } from 'react';
import { getOutbox, subscribeOutbox } from '../offline/outbox';
import type { QueueItem } from '../types';

/** Reactive view of the offline outbox. */
export function useOutbox(): QueueItem[] {
  const [items, setItems] = useState<QueueItem[]>([]);
  useEffect(() => {
    let alive = true;
    getOutbox().then((it) => {
      if (alive) setItems(it);
    });
    const unsub = subscribeOutbox(setItems);
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return items;
}
