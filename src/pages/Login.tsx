import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import tsspdclLogo from "@/assets/tsspdcl-logo.png";
import loginHero from "@/assets/login-hero.png";
import { Shield, Users, Headphones } from "lucide-react";

const roles = [
{ key: "admin", label: "Admin", icon: Shield, color: "from-red-500 to-orange-500", desc: "Full system control" },
{ key: "supervisor", label: "Supervisor", icon: Users, color: "from-amber-500 to-yellow-500", desc: "Team management" },
{ key: "agent", label: "Agent", icon: Headphones, color: "from-primary to-blue-500", desc: "Customer support" }] as
const;

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("agent");
  const [bgReady, setBgReady] = useState(false);
  const [inkPhase, setInkPhase] = useState(0); // 0=nothing, 1=ink starts, 2=ink spreading, 3=image revealing, 4=fully revealed
  const [cardReady, setCardReady] = useState(false);
  const [footerReady, setFooterReady] = useState(false);
  const [brandingVisible, setBrandingVisible] = useState(false);
  const [brandingExit, setBrandingExit] = useState(false);
  const [brandingCorner, setBrandingCorner] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setInkPhase(1), 200),
      setTimeout(() => setBrandingVisible(true), 800),
      setTimeout(() => setInkPhase(2), 1500),
      setTimeout(() => setInkPhase(3), 3000),
      setTimeout(() => setBgReady(true), 3500),
      setTimeout(() => setInkPhase(4), 4500),
      setTimeout(() => setBrandingExit(true), 5800),
      setTimeout(() => setBrandingCorner(true), 6200),
      setTimeout(() => setCardReady(true), 7000),
      setTimeout(() => setFooterReady(true), 7500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await signIn(form.get("email") as string, form.get("password") as string);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/");
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await signUp(
      form.get("email") as string,
      form.get("password") as string,
      form.get("fullName") as string
    );
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! Please check your email to verify.");
    }
  };

  const loginForm = (
    <>
      {/* Role selector */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {roles.map((r) =>
        <button
          key={r.key}
          type="button"
          onClick={() => setSelectedRole(r.key)}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-300 ${
          selectedRole === r.key ?
          "border-primary bg-accent shadow-md scale-[1.02]" :
          "border-border hover:border-primary/30 hover:bg-accent/50"}`
          }>
            <div className={`p-2 rounded-lg bg-gradient-to-br ${r.color} text-white`}>
              <r.icon className="h-4 w-4" />
            </div>
            <span className={`text-xs font-semibold ${selectedRole === r.key ? "text-primary" : "text-muted-foreground"}`}>
              {r.label}
            </span>
          </button>
        )}
      </div>

      <Tabs defaultValue="signin">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <form onSubmit={handleSignIn} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input id="signin-email" name="email" type="email" required placeholder="agent@tsspdcl.gov.in" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input id="signin-password" name="password" type="password" required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : `Sign In as ${roles.find((r) => r.key === selectedRole)?.label}`}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          <form onSubmit={handleSignUp} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Full Name</Label>
              <Input id="signup-name" name="fullName" required placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" name="email" type="email" required placeholder="agent@tsspdcl.gov.in" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input id="signup-password" name="password" type="password" required minLength={8} placeholder="Min 8 characters" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </>
  );

  return (
    <div className="min-h-screen">
      {/* ===== MOBILE / TABLET LAYOUT (< lg) ===== */}
      <div className="lg:hidden min-h-screen flex flex-col">
        {/* Top hero banner */}
        <div className="relative h-52 sm:h-60 md:h-80 overflow-hidden">
          <img
            src="/assets/73cb5cd5-b632-404b-bcb3-4da34459ed7b.png"
            alt="TSSPDCL - State Level Centralized Customer Care Centre"
            className="w-full h-full object-cover object-top md:object-[center_30%]" />

          {/* Logo overlay for mobile/tablet */}
          <div className="absolute top-[5%] sm:top-[5%] md:top-[8%] left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <img
              src={tsspdclLogo}
              alt="TSSPDCL Logo"
              className="w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] md:w-[100px] md:h-[100px] rounded-full object-contain bg-white p-1" />
          </div>

          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        </div>

        {/* Login form below banner */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-background">
          <Card className="w-full max-w-md border-border shadow-lg">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <img src={tsspdclLogo} alt="TSSPDCL Logo" className="h-10 w-10 rounded-full" />
                <span className="text-2xl font-bold text-primary">TGSPDCL</span>
              </div>
              <CardTitle className="text-2xl">Welcome</CardTitle>
              <CardDescription>Select your role and sign in</CardDescription>
            </CardHeader>
            <CardContent>
              {loginForm}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== LAPTOP / DESKTOP LAYOUT (>= lg) ===== */}
      <div className="hidden lg:flex min-h-screen relative items-center justify-center p-6 overflow-hidden bg-[#0a0a0f]">
        
        {/* === INK BLOBS - staggered entrance === */}
        {[
          { x: '50%', y: '50%', size: 600, delay: 0, phase: 1 },
          { x: '20%', y: '30%', size: 500, delay: 0.3, phase: 1 },
          { x: '80%', y: '70%', size: 550, delay: 0.5, phase: 1 },
          { x: '70%', y: '20%', size: 450, delay: 0.8, phase: 2 },
          { x: '30%', y: '80%', size: 480, delay: 1, phase: 2 },
          { x: '10%', y: '50%', size: 400, delay: 1.2, phase: 2 },
          { x: '90%', y: '40%', size: 420, delay: 1.4, phase: 2 },
          { x: '50%', y: '10%', size: 500, delay: 1.6, phase: 2 },
          { x: '40%', y: '90%', size: 460, delay: 1.8, phase: 2 },
        ].map((blob, i) => (
          <div
            key={`ink-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: blob.x,
              top: blob.y,
              width: `${blob.size}px`,
              height: `${blob.size}px`,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, rgba(15,15,25,0.95) 0%, rgba(15,15,25,0.7) 40%, transparent 70%)`,
              opacity: inkPhase >= blob.phase && inkPhase < 4 ? 1 : 0,
              transition: `opacity ${inkPhase >= 4 ? '2s' : '1.5s'} ease-out`,
              animation: inkPhase >= blob.phase ? `inkSpread 3s ease-out ${blob.delay}s both` : 'none',
            }}
          />
        ))}

        {/* === INK TENDRILS - organic flowing lines === */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          {[
            "M960,540 Q1100,300 1400,200 Q1600,150 1800,300 Q1920,400 1920,540",
            "M960,540 Q800,700 500,800 Q300,850 100,750 Q0,650 0,540",
            "M960,540 Q1200,600 1500,900 Q1700,1000 1920,900",
            "M960,540 Q700,400 400,200 Q200,100 0,200",
            "M960,540 Q850,300 600,100 Q400,0 200,50",
            "M960,540 Q1100,750 1300,950 Q1500,1080 1700,1000",
          ].map((path, i) => (
            <path
              key={`tendril-${i}`}
              d={path}
              fill="none"
              stroke="rgba(20,20,35,0.8)"
              strokeWidth={inkPhase >= 1 ? "80" : "0"}
              strokeLinecap="round"
              style={{
                transition: 'stroke-width 2s ease-out, opacity 2s ease-out',
                opacity: inkPhase >= 4 ? 0 : inkPhase >= 1 ? 0.7 : 0,
                strokeDasharray: '2000',
                strokeDashoffset: inkPhase >= 1 ? '0' : '2000',
                animation: inkPhase >= 1 ? `inkDraw 2.5s ease-out ${0.2 + i * 0.3}s both` : 'none',
                filter: 'blur(20px)',
              }}
            />
          ))}
        </svg>

        {/* === BRANDING - shifts to top-left corner after loading === */}
        <div
          className="absolute z-20 flex items-center pointer-events-none"
          style={{
            top: brandingCorner ? '24px' : '50%',
            left: brandingCorner ? '32px' : '50%',
            transform: brandingCorner ? 'translate(0, 0)' : 'translate(-50%, -50%)',
            opacity: brandingVisible ? 1 : 0,
            transition: brandingCorner
              ? 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)'
              : 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
            gap: brandingCorner ? '12px' : '0',
            flexDirection: brandingCorner ? 'row' : 'column',
            alignItems: brandingCorner ? 'center' : 'center',
          }}>
          <img
            src={tsspdclLogo}
            alt="TGSPDCL Logo"
            className="rounded-full shadow-2xl"
            style={{
              width: brandingCorner ? '44px' : '96px',
              height: brandingCorner ? '44px' : '96px',
              transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
              filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))',
            }} />
          <div style={{
            transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
            marginTop: brandingCorner ? '0' : '24px',
          }}>
            <h1 style={{
              fontSize: brandingCorner ? '18px' : '36px',
              fontWeight: 700,
              color: 'white',
              letterSpacing: brandingCorner ? '0.05em' : '0.1em',
              textShadow: '0 0 30px rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.5)',
              transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
              lineHeight: 1,
            }}>TGSPDCL</h1>
            <p style={{
              fontSize: brandingCorner ? '9px' : '12px',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase' as const,
              letterSpacing: brandingCorner ? '0.15em' : '0.35em',
              marginTop: brandingCorner ? '2px' : '8px',
              transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>Customer Care Centre</p>
          </div>
          {/* Loading dots - only during center phase */}
          {!brandingCorner && (
            <div className="flex gap-1.5" style={{
              marginTop: '24px',
              opacity: brandingExit ? 0 : 1,
              transition: 'opacity 0.5s ease-out',
            }}>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/50"
                  style={{ animation: `inkDot 1.4s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Full-screen hero background - revealed through ink */}
        <img
          src="/assets/73cb5cd5-b632-404b-bcb3-4da34459ed7b.png"
          alt="TGSPDCL - State Level Centralized Customer Care Centre"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{
            filter: bgReady ? 'brightness(0.8) saturate(1.3) contrast(1.15)' : 'brightness(0) saturate(0)',
            transform: bgReady ? 'scale(1.002)' : 'scale(1.08)',
            opacity: bgReady ? 1 : 0,
            transition: 'all 3.5s cubic-bezier(0.16, 1, 0.3, 1)',
            imageRendering: '-webkit-optimize-contrast' as any,
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            willChange: 'transform, opacity, filter',
          }} />

        {/* Cinematic gradient overlays */}
        <div
          className="absolute inset-0 transition-opacity duration-[3000ms] ease-out"
          style={{ opacity: bgReady ? 1 : 0 }}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-[2500ms]"
          style={{
            opacity: bgReady ? 0.03 : 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />

        {/* Floating light orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(5)].map((_, i) =>
          <div
            key={`orb-${i}`}
            className="absolute rounded-full transition-opacity duration-[3000ms]"
            style={{
              opacity: bgReady ? 0.08 : 0,
              width: `${150 + i * 80}px`,
              height: `${150 + i * 80}px`,
              left: `${10 + i * 20}%`,
              top: `${20 + (i % 3) * 25}%`,
              background: `radial-gradient(circle, hsl(213 72% 50% / 0.3) 0%, transparent 70%)`,
              animation: `floatOrb ${8 + i * 2}s ease-in-out ${i * 1.5}s infinite`,
            }} />
          )}
        </div>

        {/* Animated particle sparkles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(35)].map((_, i) =>
          <div
            key={i}
            className="absolute rounded-full transition-opacity duration-[3000ms]"
            style={{
              opacity: bgReady ? 1 : 0,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `radial-gradient(circle, rgba(255,255,255,${0.4 + Math.random() * 0.5}) 0%, transparent 70%)`,
              animation: `sparkleFloat ${4 + Math.random() * 6}s ease-in-out ${Math.random() * 5}s infinite`
            }} />
          )}
        </div>

        {/* Sweeping light beam */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-[3000ms]"
          style={{
            opacity: bgReady ? 0.06 : 0,
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)',
            animation: 'sweepLight 10s ease-in-out 2s infinite'
          }} />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.5) 100%)'
        }} />

        {/* ---- LOGIN CARD POPUP ---- */}
        <div
          className="relative z-10 w-full max-w-md transition-all duration-700 ease-out"
          style={{
            opacity: cardReady ? 1 : 0,
            transform: cardReady ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.95)',
          }}>

          {/* Card glow halo */}
          <div
            className="absolute -inset-3 rounded-3xl blur-2xl transition-opacity duration-1000"
            style={{
              opacity: cardReady ? 0.5 : 0,
              background: 'linear-gradient(135deg, hsl(213 72% 50% / 0.25), hsl(213 72% 50% / 0.1), hsl(213 72% 50% / 0.25))',
            }} />

          <Card className="relative border-border shadow-2xl bg-card rounded-2xl overflow-hidden">
            {/* Animated top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
              <div
                className="h-full transition-all duration-1000 ease-out"
                style={{
                  width: cardReady ? '100%' : '0%',
                  marginLeft: cardReady ? '0%' : '50%',
                  background: 'linear-gradient(90deg, transparent, hsl(213 72% 50%), hsl(213 72% 60%), hsl(213 72% 50%), transparent)',
                }} />
            </div>

            <CardHeader className="text-center pb-4 pt-8">
              <div className="flex flex-col items-center gap-3 mb-3">
                {/* Logo with animated ring */}
                <div className="relative">
                  <div
                    className="absolute -inset-3 rounded-full transition-all duration-1000 delay-300"
                    style={{
                      opacity: cardReady ? 0.6 : 0,
                      background: 'conic-gradient(from 0deg, transparent, hsl(213 72% 50% / 0.3), transparent, hsl(213 72% 50% / 0.2), transparent)',
                      animation: cardReady ? 'spinSlow 8s linear infinite' : 'none',
                    }} />
                  <div className="absolute -inset-1 bg-primary/15 rounded-full blur-md animate-pulse" />
                  <img
                    src={tsspdclLogo}
                    alt="TSSPDCL Logo"
                    className="relative h-16 w-16 rounded-full shadow-lg ring-2 ring-primary/30 ring-offset-2 ring-offset-background" />
                </div>
                <div>
                  <span className="text-2xl font-bold text-primary tracking-tight">TGSPDCL</span>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">Customer Care Centre</p>
                </div>
              </div>
              <CardTitle className="text-xl font-semibold">Welcome Back</CardTitle>
              <CardDescription className="text-muted-foreground/80">Select your role and sign in to continue</CardDescription>
            </CardHeader>
            <CardContent>
              {loginForm}
            </CardContent>

            {/* Bottom accent */}
            <div className="px-6 pb-5 pt-1">
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-3" />
              <p className="text-[10px] text-center text-muted-foreground/40 tracking-wide">
                Telangana State Southern Power Distribution Company Limited
              </p>
            </div>
          </Card>
        </div>

        {/* Bottom branding bar */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 transition-all duration-700 ease-out"
          style={{
            opacity: footerReady ? 1 : 0,
            transform: footerReady ? 'translateY(0)' : 'translateY(20px)',
          }}>
          <div className="bg-gradient-to-t from-black/70 to-transparent pt-20 pb-5 px-8">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <p className="text-white/35 text-xs tracking-wide">© 2026 TGSPDCL. All rights reserved.</p>
              <p className="text-white/35 text-xs tracking-wide">State Level Centralized Customer Care Centre</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sparkleFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-25px) scale(1.5); opacity: 0.9; }
        }
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.1); }
          50% { transform: translate(-10px, -50px) scale(0.95); }
          75% { transform: translate(-25px, -20px) scale(1.05); }
        }
        @keyframes sweepLight {
          0% { transform: translateX(-120%); }
          40% { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
        @keyframes spinSlow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes inkSpread {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
        }
        @keyframes inkDraw {
          0% { stroke-dashoffset: 2000; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes inkDot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.8); }
        }
      `}</style>
    </div>);

}