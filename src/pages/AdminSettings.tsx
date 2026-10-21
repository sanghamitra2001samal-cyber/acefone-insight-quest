import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { format } from "date-fns";

export default function AdminSettings() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [slaConfigs, setSlaConfigs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [catDialog, setCatDialog] = useState(false);
  const [queueDialog, setQueueDialog] = useState(false);

  const fetchAll = async () => {
    const [profilesRes, rolesRes, catsRes, slaRes, queuesRes, auditRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("disposition_categories").select("*").order("name"),
      supabase.from("sla_config").select("*").order("metric_name"),
      supabase.from("queues").select("*").order("name"),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setUsers(profilesRes.data || []);
    setRoles(rolesRes.data || []);
    setCategories(catsRes.data || []);
    setSlaConfigs(slaRes.data || []);
    setQueues(queuesRes.data || []);
    setAuditLogs(auditRes.data || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedRole) return;
    await supabase.from("user_roles").delete().eq("user_id", selectedUserId);
    const { error } = await supabase.from("user_roles").insert({ user_id: selectedUserId, role: selectedRole as any });
    if (error) { toast.error(error.message); return; }
    toast.success("Role assigned");
    setAssignDialog(false);
    fetchAll();
  };

  const handleRemoveRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role removed");
    fetchAll();
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from("disposition_categories").insert({
      name: form.get("name") as string,
      description: (form.get("description") as string) || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Category added");
    setCatDialog(false);
    fetchAll();
  };

  const handleUpdateSLA = async (id: string, value: number) => {
    const { error } = await supabase.from("sla_config").update({ threshold_value: value }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("SLA threshold updated");
    fetchAll();
  };

  const handleAddQueue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from("queues").insert({
      name: form.get("name") as string,
      description: (form.get("description") as string) || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Queue added");
    setQueueDialog(false);
    fetchAll();
  };

  const filteredAudit = auditLogs.filter(l =>
    l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
    (l.table_name || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
    (l.ip_address || "").includes(auditSearch)
  );

  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    const u = users.find(u => u.user_id === userId);
    return u?.full_name || userId.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-muted-foreground">Manage users, roles, queues, and system configuration</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="categories">Disposition Categories</TabsTrigger>
          <TabsTrigger value="sla">SLA Configuration</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Assign Role</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign Role to User</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                      <SelectContent>
                        {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.user_id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAssignRole} className="w-full">Assign Role</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => {
                    const role = roles.find(r => r.user_id === u.user_id);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "Unnamed"}</TableCell>
                        <TableCell>{u.department || "—"}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{u.status}</Badge></TableCell>
                        <TableCell>
                          {role ? <Badge className="capitalize">{role.role}</Badge> : <span className="text-muted-foreground">No role</span>}
                        </TableCell>
                        <TableCell>
                          {role && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRole(role.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={catDialog} onOpenChange={setCatDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Category</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Disposition Category</DialogTitle></DialogHeader>
                <form onSubmit={handleAddCategory} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input name="description" />
                  </div>
                  <Button type="submit" className="w-full">Add Category</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.description || "—"}</TableCell>
                      <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slaConfigs.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.metric_name.replace(/_/g, " ")}</TableCell>
                      <TableCell>{s.description || "—"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          defaultValue={s.threshold_value}
                          className="w-24"
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value);
                            if (v !== s.threshold_value) handleUpdateSLA(s.id, v);
                          }}
                        />
                      </TableCell>
                      <TableCell>{s.threshold_unit}</TableCell>
                      <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={queueDialog} onOpenChange={setQueueDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Queue</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Queue</DialogTitle></DialogHeader>
                <form onSubmit={handleAddQueue} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input name="description" />
                  </div>
                  <Button type="submit" className="w-full">Add Queue</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.map(q => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.name}</TableCell>
                      <TableCell>{q.description || "—"}</TableCell>
                      <TableCell><Badge variant={q.is_active ? "default" : "secondary"}>{q.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search audit logs..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} className="pl-10" />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAudit.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No audit logs found</TableCell></TableRow>
                  ) : filteredAudit.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{format(new Date(l.created_at), "MMM dd, HH:mm:ss")}</TableCell>
                      <TableCell>{getUserName(l.user_id)}</TableCell>
                      <TableCell><Badge variant="secondary">{l.action}</Badge></TableCell>
                      <TableCell>{l.table_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.record_id?.slice(0, 8) || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.ip_address || "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs">{l.details ? JSON.stringify(l.details) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
