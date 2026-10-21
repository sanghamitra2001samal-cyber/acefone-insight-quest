import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function SLAMonitor() {
  const [slaConfigs, setSlaConfigs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Record<string, { value: number; status: "good" | "warning" | "breach" }>>({});

  useEffect(() => {
    const fetch = async () => {
      const { data: configs } = await supabase.from("sla_config").select("*").eq("is_active", true);
      setSlaConfigs(configs || []);

      // Calculate actual metrics
      const today = new Date().toISOString().split("T")[0];
      const { data: todayInteractions } = await supabase.from("interactions").select("duration_seconds").gte("started_at", today);
      const { data: allTickets } = await supabase.from("tickets").select("status, created_at, updated_at");

      const interactions = todayInteractions || [];
      const tickets = allTickets || [];

      const durations = interactions.map(i => i.duration_seconds || 0);
      const avgHT = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

      const resolvedTickets = tickets.filter(t => t.status === "resolved" || t.status === "closed");
      const avgResolution = resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 1000, 0) / resolvedTickets.length
        : 0;

      const openTickets = tickets.filter(t => t.status !== "resolved" && t.status !== "closed").length;
      const totalTickets = tickets.length || 1;
      const fcrRate = totalTickets > 0 ? (resolvedTickets.length / totalTickets) * 100 : 0;

      const computedMetrics: Record<string, { value: number; status: "good" | "warning" | "breach" }> = {};

      (configs || []).forEach(c => {
        let value = 0;
        if (c.metric_name === "average_handling_time") value = avgHT;
        else if (c.metric_name === "ticket_resolution_time") value = avgResolution;
        else if (c.metric_name === "service_level") value = fcrRate;
        else if (c.metric_name === "abandonment_rate") value = 0;

        let status: "good" | "warning" | "breach" = "good";
        if (c.threshold_unit === "percent") {
          if (c.metric_name === "abandonment_rate") {
            status = value > c.threshold_value ? "breach" : value > c.threshold_value * 0.8 ? "warning" : "good";
          } else {
            status = value >= c.threshold_value ? "good" : value >= c.threshold_value * 0.8 ? "warning" : "breach";
          }
        } else {
          status = value <= c.threshold_value ? "good" : value <= c.threshold_value * 1.2 ? "warning" : "breach";
        }

        computedMetrics[c.metric_name] = { value, status };
      });

      setMetrics(computedMetrics);
    };
    fetch();
  }, []);

  const statusIcon = (s: "good" | "warning" | "breach") => {
    if (s === "good") return <CheckCircle className="h-5 w-5 text-success" />;
    if (s === "warning") return <Clock className="h-5 w-5 text-warning" />;
    return <AlertTriangle className="h-5 w-5 text-destructive" />;
  };

  const statusBadge = (s: "good" | "warning" | "breach") => {
    if (s === "good") return <Badge className="bg-success/20 text-success border-0">On Track</Badge>;
    if (s === "warning") return <Badge className="bg-warning/20 text-warning border-0">At Risk</Badge>;
    return <Badge className="bg-destructive/20 text-destructive border-0">Breached</Badge>;
  };

  const formatValue = (config: any, value: number) => {
    if (config.threshold_unit === "percent") return `${value.toFixed(1)}%`;
    if (config.threshold_unit === "seconds") {
      if (value > 3600) return `${(value / 3600).toFixed(1)}h`;
      if (value > 60) return `${Math.round(value / 60)}m`;
      return `${Math.round(value)}s`;
    }
    return value.toFixed(1);
  };

  const getProgressPercent = (config: any, value: number) => {
    if (config.threshold_unit === "percent") {
      return config.metric_name === "abandonment_rate"
        ? Math.max(0, 100 - (value / config.threshold_value) * 100)
        : Math.min(100, (value / config.threshold_value) * 100);
    }
    return Math.min(100, Math.max(0, 100 - ((value - config.threshold_value) / config.threshold_value) * 100));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SLA Monitor</h1>
        <p className="text-muted-foreground">Track SLA compliance and performance metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {slaConfigs.map(config => {
          const metric = metrics[config.metric_name] || { value: 0, status: "good" as const };
          const progress = getProgressPercent(config, metric.value);

          return (
            <Card key={config.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  {statusIcon(metric.status)}
                  <CardTitle className="text-base">{config.description || config.metric_name}</CardTitle>
                </div>
                {statusBadge(metric.status)}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Current: <strong>{formatValue(config, metric.value)}</strong></span>
                  <span className="text-muted-foreground">Target: {config.threshold_value}{config.threshold_unit === "percent" ? "%" : "s"}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {slaConfigs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No SLA configurations found. Ask an admin to set up SLA thresholds.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
