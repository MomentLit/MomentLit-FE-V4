import Image from "next/image";

export interface LogoProps {
  /** Rendered square size in px (both width and height). */
  size?: number;
  className?: string;
}

/** The MomentLit mark (`public/logo.png`) — replaces the earlier placeholder squares. */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="MomentLit"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
