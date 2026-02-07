export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-14 lg:pl-48">
      {/* Extra top padding on mobile for the horizontal nav */}
      <div className="pt-10 lg:pt-0">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </main>
  );
}
