import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-ring/45 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/90 text-primary-foreground shadow-[0_6px_16px_rgb(111_76_255/28%)] [a&]:hover:bg-primary",
        secondary:
          "border-border/70 bg-secondary/80 text-secondary-foreground [a&]:hover:border-primary/35 [a&]:hover:text-foreground",
        destructive:
          "border-transparent bg-destructive/90 text-white [a&]:hover:bg-destructive focus-visible:ring-destructive/30 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border/75 bg-background/35 text-foreground [a&]:hover:border-primary/35 [a&]:hover:bg-accent/65 [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
