import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-extrabold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#1b8a72] text-white shadow-live hover:bg-[#14715e]",
        secondary: "bg-muted text-foreground hover:bg-[#e3ddea]",
        ghost: "text-foreground hover:bg-muted",
        outline: "border bg-white text-foreground hover:bg-muted",
        dark: "bg-[#10233f] text-white hover:bg-[#071426]"
      },
      size: {
        default: "px-5 py-2.5",
        sm: "min-h-10 px-4 py-2",
        icon: "h-11 w-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}
