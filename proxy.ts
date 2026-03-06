import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXEMPT_PATHS = new Set([
  "/api/stripe/webhook",
  "/api/internal/payments/reconcile",
]);
const STAFF_PATH_PREFIXES = [
  "/admin",
  "/worker",
  "/team",
  "/login",
  "/api/admin",
  "/api/jobs",
  "/api/auth",
];
const PORTAL_PATH_PREFIXES = ["/book", "/customer", "/api/customer", "/api/public"];
const INTERNAL_BYPASS_PREFIXES = ["/_next/", "/favicon", "/sw.js"];

type Surface = "staff" | "portal" | "neutral";

type DomainSplitConfig = {
  appOrigin: string;
  appHost: string;
  portalOrigin: string;
  portalHost: string;
};

function parseBaseUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    return {
      origin: parsed.origin,
      host: parsed.host.toLowerCase(),
      hostname: parsed.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function getDomainSplitConfig(): DomainSplitConfig | null {
  const appRaw = process.env.APP_BASE_URL;
  const portalRaw = process.env.PORTAL_BASE_URL;

  if (!appRaw || !portalRaw) {
    return null;
  }

  const app = parseBaseUrl(appRaw);
  const portal = parseBaseUrl(portalRaw);

  if (!app || !portal) {
    return null;
  }

  return {
    appOrigin: app.origin,
    appHost: app.host,
    portalOrigin: portal.origin,
    portalHost: portal.host,
  };
}

function normalizeHost(host: string | null) {
  return host?.trim().toLowerCase() ?? "";
}

function requestHost(request: NextRequest) {
  return normalizeHost(request.headers.get("x-forwarded-host") || request.headers.get("host"));
}

function classifySurface(pathname: string): Surface {
  if (STAFF_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return "staff";
  }

  if (PORTAL_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return "portal";
  }

  return "neutral";
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function parseTrustedOriginsFromEnv() {
  const raw = process.env.CSRF_TRUSTED_ORIGINS;
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));
}

function buildAllowedOrigins(request: NextRequest) {
  const allowed = new Set<string>(parseTrustedOriginsFromEnv());
  allowed.add(request.nextUrl.origin);

  const domainSplit = getDomainSplitConfig();
  if (domainSplit) {
    allowed.add(domainSplit.appOrigin);
    allowed.add(domainSplit.portalOrigin);
  }

  return allowed;
}

function isOriginAllowed(originValue: string, allowedOrigins: Set<string>) {
  try {
    const origin = new URL(originValue).origin;
    return allowedOrigins.has(origin);
  } catch {
    return false;
  }
}

function csrfError(message: string) {
  return NextResponse.json(
    {
      error: {
        code: "CSRF_FAILED",
        message,
      },
    },
    { status: 403 },
  );
}

function wrongDomainApiError(expectedHost: string) {
  return NextResponse.json(
    {
      error: {
        code: "WRONG_SUBDOMAIN",
        message: `This endpoint must be called from ${expectedHost}`,
      },
    },
    { status: 421 },
  );
}

function redirectToDomain(request: NextRequest, targetOrigin: string, targetPath?: string) {
  const path = targetPath ?? request.nextUrl.pathname;
  const redirectUrl = new URL(`${path}${request.nextUrl.search}`, targetOrigin);
  return NextResponse.redirect(redirectUrl, 307);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (INTERNAL_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const domainSplit = getDomainSplitConfig();
  if (domainSplit) {
    const host = requestHost(request);
    const isAppHost = host === domainSplit.appHost;
    const isPortalHost = host === domainSplit.portalHost;

    if (isAppHost || isPortalHost) {
      const surface = classifySurface(pathname);

      if (isAppHost && pathname === "/") {
        return redirectToDomain(request, domainSplit.appOrigin, "/team/sign-in");
      }

      if (isPortalHost && pathname === "/") {
        return redirectToDomain(request, domainSplit.portalOrigin, "/book");
      }

      if (surface === "staff" && isPortalHost) {
        if (isApiPath(pathname)) {
          return wrongDomainApiError(domainSplit.appHost);
        }

        return redirectToDomain(request, domainSplit.appOrigin);
      }

      if (surface === "portal" && isAppHost) {
        if (isApiPath(pathname)) {
          return wrongDomainApiError(domainSplit.portalHost);
        }

        return redirectToDomain(request, domainSplit.portalOrigin);
      }
    }
  }

  if (!isApiPath(pathname)) {
    return NextResponse.next();
  }

  if (!MUTATING_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  if (EXEMPT_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (
    secFetchSite &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "same-site" &&
    secFetchSite !== "none"
  ) {
    return csrfError("Cross-site requests are not allowed");
  }

  const allowedOrigins = buildAllowedOrigins(request);
  const originHeader = request.headers.get("origin");

  if (originHeader) {
    if (!isOriginAllowed(originHeader, allowedOrigins)) {
      return csrfError("Invalid request origin");
    }

    return NextResponse.next();
  }

  const refererHeader = request.headers.get("referer");
  if (refererHeader) {
    if (!isOriginAllowed(refererHeader, allowedOrigins)) {
      return csrfError("Invalid request referer");
    }

    return NextResponse.next();
  }

  return csrfError("Missing origin or referer");
}

export const config = {
  matcher: ["/:path*"],
};
