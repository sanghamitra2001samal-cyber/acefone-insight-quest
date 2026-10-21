import tsspdclLogo from "@/assets/tsspdcl-logo.png";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Animated hexagonal grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      {/* Orbiting particles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[300px] h-[300px] relative animate-[spin_8s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary/40 blur-[1px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary/30 blur-[1px]" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary/20" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[200px] h-[200px] relative animate-[spin_5s_linear_reverse_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary/50" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary/30" />
        </div>
      </div>

      {/* Central element */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative">
          {/* Multi-layer glow */}
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl scale-[2.5] animate-[pulse_3s_ease-in-out_infinite]" />
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150 animate-[pulse_2s_ease-in-out_0.5s_infinite]" />

          {/* Outer segmented ring */}
          <svg className="absolute -inset-6 w-[calc(100%+48px)] h-[calc(100%+48px)] animate-[spin_4s_linear_infinite]" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="56" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="20 15" strokeLinecap="round" opacity="0.3" />
          </svg>

          {/* Inner arc ring */}
          <svg className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] animate-[spin_2.5s_linear_reverse_infinite]" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="56" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="40 80" strokeLinecap="round" opacity="0.5" />
          </svg>

          {/* Logo */}
          <img
            src={tsspdclLogo}
            alt="TSSPDCL Logo"
            className="w-28 h-28 rounded-full relative z-10 animate-[scaleIn_0.8s_ease-out_forwards] drop-shadow-2xl"
          />
        </div>

        {/* Text */}
        <div className="text-center animate-[fadeUp_1s_ease-out_0.3s_both]">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">TSSPDCL</h1>
          <p className="text-sm text-muted-foreground mt-1">Customer Care CRM</p>
        </div>

        {/* DNA helix loading indicator */}
        <div className="flex items-center gap-1 animate-[fadeUp_1s_ease-out_0.6s_both]">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              style={{
                animation: `dnaWave 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes dnaWave {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-12px) scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
