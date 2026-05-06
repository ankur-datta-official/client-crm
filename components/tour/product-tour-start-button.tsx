"use client";

import { LifeBuoy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useProductTour } from "@/components/providers/product-tour-provider";
import { cn } from "@/lib/utils";

type ProductTourStartButtonProps = ButtonProps & {
  label?: string;
  iconOnly?: boolean;
};

export function ProductTourStartButton({
  label = "Start Tour",
  iconOnly = false,
  className,
  variant,
  size,
  disabled,
  onClick,
  ...props
}: ProductTourStartButtonProps) {
  const { startTour, isActive } = useProductTour();

  return (
    <Button
      type="button"
      variant={variant ?? (iconOnly ? "outline" : "secondary")}
      size={size ?? (iconOnly ? "icon" : "sm")}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          startTour("manual");
        }
      }}
      disabled={isActive || disabled}
      data-tour="tour-quick-restart"
      className={cn(className)}
      {...props}
    >
      <LifeBuoy className="size-4" />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Button>
  );
}
