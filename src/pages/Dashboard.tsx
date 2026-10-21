import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Ticket, Users, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

const PIE_COLORS = ["hsl(213,72%,37%)", "hsl(38,92%,50%)", "hsl(142,71%,38%)", "hsl(0,72%,51%)", "hsl(215,14%,46%)"];

function QuickDial() {
  const [dialSearch, setDialSearch] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; phone: string; service_number: string }[]>([]);

  useEffect(() => {
    if (dialSearch.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("consumers")
        .select("id, name, phone, service_number")
        .or(`name.ilike.%${dialSearch}%,service_number.ilike.%${dialSearch}%,phone.ilike.%${dialSearch}%`)
        .limit(8);
      setResults((data || []).filter(c => c.phone));
    }, 300);
    return () => clearTimeout(timeout);
  }, [dialSearch]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search consumer to call..." value={dialSearch} onChange={e => setDialSearch(e.target.value)} className="pl-10" />
      </div>
      {results.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-auto">
          {results.map(c => (
            <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.service_number}</p>
              </div>
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                <Phone className="h-3.5 w-3.5" />
                {c.phone}
              </a>
            </div>
          ))}
        </div>
      ) : dialSearch.length >= 2 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No consumers with phone found</p>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Type to search consumers</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState({ calls: 0, openTickets: 0, consumers: 0, avgHandleTime: 0 });
  const [ticketsByStatus, setTicketsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [callVolume, setCallVolume] = useState<{ date: string; calls: number }[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [callsRes, ticketsRes, consumersRes, interactionsRes, recentRes] = await Promise.all([
        supabase.from("interactions").select("id", { count: "exact", head: true }).gte("started_at", today),
        supabase.from("tickets").select("status"),
        supabase.from("consumers").select("id", { count: "exact", head: true }),
        supabase.from("interactions").select("duration_seconds").gte("started_at", today),
        supabase.from("tickets").select("ticket_number, status, created_at, remarks").order("created_at", { ascending: false }).limit(5),
      ]);

      const openCount = ticketsRes.data?.filter(t => t.status === "open" || t.status === "in_progress" || t.status === "escalated").length || 0;
      const durations = interactionsRes.data?.map(i => i.duration_seconds || 0) || [];
      const avg = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

      setStats({
        calls: callsRes.count || 0,
        openTickets: openCount,
        consumers: consumersRes.count || 0,
        avgHandleTime: avg,
      });

      // Tickets by status for pie chart
      const statusCounts: Record<string, number> = {};
      ticketsRes.data?.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
      setTicketsByStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

      // Call volume last 7 days
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        return { date: format(d, "MMM dd"), fullDate: format(d, "yyyy-MM-dd"), calls: 0 };
      });

      const { data: weekCalls } = await supabase
        .from("interactions")
        .select("started_at")
        .gte("started_at", format(subDays(new Date(), 6), "yyyy-MM-dd"));

      weekCalls?.forEach(c => {
        const day = format(new Date(c.started_at), "yyyy-MM-dd");
        const entry = last7.find(d => d.fullDate === day);
        if (entry) entry.calls++;
      });
      setCallVolume(last7.map(({ date, calls }) => ({ date, calls })));

      setRecentTickets(recentRes.data || []);
    };

    fetchData();
  }, []);

  const formatTime = (seconds: number) => {
    if (seconds === 0) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const statCards = [
    { title: "Calls Today", value: stats.calls.toString(), icon: Phone, color: "text-primary" },
    { title: "Open Tickets", value: stats.openTickets.toString(), icon: Ticket, color: "text-warning" },
    { title: "Total Consumers", value: stats.consumers.toString(), icon: Users, color: "text-success" },
    { title: "Avg Handle Time", value: formatTime(stats.avgHandleTime), icon: Clock, color: "text-destructive" },
  ];

  const statusColors: Record<string, string> = {
    open: "bg-warning/20 text-warning",
    in_progress: "bg-primary/20 text-primary",
    escalated: "bg-destructive/20 text-destructive",
    resolved: "bg-success/20 text-success",
    closed: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of call center operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Call Volume (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={callVolume}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip />
                <Bar dataKey="calls" fill="hsl(213,72%,37%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {ticketsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ticketsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {ticketsByStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No tickets yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTickets.length > 0 ? (
              <div className="space-y-3">
                {recentTickets.map((t) => (
                  <div key={t.ticket_number} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-mono text-sm font-medium">{t.ticket_number}</span>
                      <p className="text-sm text-muted-foreground truncate max-w-xs">{t.remarks || "No remarks"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[t.status] || ""}`}>
                        {t.status.replace("_", " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">{format(new Date(t.created_at), "MMM dd, HH:mm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No tickets yet</p>
            )}
          </CardContent>
        </Card>

        {role !== "agent" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Quick Dial</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickDial />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
