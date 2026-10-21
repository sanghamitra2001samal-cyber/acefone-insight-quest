import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, Edit2, Eye, Phone } from "lucide-react";
import { format } from "date-fns";

type Consumer = {
  id: string;
  name: string;
  service_number: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  billing_status: string | null;
};

export default function Consumers() {
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Consumer | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyConsumer, setHistoryConsumer] = useState<Consumer | null>(null);
  const [history, setHistory] = useState<{ tickets: any[]; interactions: any[] }>({ tickets: [], interactions: [] });

  const fetchConsumers = async () => {
    const { data, error } = await supabase.from("consumers").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    else setConsumers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchConsumers(); }, []);

  const filtered = consumers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.service_number.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      service_number: form.get("service_number") as string,
      phone: (form.get("phone") as string) || null,
      email: (form.get("email") as string) || null,
      address: (form.get("address") as string) || null,
      billing_status: (form.get("billing_status") as string) || "active",
    };

    if (editing) {
      const { error } = await supabase.from("consumers").update(data).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Consumer updated");
    } else {
      const { error } = await supabase.from("consumers").insert(data);
      if (error) { toast.error(error.message); return; }
      toast.success("Consumer added");
    }
    setDialogOpen(false);
    setEditing(null);
    fetchConsumers();
  };

  const openEdit = (c: Consumer) => { setEditing(c); setDialogOpen(true); };
  const openAdd = () => { setEditing(null); setDialogOpen(true); };

  const openHistory = async (c: Consumer) => {
    setHistoryConsumer(c);
    const [ticketsRes, interRes] = await Promise.all([
      supabase.from("tickets").select("ticket_number, status, created_at, remarks, disposition").eq("consumer_id", c.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("interactions").select("started_at, disposition, duration_seconds, remarks, direction").eq("consumer_id", c.id).order("started_at", { ascending: false }).limit(20),
    ]);
    setHistory({ tickets: ticketsRes.data || [], interactions: interRes.data || [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consumer Management</h1>
          <p className="text-muted-foreground">Search, view, and manage consumer records</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Consumer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Consumer" : "Add Consumer"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" required defaultValue={editing?.name || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service_number">Service Number *</Label>
                  <Input id="service_number" name="service_number" required defaultValue={editing?.service_number || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={editing?.phone || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={editing?.email || ""} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" defaultValue={editing?.address || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_status">Billing Status</Label>
                  <Input id="billing_status" name="billing_status" defaultValue={editing?.billing_status || "active"} />
                </div>
              </div>
              <Button type="submit" className="w-full">{editing ? "Update" : "Add"} Consumer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, service number, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Service Number</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No consumers found</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-sm">{c.service_number}</TableCell>
                  <TableCell>
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{c.address || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.billing_status === "active" ? "default" : "destructive"}>
                      {c.billing_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openHistory(c)} title="View history">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Consumer Interaction History Dialog */}
      <Dialog open={!!historyConsumer} onOpenChange={(o) => { if (!o) setHistoryConsumer(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>History: {historyConsumer?.name} ({historyConsumer?.service_number})</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Tickets ({history.tickets.length})</h3>
              {history.tickets.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-auto">
                  {history.tickets.map((t, i) => (
                    <div key={i} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                      <span className="font-mono">{t.ticket_number}</span>
                      <span className="capitalize">{t.status.replace("_", " ")}</span>
                      <span className="text-muted-foreground">{format(new Date(t.created_at), "MMM dd")}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No tickets</p>}
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Interactions ({history.interactions.length})</h3>
              {history.interactions.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-auto">
                  {history.interactions.map((inter, i) => (
                    <div key={i} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                      <span className="capitalize">{inter.direction} {inter.disposition?.replace(/_/g, " ") || ""}</span>
                      <span>{inter.duration_seconds ? `${Math.round(inter.duration_seconds / 60)}m` : "—"}</span>
                      <span className="text-muted-foreground">{format(new Date(inter.started_at), "MMM dd")}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No interactions</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
