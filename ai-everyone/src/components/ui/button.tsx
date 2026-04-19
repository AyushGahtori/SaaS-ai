import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "interactive-lift inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-sm font-semibold tracking-tight transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-200 disabled:pointer-events-none disabled:opacity-50 data-[loading=true]:cursor-wait data-[loading=true]:opacity-80 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:border-primary/70 focus-visible:ring-[3px] focus-visible:ring-ring/45 active:scale-[0.98] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_10px_24px_rgb(107_76_255/34%)] hover:bg-primary/95 hover:shadow-[0_14px_28px_rgb(107_76_255/40%)]",
        destructive:
          "bg-destructive text-white shadow-[0_8px_22px_rgb(239_68_68/28%)] hover:bg-destructive/95 hover:shadow-[0_12px_24px_rgb(239_68_68/34%)] focus-visible:ring-destructive/30 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border/90 bg-background/70 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/4%)] hover:border-primary/40 hover:bg-accent/65 hover:text-accent-foreground hover:shadow-[0_10px_24px_rgb(115_72_238/20%)] dark:bg-input/25 dark:hover:bg-input/45",
        secondary:
          "bg-secondary/90 text-secondary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/4%)] hover:bg-secondary hover:text-foreground",
        ghost:
          "text-muted-foreground hover:bg-accent/65 hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "rounded-none border-none text-primary underline-offset-4 shadow-none hover:text-primary/90 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
