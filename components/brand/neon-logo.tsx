import clsx from "clsx";
import Image from "next/image";

type NeonLogoProps = {
  className?: string;
  compact?: boolean;
  label?: string;
  tagline?: string;
};

export function NeonLogo({
  className,
  compact = false,
  label = "A1 Parola",
  tagline = "Windows, gutters, and solar cleaning",
}: NeonLogoProps) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <Image
        src="/a1parola-logo.svg"
        alt={compact ? "A1 Parola" : ""}
        width={159}
        height={173}
        className={clsx(
          "h-14 w-auto shrink-0 rounded-lg border border-[#D0B830]/45 bg-black shadow-[0_10px_24px_rgba(8,7,4,0.24)]",
          compact && "h-11",
        )}
      />
      {compact ? null : (
        <div>
          <p className="text-sm font-black uppercase text-[#080704]">{label}</p>
          <p className="text-xs font-semibold text-[#6a6048]">{tagline}</p>
        </div>
      )}
    </div>
  );
}
