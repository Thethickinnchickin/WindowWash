"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function TrackableEvents() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const trackable = target.closest<HTMLElement>("[data-analytics-event]");
      if (!trackable) {
        return;
      }

      const anchor = trackable instanceof HTMLAnchorElement ? trackable : trackable.closest("a");
      const label = trackable.dataset.analyticsLabel ?? trackable.textContent?.trim().slice(0, 80);

      trackEvent(trackable.dataset.analyticsEvent ?? "site_click", {
        event_category: trackable.dataset.analyticsCategory ?? "site",
        event_label: label,
        link_url: anchor?.href,
        location: trackable.dataset.analyticsLocation,
      });
    }

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
