import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Search, Eye } from "lucide-react";
import { format } from "date-fns";

const STATUSES = ["open", "in_progress", "escalated", "resolved", "closed"] as const;
const DISPOSITIONS = [
  "complaint_registered", "information_provided", "billing_clarification",
  "escalated_to_field", "duplicate_complaint", "call_dropped", "wrong_number", "no_response",
] as const;
const DEPARTMENTS = ["Billing", "Technical", "Metering", "New Connections", "Disconnections", "General"];

const statusColors: Record<string, string> = {
  open: "bg-warning/20 text-warning",
  in_progress: "bg-primary/20 text-primary",
  escalated: "bg-destructive/20 text-destructive",
  resolved: "bg-success/20 text-success",
  closed: "bg-muted text-muted-foreground",
};

export default function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [consumers, setConsumers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<any>(null);
  const [detailUpdates, setDetailUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("tickets")
      .select("*, consumers(name, service_number), disposition_categories(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
    supabase.from("consumers").select("id, name, service_number").then(({ data }) => setConsumers(data || []));
    supabase.from("disposition_categories").select("id, name").eq("is_active", true).then(({ data }) => setCategories(data || []));
  }, []);

  const filtered = tickets.filter(t => {
    const matchSearch = t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      (t.consumers?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const remarks = (form.get("remarks") as string || "").trim();
    if (!remarks) { toast.error("Remarks are mandatory"); return; }

    const { error } = await supabase.from("tickets").insert({
      ticket_number: "TEMP",
      consumer_id: form.get("consumer_id") as string || null,
      category_id: form.get("category_id") as string || null,
      disposition: (form.get("disposition") as any) || null,
      remarks,
      priority: form.get("priority") as string || "medium",
      agent_id: user?.id,
      assigned_department: form.get("assigned_department") as string || null,
      call_recording_ref: form.get("call_recording_ref") as string || null,
      sla_deadline: form.get("sla_deadline") as string || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket created");
    setDialogOpen(false);
    fetchTickets();
  };

  const handleStatusChange = async (ticketId: string, oldStatus: string, newStatus: string) => {
    const { error } = await supabase.from("tickets").update({ status: newStatus as any }).eq("id", ticketId);
    if (error) { toast.error(error.message); return; }
    if (user) {
      await supabase.from("ticket_updates").insert({
        ticket_id: ticketId,
        user_id: user.id,
        old_status: oldStatus as any,
        new_status: newStatus as any,
        comment: `Status changed from ${oldStatus} to ${newStatus}`,
      });
    }
    toast.success("Status updated");
    fetchTickets();
  };

  const openDetail = async (ticket: any) => {
    setDetailTicket(ticket);
    const { data } = await supabase.from("ticket_updates").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
    setDetailUpdates(data || []);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ticket Management</h1>
          <p className="text-muted-foreground">Track and manage complaints and service tickets</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Ticket</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Ticket</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consumer</Label>
                  <Select name="consumer_id">
                    <SelectTrigger><SelectValue placeholder="Select consumer" /></SelectTrigger>
                    <SelectContent>
                      {consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.service_number})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select name="category_id">
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Disposition</Label>
                  <Select name="disposition">
                    <SelectTrigger><SelectValue placeholder="Select disposition" /></SelectTrigger>
                    <SelectContent>
                      {DISPOSITIONS.map(d => <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Department</Label>
                  <Select name="assigned_department">
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>SLA Deadline</Label>
                  <Input name="sla_deadline" type="datetime-local" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Call Recording Ref</Label>
                <Input name="call_recording_ref" placeholder="Recording file ID or reference" />
              </div>
              <div className="space-y-2">
                <Label>Remarks * (mandatory)</Label>
                <Textarea name="remarks" required placeholder="Describe the issue — system will not allow closure without remarks" />
              </div>
              <Button type="submit" className="w-full">Create Ticket</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Consumer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>SLA Deadline</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No tickets found</TableCell></TableRow>
              ) : filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm">{t.ticket_number}</TableCell>
                  <TableCell>{t.consumers?.name || "—"}</TableCell>
                  <TableCell>{t.disposition_categories?.name || "—"}</TableCell>
                  <TableCell>{t.assigned_department || "—"}</TableCell>
                  <TableCell>
                    <Select value={t.status} onValueChange={(v) => handleStatusChange(t.id, t.status, v)}>
                      <SelectTrigger className="h-7 w-32">
                        <Badge className={`${statusColors[t.status]} border-0`}>{t.status.replace("_", " ")}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="capitalize">{t.priority}</TableCell>
                  <TableCell className="text-sm">{t.sla_deadline ? format(new Date(t.sla_deadline), "MMM dd, HH:mm") : "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(t.created_at), "MMM dd, HH:mm")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openDetail(t)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!detailTicket} onOpenChange={(o) => { if (!o) setDetailTicket(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ticket Detail: {detailTicket?.ticket_number}</DialogTitle></DialogHeader>
          {detailTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Consumer:</span> {detailTicket.consumers?.name || "—"}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[detailTicket.status]}>{detailTicket.status}</Badge></div>
                <div><span className="text-muted-foreground">Priority:</span> {detailTicket.priority}</div>
                <div><span className="text-muted-foreground">Category:</span> {detailTicket.disposition_categories?.name || "—"}</div>
                <div><span className="text-muted-foreground">Disposition:</span> {detailTicket.disposition?.replace(/_/g, " ") || "—"}</div>
                <div><span className="text-muted-foreground">Department:</span> {detailTicket.assigned_department || "—"}</div>
                <div><span className="text-muted-foreground">SLA Deadline:</span> {detailTicket.sla_deadline ? format(new Date(detailTicket.sla_deadline), "PPp") : "—"}</div>
                <div><span className="text-muted-foreground">Recording Ref:</span> {detailTicket.call_recording_ref || "—"}</div>
                <div><span className="text-muted-foreground">Created:</span> {format(new Date(detailTicket.created_at), "PPp")}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Remarks:</span>
                <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{detailTicket.remarks || "No remarks"}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Update History (Audit Trail)</span>
                {detailUpdates.length > 0 ? (
                  <div className="mt-2 space-y-2 max-h-48 overflow-auto">
                    {detailUpdates.map(u => (
                      <div key={u.id} className="text-sm p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">{format(new Date(u.created_at), "PPp")}</span>
                        <p>{u.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">No updates yet</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
