import clsx from "clsx";

type NeonLogoProps = {
  className?: string;
  compact?: boolean;
  label?: string;
  tagline?: string;
};

export function NeonLogo({
  className,
  compact = false,
  label = "a1parola",
  tagline = "Bright glass. Faster operations.",
}: NeonLogoProps) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <svg
        aria-hidden="true"
        className="h-12 w-12 shrink-0 drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)]"
        viewBox="0 0 256 256"
      >
        <defs>
          <linearGradient id="ww-logo-badge" x1="36" y1="24" x2="220" y2="232" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0f2742" />
            <stop offset="1" stopColor="#07111f" />
          </linearGradient>
          <linearGradient id="ww-logo-border" x1="32" y1="28" x2="224" y2="228" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="ww-logo-glass" x1="62" y1="48" x2="194" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dff7ff" />
          </linearGradient>
          <linearGradient id="ww-logo-blade" x1="61" y1="188" x2="203" y2="135" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#14b8a6" />
            <stop offset="0.72" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <rect width="256" height="256" rx="58" fill="#07111f" />
        <rect x="17" y="17" width="222" height="222" rx="48" fill="url(#ww-logo-badge)" stroke="url(#ww-logo-border)" strokeWidth="8" />
        <rect x="58" y="48" width="140" height="122" rx="18" fill="url(#ww-logo-glass)" stroke="#38bdf8" strokeWidth="8" />
        <path d="M128 52v113M62 109h132" fill="none" stroke="#bfdbfe" strokeLinecap="round" strokeWidth="6" />
        <path d="M79 72h34M79 88h21" fill="none" opacity=".95" stroke="#ffffff" strokeLinecap="round" strokeWidth="6" />
        <path d="M57 189c42-24 88-39 142-63" fill="none" stroke="#07111f" strokeLinecap="round" strokeWidth="30" />
        <path d="M57 189c42-24 88-39 142-63" fill="none" stroke="url(#ww-logo-blade)" strokeLinecap="round" strokeWidth="16" />
        <path d="M178 135h40" fill="none" stroke="#e2e8f0" strokeLinecap="round" strokeWidth="14" transform="rotate(-24 198 135)" />
        <path d="M182 135h30" fill="none" stroke="#64748b" strokeLinecap="round" strokeWidth="6" transform="rotate(-24 198 135)" />
        <circle cx="203" cy="190" r="8" fill="#a3ff12" />
      </svg>
      {compact ? null : (
        <div>
          <p className="text-sm font-black uppercase text-slate-950">{label}</p>
          <p className="text-xs font-semibold text-slate-600">{tagline}</p>
        </div>
      )}
    </div>
  );
}
