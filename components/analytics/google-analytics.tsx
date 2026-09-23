"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

type GoogleAnalyticsProps = {
  measurementId?: string;
};

function normalizeMeasurementId(measurementId?: string) {
  const trimmed = measurementId?.trim();
  if (!trimmed || !/^G-[A-Z0-9]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasSeenInitialPageview = useRef(false);
  const normalizedMeasurementId = normalizeMeasurementId(measurementId);

  useEffect(() => {
    if (!normalizedMeasurementId || !window.gtag || !pathname) {
      return;
    }

    const query = searchParams.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;

    if (!hasSeenInitialPageview.current) {
      hasSeenInitialPageview.current = true;
      return;
    }

    window.gtag("config", normalizedMeasurementId, {
      page_path: pagePath,
    });
  }, [normalizedMeasurementId, pathname, searchParams]);

  if (!normalizedMeasurementId) {
    return null;
  }

  const measurementIdJson = JSON.stringify(normalizedMeasurementId);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${normalizedMeasurementId}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', ${measurementIdJson});
          `,
        }}
      />
    </>
  );
}
