const bgStyle = {
  background:
    "radial-gradient(1200px 700px at 10% -10%, rgba(96,165,250,0.5), transparent 60%)," +
    "radial-gradient(900px 600px at 100% 0%, rgba(186,230,253,0.35), transparent 60%)," +
    "radial-gradient(900px 700px at 50% 120%, rgba(59,130,246,0.45), transparent 60%)," +
    "linear-gradient(180deg, #173A82 0%, #1E4AA0 50%, #173A82 100%)",
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-surface relative min-h-screen flex w-full flex-col overflow-hidden" style={bgStyle}>
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(96,165,250,0.6) 0%, rgba(59,130,246,0.2) 40%, transparent 70%)",
            filter: "blur(70px)",
          }}
        />
      </div>
      <main className="relative z-10 flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
