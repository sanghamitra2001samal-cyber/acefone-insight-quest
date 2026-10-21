import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

const statusColors: Record<string, string> = {
  ready: "bg-success/20 text-success",
  busy: "bg-destructive/20 text-destructive",
  wrap_up: "bg-warning/20 text-warning",
  break: "bg-primary/20 text-primary",
  offline: "bg-muted text-muted-foreground",
};

const statusDot: Record<string, string> = {
  ready: "bg-success",
  busy: "bg-destructive",
  wrap_up: "bg-warning",
  break: "bg-primary",
  offline: "bg-muted-foreground",
};

export default function AgentMonitor() {
  const [agents, setAgents] = useState<any[]>([]);

  const fetchAgents = async () => {
    // Get all users with agent/supervisor roles and their profiles
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    if (!roles || roles.length === 0) { setAgents([]); return; }

    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);

    const agentList = (profiles || []).map(p => {
      const role = roles.find(r => r.user_id === p.user_id);
      return { ...p, role: role?.role || "agent" };
    });
    setAgents(agentList);
  };

  useEffect(() => {
    fetchAgents();

    // Real-time updates for profile status changes
    const channel = supabase
      .channel("agent-status")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchAgents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const grouped = {
    ready: agents.filter(a => a.status === "ready"),
    busy: agents.filter(a => a.status === "busy"),
    wrap_up: agents.filter(a => a.status === "wrap_up"),
    break: agents.filter(a => a.status === "break"),
    offline: agents.filter(a => a.status === "offline"),
  };

  const total = agents.length;
  const online = agents.filter(a => a.status !== "offline").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agent Monitor</h1>
        <p className="text-muted-foreground">Live view of agent statuses and availability</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(grouped).map(([status, list]) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
                {status.replace("_", " ")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{list.length}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Agents ({online}/{total} online)</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {agents.map(a => {
                const initials = a.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?";
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${statusDot[a.status]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.role} · {a.department || "No dept"}</p>
                    </div>
                    <Badge className={`${statusColors[a.status]} border-0 text-xs`}>
                      {a.status.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No agents found. Assign roles to users first.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
