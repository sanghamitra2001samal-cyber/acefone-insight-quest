import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { format, subDays } from "date-fns";
import { Download } from "lucide-react";

const COLORS = ["hsl(213,72%,37%)", "hsl(38,92%,50%)", "hsl(142,71%,38%)", "hsl(0,72%,51%)", "hsl(215,14%,46%)", "hsl(280,60%,50%)", "hsl(170,60%,40%)", "hsl(30,80%,50%)"];

function exportCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(","), ...data.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [range, setRange] = useState("7");
  const [callVolume, setCallVolume] = useState<any[]>([]);
  const [dispositionBreakdown, setDispositionBreakdown] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<any[]>([]);
  const [escalationData, setEscalationData] = useState<any[]>([]);
  const [peakLoadData, setPeakLoadData] = useState<any[]>([]);

  useEffect(() => {
    const days = parseInt(range);
    const startDate = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

    const fetchAll = async () => {
      const [interRes, ticketsRes, categoriesRes] = await Promise.all([
        supabase.from("interactions").select("started_at, agent_id, disposition, duration_seconds").gte("started_at", startDate),
        supabase.from("tickets").select("category_id, disposition, status, assigned_department, created_at, disposition_categories(name)").gte("created_at", startDate),
        supabase.from("disposition_categories").select("id, name"),
      ]);

      const interactions = interRes.data || [];
      const tickets = ticketsRes.data || [];

      // Call volume line chart
      const volumeMap: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const d = format(subDays(new Date(), days - 1 - i), "MMM dd");
        volumeMap[d] = 0;
      }
      interactions.forEach(i => {
        const d = format(new Date(i.started_at), "MMM dd");
        if (d in volumeMap) volumeMap[d]++;
      });
      setCallVolume(Object.entries(volumeMap).map(([date, calls]) => ({ date, calls })));

      // Disposition breakdown pie
      const dispMap: Record<string, number> = {};
      interactions.forEach(i => {
        const d = i.disposition || "none";
        dispMap[d] = (dispMap[d] || 0) + 1;
      });
      setDispositionBreakdown(Object.entries(dispMap).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })));

      // Category breakdown
      const catMap: Record<string, number> = {};
      tickets.forEach(t => {
        const name = (t.disposition_categories as any)?.name || "Uncategorized";
        catMap[name] = (catMap[name] || 0) + 1;
      });
      setCategoryBreakdown(Object.entries(catMap).map(([name, value]) => ({ name, value })));

      // Agent performance
      const agentIds = [...new Set(interactions.map(i => i.agent_id))];
      const { data: profiles } = agentIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", agentIds)
        : { data: [] as any[] };
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]));

      const agentMap: Record<string, { name: string; calls: number; totalDuration: number }> = {};
      interactions.forEach(i => {
        const name = profileMap[i.agent_id] || "Unknown";
        if (!agentMap[i.agent_id]) agentMap[i.agent_id] = { name, calls: 0, totalDuration: 0 };
        agentMap[i.agent_id].calls++;
        agentMap[i.agent_id].totalDuration += i.duration_seconds || 0;
      });
      setAgentPerformance(Object.values(agentMap).sort((a, b) => b.calls - a.calls));

      // Escalation matrix
      const escMap: Record<string, number> = {};
      tickets.filter(t => t.status === "escalated").forEach(t => {
        const dept = t.assigned_department || "Unassigned";
        escMap[dept] = (escMap[dept] || 0) + 1;
      });
      setEscalationData(Object.entries(escMap).map(([name, value]) => ({ name, value })));

      // Peak load analysis (hourly)
      const hourMap: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourMap[h] = 0;
      interactions.forEach(i => {
        const hour = new Date(i.started_at).getHours();
        hourMap[hour]++;
      });
      setPeakLoadData(Object.entries(hourMap).map(([hour, calls]) => ({
        hour: `${hour.padStart(2, "0")}:00`,
        calls,
      })));
    };

    fetchAll();
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">Generate and view operational reports</p>
        </div>
        <div className="flex gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportCSV(callVolume, "call_volume_report")}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Daily Call Volume</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV(callVolume, "daily_call_volume")}>
              <Download className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={callVolume}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="calls" stroke="hsl(213,72%,37%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Disposition Summary</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV(dispositionBreakdown, "disposition_summary")}>
              <Download className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="h-64">
            {dispositionBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dispositionBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {dispositionBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-muted-foreground">No data</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Complaint Category Report</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV(categoryBreakdown, "complaint_categories")}>
              <Download className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(213,72%,37%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Agent Performance</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV(agentPerformance.map(a => ({ name: a.name, calls: a.calls, avg_duration_min: a.calls > 0 ? Math.round(a.totalDuration / a.calls / 60) : 0 })), "agent_performance")}>
              <Download className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {agentPerformance.length > 0 ? (
              <div className="space-y-3">
                {agentPerformance.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-sm text-muted-foreground">{a.calls} calls · Avg {a.calls > 0 ? Math.round(a.totalDuration / a.calls / 60) : 0}m/call</p>
                    </div>
                    <span className="text-2xl font-bold text-primary">{a.calls}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">No data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Escalation Matrix</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV(escalationData, "escalation_matrix")}>
              <Download className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="h-64">
            {escalationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={escalationData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-muted-foreground">No escalations</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Peak Load Analysis (Hourly)</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV(peakLoadData, "peak_load_analysis")}>
              <Download className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakLoadData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip />
                <Bar dataKey="calls" fill="hsl(142,71%,38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
