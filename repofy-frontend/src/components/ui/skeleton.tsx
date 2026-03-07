import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-accent",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
