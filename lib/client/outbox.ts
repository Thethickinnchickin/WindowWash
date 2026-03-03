"use client";

export type QueueActionType = "status" | "note" | "cash_payment" | "check_payment";

export type OutboxAction = {
  id: string;
  jobId: string;
  endpoint: string;
  method: "POST";
  actionType: QueueActionType;
  body: Record<string, unknown>;
  createdAt: string;
};

const STORAGE_KEY = "ww_outbox";
const CHANGE_EVENT = "ww-outbox-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readOutbox(): OutboxAction[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as OutboxAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(actions: OutboxAction[]) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: actions }));
}

export function subscribeOutbox(callback: (actions: OutboxAction[]) => void) {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handler = () => callback(readOutbox());
  window.addEventListener(CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

export function enqueueOutbox(action: OutboxAction) {
  const current = readOutbox();
  writeOutbox([...current, action]);
}

function removeFromOutbox(id: string) {
  const current = readOutbox();
  writeOutbox(current.filter((item) => item.id !== id));
}

async function sendAction(action: OutboxAction) {
  const response = await fetch(action.endpoint, {
    method: action.method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action.body),
  });

  if (!response.ok) {
    const json = await response
      .json()
      .catch(() => ({ error: { message: `Request failed with ${response.status}` } }));
    throw new Error(json.error?.message || "Failed to sync action");
  }

  return response.json();
}

export async function flushOutbox() {
  if (!isBrowser()) {
    return { synced: 0, remaining: 0 };
  }

  if (!navigator.onLine) {
    return { synced: 0, remaining: readOutbox().length };
  }

  const queue = readOutbox();
  let synced = 0;

  for (const action of queue) {
    try {
      await sendAction(action);
      removeFromOutbox(action.id);
      synced += 1;
    } catch {
      // Keep failed item in queue for retry.
    }
  }

  return { synced, remaining: readOutbox().length };
}

export async function sendQueueableAction(params: {
  jobId: string;
  endpoint: string;
  actionType: QueueActionType;
  payload: Record<string, unknown>;
}) {
  const idempotencyKey =
    typeof params.payload.idempotencyKey === "string"
      ? (params.payload.idempotencyKey as string)
      : createIdempotencyKey();

  const body = {
    ...params.payload,
    idempotencyKey,
  };

  const action: OutboxAction = {
    id: idempotencyKey,
    jobId: params.jobId,
    endpoint: params.endpoint,
    method: "POST",
    actionType: params.actionType,
    body,
    createdAt: new Date().toISOString(),
  };

  if (!isBrowser() || !navigator.onLine) {
    enqueueOutbox(action);
    return { queued: true, idempotencyKey };
  }

  try {
    const response = await sendAction(action);
    return { queued: false, response, idempotencyKey };
  } catch {
    enqueueOutbox(action);
    return { queued: true, idempotencyKey };
  }
}

export function pendingJobIds() {
  return Array.from(new Set(readOutbox().map((item) => item.jobId)));
}
