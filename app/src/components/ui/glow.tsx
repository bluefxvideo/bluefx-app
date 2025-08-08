import React from "react";
import { cn } from "@/lib/utils";
import { cva, VariantProps } from "class-variance-authority";

const glowVariants = cva("absolute w-full", {
  variants: {
    variant: {
      top: "top-0",
      above: "-top-[128px]",
      bottom: "bottom-0",
      below: "-bottom-[128px]",
      center: "top-[50%]",
    },
  },
  defaultVariants: {
    variant: "top",
  },
});

const Glow = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof glowVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(glowVariants({ variant }), className)}
    {...props}
  >
    <div
      className={cn(
        "absolute left-1/2 h-[192px] w-[40%] -translate-x-1/2 scale-[1.8] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_hsla(var(--brand-foreground)/.3)_10%,_hsla(var(--brand-foreground)/0)_60%)] sm:h-[320px]",
        variant === "center" && "-translate-y-1/2",
      )}
    />
    <div
      className={cn(
        "absolute left-1/2 h-[96px] w-[30%] -translate-x-1/2 scale-[1.5] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_hsla(var(--brand)/.2)_10%,_hsla(var(--brand-foreground)/0)_60%)] sm:h-[160px]",
        variant === "center" && "-translate-y-1/2",
      )}
    />
  </div>
));
Glow.displayName = "Glow";

export { Glow };