export function StickyBottomBar({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay?: string;
}) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md animate-slide-up"
      style={delay ? { animationDelay: delay } : undefined}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
