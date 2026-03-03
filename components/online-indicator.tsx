"use client";

import { useEffect, useState } from "react";

export function OnlineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        online
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-900"
      }`}
    >
      {online ? "Online" : "Offline: actions queueing"}
    </div>
  );
}
