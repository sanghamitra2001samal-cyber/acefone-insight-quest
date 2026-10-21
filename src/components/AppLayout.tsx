import { ReactNode, useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Softphone } from "@/components/Softphone";
import { AgentPanel } from "@/components/AgentPanel";
import { useAuth } from "@/hooks/useAuth";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  useAutoLogout();
  const [breaches, setBreaches] = useState<{ metric: string; value: number; threshold: number }[]>([]);

  useEffect(() => {
    // Skip SLA checks for agents (they get full-screen view)
    if (role === "agent") return;
    const checkSLA = async () => {
      const { data: configs } = await supabase.from("sla_config").select("*").eq("is_active", true);
      if (!configs || configs.length === 0) return;

      const today = new Date().toISOString().split("T")[0];
      const [interRes, ticketRes] = await Promise.all([
        supabase.from("interactions").select("duration_seconds").gte("started_at", today),
        supabase.from("tickets").select("status, created_at, updated_at"),
      ]);

      const interactions = interRes.data || [];
      const tickets = ticketRes.data || [];
      const durations = interactions.map(i => i.duration_seconds || 0);
      const avgHT = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      const resolved = tickets.filter(t => t.status === "resolved" || t.status === "closed");
      const avgRes = resolved.length > 0
        ? resolved.reduce((s, t) => s + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 1000, 0) / resolved.length
        : 0;

      const alerts: typeof breaches = [];
      configs.forEach(c => {
        let value = 0;
        if (c.metric_name === "average_handling_time") value = avgHT;
        else if (c.metric_name === "ticket_resolution_time") value = avgRes;

        if (c.threshold_unit === "seconds" && value > c.threshold_value) {
          alerts.push({ metric: c.description || c.metric_name, value, threshold: c.threshold_value });
        }
      });
      setBreaches(alerts);
    };
    checkSLA();
    const interval = setInterval(checkSLA, 60000);
    return () => clearInterval(interval);
  }, [role]);

  // Agent role: full-screen inbound console, no sidebar/header
  if (role === "agent") {
    return <AgentPanel fullScreen />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card">
            <SidebarTrigger />
            <div className="flex-1" />
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 rounded-md hover:bg-muted transition-colors">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {breaches.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                      {breaches.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <p className="text-sm font-medium mb-2">SLA Alerts</p>
                {breaches.length > 0 ? (
                  <div className="space-y-2">
                    {breaches.map((b, i) => (
                      <div key={i} className="text-sm p-2 rounded bg-destructive/10 text-destructive">
                        <strong>{b.metric}</strong> breached — current: {Math.round(b.value)}s, threshold: {b.threshold}s
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No SLA breaches detected.</p>
                )}
              </PopoverContent>
            </Popover>
            {role && (
              <Badge variant="secondary" className="capitalize">
                {role}
              </Badge>
            )}
          </header>
          {/* Agent panel removed - agents get full-screen view */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
        <Softphone />
      </div>
    </SidebarProvider>
  );
}
