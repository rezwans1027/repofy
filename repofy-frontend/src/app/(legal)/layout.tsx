import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { QueryProvider } from "@/components/providers/query-provider";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <Navbar />
      <main
        id="main-content"
        className="mx-auto max-w-3xl px-4 pt-14 sm:px-6 lg:px-8"
      >
        <div className="py-12 sm:py-16">{children}</div>
      </main>
      <Footer withSidebar={false} />
    </QueryProvider>
  );
}
