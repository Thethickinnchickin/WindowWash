"use client";

import { useEffect, useMemo, useState } from "react";
import {
  flushOutbox,
  pendingJobIds,
  readOutbox,
  subscribeOutbox,
  OutboxAction,
} from "@/lib/client/outbox";

export function useOutbox() {
  const [actions, setActions] = useState<OutboxAction[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    setActions(readOutbox());

    const unsub = subscribeOutbox((next) => {
      setActions(next);
    });

    const sync = async () => {
      const result = await flushOutbox();
      setActions(readOutbox());
      if (result.synced > 0) {
        setLastSyncedAt(new Date());
      }
    };

    const interval = window.setInterval(sync, 15000);
    const onlineListener = () => {
      void sync();
    };

    window.addEventListener("online", onlineListener);

    return () => {
      unsub();
      window.clearInterval(interval);
      window.removeEventListener("online", onlineListener);
    };
  }, []);

  const pendingByJobId = useMemo(() => {
    const ids = new Set(pendingJobIds());
    return ids;
  }, [actions]);

  return {
    actions,
    pendingCount: actions.length,
    pendingByJobId,
    lastSyncedAt,
    flushOutbox,
  };
}
