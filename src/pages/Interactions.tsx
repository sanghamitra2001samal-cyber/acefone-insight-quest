import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Search, PhoneIncoming, PhoneOutgoing, Phone, Clock, User, FileText, Mic } from "lucide-react";
import { format } from "date-fns";

export default function Interactions() {
  const [interactions, setInteractions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: interData } = await supabase
        .from("interactions")
        .select("*, consumers(name, service_number, phone, email, address)")
        .order("started_at", { ascending: false })
        .limit(500);

      const agentIds = [...new Set((interData || []).map(i => i.agent_id))];
      const { data: profiles } = agentIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", agentIds)
        : { data: [] };

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]));
      setInteractions((interData || []).map(i => ({ ...i, agent_name: profileMap[i.agent_id] || "Unknown" })));
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = interactions.filter(i => {
    const matchSearch = (i.consumers?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.remarks || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.agent_name || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || i.disposition === typeFilter;
    return matchSearch && matchType;
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Call & Interaction Logs</h1>
        <p className="text-muted-foreground">View all call logs and interaction history</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by consumer, agent, or remarks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dispositions</SelectItem>
            {["complaint_registered", "information_provided", "billing_clarification", "escalated_to_field", "duplicate_complaint", "call_dropped", "wrong_number", "no_response"].map(d => (
              <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Consumer</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Recording Ref</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No interactions found</TableCell></TableRow>
              ) : filtered.map((i) => (
                <TableRow key={i.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(i)}>
                  <TableCell>
                    {i.direction === "inbound" ? (
                      <PhoneIncoming className="h-4 w-4 text-success" />
                    ) : (
                      <PhoneOutgoing className="h-4 w-4 text-primary" />
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{i.type}</TableCell>
                  <TableCell>
                    {i.consumers?.name || "—"}
                    {i.consumers?.service_number && (
                      <span className="ml-2 text-xs text-muted-foreground">({i.consumers.service_number})</span>
                    )}
                  </TableCell>
                  <TableCell>{i.agent_name || "—"}</TableCell>
                  <TableCell>{formatDuration(i.duration_seconds)}</TableCell>
                  <TableCell>
                    {i.disposition ? (
                      <Badge variant="secondary">{i.disposition.replace(/_/g, " ")}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{i.call_recording_ref || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{i.remarks || "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(i.started_at), "MMM dd, HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selected?.direction === "inbound" ? (
                <PhoneIncoming className="h-5 w-5 text-success" />
              ) : (
                <PhoneOutgoing className="h-5 w-5 text-primary" />
              )}
              Call Details
            </SheetTitle>
            <SheetDescription>
              {selected?.started_at && format(new Date(selected.started_at), "MMMM dd, yyyy 'at' HH:mm:ss")}
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="mt-6 space-y-5">
              {/* Consumer Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4" /> Consumer Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailItem label="Name" value={selected.consumers?.name} />
                  <DetailItem label="Service No." value={selected.consumers?.service_number} />
                  <DetailItem label="Phone" value={selected.consumers?.phone} />
                  <DetailItem label="Email" value={selected.consumers?.email} />
                </div>
                {selected.consumers?.address && (
                  <DetailItem label="Address" value={selected.consumers.address} />
                )}
              </div>

              <Separator />

              {/* Call Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Call Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailItem label="Agent" value={selected.agent_name} />
                  <DetailItem label="Direction" value={selected.direction} />
                  <DetailItem label="Type" value={selected.type} />
                  <DetailItem label="Duration" value={formatDuration(selected.duration_seconds)} />
                  <DetailItem label="Started" value={selected.started_at ? format(new Date(selected.started_at), "HH:mm:ss") : "—"} />
                  <DetailItem label="Ended" value={selected.ended_at ? format(new Date(selected.ended_at), "HH:mm:ss") : "—"} />
                </div>
              </div>

              <Separator />

              {/* Disposition & Remarks */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Disposition & Remarks
                </h4>
                <div className="text-sm">
                  <DetailItem label="Disposition" value={selected.disposition?.replace(/_/g, " ") || "—"} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Remarks / Comments</span>
                  <p className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
                    {selected.remarks || "No remarks recorded"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Recording */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Mic className="h-4 w-4" /> Recording
                </h4>
                <DetailItem label="Recording Ref" value={selected.call_recording_ref || "No recording"} />
              </div>

              {/* Ticket */}
              {selected.ticket_id && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Linked Ticket
                    </h4>
                    <DetailItem label="Ticket ID" value={selected.ticket_id.slice(0, 8)} />
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium capitalize">{value || "—"}</p>
    </div>
  );
}
