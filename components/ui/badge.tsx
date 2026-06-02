import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-[#37003c] text-white ring-[#37003c]/10",
  gold: "bg-[#ffb000] text-[#25002b] ring-[#ffb000]/30",
  green: "bg-[#00ff85] text-[#25002b] ring-[#00a85a]/20",
  cyan: "bg-[#04f5ff] text-[#25002b] ring-[#04f5ff]/30",
  muted: "bg-[#eeeaf2] text-[#6c5a73] ring-[#b8afc2]/30",
  red: "bg-[#e90052] text-white ring-[#e90052]/20"
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
