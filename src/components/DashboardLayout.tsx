export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex w-full flex-col">
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
