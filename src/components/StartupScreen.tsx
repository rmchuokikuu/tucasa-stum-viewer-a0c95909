export function StartupScreen() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#0F172A]">
      {/* Ambient glow behind logo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(96,165,250,0.6) 0%, rgba(59,130,246,0.2) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Logo */}
      <div className="relative mb-6 animate-float">
        <img
          src="/PCM-logo.png"
          alt="TUCASA Logo"
          className="w-24 h-24 object-contain drop-shadow-[0_0_30px_rgba(96,165,250,0.5)]"
        />
      </div>

      {/* TUCASA STUM Text */}
      <h1
        className="relative text-3xl font-bold tracking-[0.15em] text-white mb-8"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          textShadow: "0 0 30px rgba(96,165,250,0.4)",
        }}
      >
        TUCASA STUM
      </h1>

      {/* Spinner */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-[3px] border-white/10 border-t-[#60A5FA] animate-spin" />
        <div
          className="absolute inset-0 w-10 h-10 rounded-full border-[3px] border-transparent border-t-[#BAE6FD] animate-spin"
          style={{ animationDuration: "1.5s", animationDirection: "reverse" }}
        />
      </div>

      {/* Subtle shimmer line */}
      <div className="mt-8 w-32 h-[2px] rounded-full overflow-hidden bg-white/10">
        <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#60A5FA] to-transparent animate-shimmer-bar" />
      </div>
    </div>
  );
}
