import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashboardShell, StatusBadge } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Send, Package as PackageIcon, CheckCircle2, Clock, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — ParcelTrack" }] }),
  component: AdminPage,
});

type Parcel = {
  id: string;
  tracking_number: string;
  description: string | null;
  receiver_id: string;
  status: "dispatched" | "delivered";
  created_at: string;
  delivered_at: string | null;
};

type Receiver = { id: string; display_name: string };

function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState<string>("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) navigate({ to: "/login" });
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!user || role !== "admin") return;

    const load = async () => {
      const { data: p } = await supabase
        .from("parcels")
        .select("*")
        .order("created_at", { ascending: false });
      setParcels((p ?? []) as Parcel[]);

      const { data: rls } = await supabase.from("user_roles").select("user_id").eq("role", "receiver");
      const ids = (rls ?? []).map((r) => r.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
        setReceivers((profs ?? []) as Receiver[]);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => (map[p.id] = p.display_name));
        setNamesById(map);
        if (!selectedReceiver && profs && profs.length) setSelectedReceiver(profs[0].id);
      }
    };
    load();

    const channel = supabase
      .channel("admin-parcels")
      .on("postgres_changes", { event: "*", schema: "public", table: "parcels" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setParcels((prev) => [payload.new as Parcel, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setParcels((prev) => prev.map((p) => (p.id === (payload.new as Parcel).id ? (payload.new as Parcel) : p)));
          if ((payload.new as Parcel).status === "delivered") {
            toast.success(`Parcel ${(payload.new as Parcel).tracking_number} delivered!`);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const sendParcel = async () => {
    if (!user || !selectedReceiver) return toast.error("Select a receiver");
    setSending(true);
    const { error } = await supabase.from("parcels").insert({
      sender_id: user.id,
      receiver_id: selectedReceiver,
      description: description || null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Parcel dispatched!");
    setOpen(false);
    setDescription("");
  };

  const stats = {
    total: parcels.length,
    dispatched: parcels.filter((p) => p.status === "dispatched").length,
    delivered: parcels.filter((p) => p.status === "delivered").length,
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <DashboardShell title="Sender Dashboard" subtitle="Dispatch and track parcels in real time">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={PackageIcon} label="Total parcels" value={stats.total} />
        <StatCard icon={Clock} label="In transit" value={stats.dispatched} accent="warning" />
        <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} accent="success" />
      </div>

      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">All parcels</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={parcels.length === 0}>
            <Download className="size-4 mr-2" /> Download Excel
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Send className="size-4 mr-2" /> Send Parcel</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Dispatch a new parcel</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Receiver</Label>
                <Select value={selectedReceiver} onValueChange={setSelectedReceiver}>
                  <SelectTrigger><SelectValue placeholder="Select receiver" /></SelectTrigger>
                  <SelectContent>
                    {receivers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {receivers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No receivers exist yet. Create a receiver account from the sign-up page.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description (optional)</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's inside?" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={sendParcel} disabled={sending || !selectedReceiver}>
                {sending ? "Sending…" : "Dispatch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {parcels.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageIcon className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No parcels yet. Send your first one!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {parcels.map((p) => (
            <Card key={p.id} className="p-4 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 min-w-0">
                <div className="size-11 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <PackageIcon className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold">{p.tracking_number}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    To <span className="font-medium text-foreground">{namesById[p.receiver_id] ?? "—"}</span>
                    {p.description ? ` · ${p.description}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Sent {new Date(p.created_at).toLocaleString()}
                    {p.delivered_at && ` · Delivered ${new Date(p.delivered_at).toLocaleString()}`}
                  </div>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent?: "success" | "warning" }) {
  const color = accent === "success" ? "text-success bg-success/15" : accent === "warning" ? "text-warning bg-warning/15" : "text-primary bg-accent";
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`size-11 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}
