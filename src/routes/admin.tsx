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
import { Send, Package as PackageIcon, CheckCircle2, Clock, Download, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { SendParcelAnimation } from "@/components/SendParcelAnimation";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — ParcelTrack" }] }),
  component: AdminPage,
});

type Parcel = {
  id: string;
  tracking_number: string;
  description: string | null;
  receiver_id: string | null;
  status: "dispatched" | "delivered";
  created_at: string;
  delivered_at: string | null;
  location: string | null;
  box_quantity: number;
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
  const [location, setLocation] = useState("");
  const [boxQuantity, setBoxQuantity] = useState<number>(1);
  const [sending, setSending] = useState(false);
  const [showAnim, setShowAnim] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

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
    if (!user) return;
    if (!selectedReceiver) return toast.error("Please select a receiver");
    if (!location.trim()) return toast.error("Location is required");
    if (!boxQuantity || boxQuantity < 1) return toast.error("Box quantity must be at least 1");
    setSending(true);
    const { error } = await supabase.from("parcels").insert({
      sender_id: user.id,
      receiver_id: selectedReceiver,
      description: description || null,
      location: location.trim(),
      box_quantity: boxQuantity,
    } as never);
    setSending(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    setShowAnim(true);
    toast.success("Parcel dispatched!");
    setDescription("");
    setLocation("");
    setBoxQuantity(1);
  };

  const removeReceiver = async (receiverId: string, name: string) => {
    if (!confirm(`Remove receiver "${name}"? Their parcels will also be deleted. This cannot be undone.`)) return;
    // Delete parcels addressed to this receiver (sent by current admin)
    const { error: pErr } = await supabase.from("parcels").delete().eq("receiver_id", receiverId);
    if (pErr) return toast.error(pErr.message);
    // Delete role then profile
    const { error: rErr } = await supabase.from("user_roles").delete().eq("user_id", receiverId);
    if (rErr) return toast.error(rErr.message);
    const { error: prErr } = await supabase.from("profiles").delete().eq("id", receiverId);
    if (prErr) return toast.error(prErr.message);
    setReceivers((prev) => prev.filter((r) => r.id !== receiverId));
    setParcels((prev) => prev.filter((p) => p.receiver_id !== receiverId));
    if (selectedReceiver === receiverId) setSelectedReceiver("");
    toast.success(`Receiver "${name}" removed`);
  };

  const exportToExcel = () => {
    if (parcels.length === 0) return;
    const rows = parcels.map((p) => ({
      "Tracking Number": p.tracking_number,
      "Receiver": p.receiver_id ? (namesById[p.receiver_id] ?? "—") : "—",
      "Location": p.location ?? "",
      "Boxes": p.box_quantity,
      "Description": p.description ?? "",
      "Status": p.status.charAt(0).toUpperCase() + p.status.slice(1),
      "Sent At": new Date(p.created_at).toLocaleString(),
      "Delivered At": p.delivered_at ? new Date(p.delivered_at).toLocaleString() : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 22 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parcels");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `parcels-${stamp}.xlsx`);
    toast.success("Excel file downloaded");
  };

  const stats = {
    total: parcels.length,
    dispatched: parcels.filter((p) => p.status === "dispatched").length,
    delivered: parcels.filter((p) => p.status === "delivered").length,
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <>
    <SendParcelAnimation open={showAnim} onComplete={() => setShowAnim(false)} />
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
          <Dialog open={manageOpen} onOpenChange={setManageOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="size-4 mr-2" /> Manage Receivers
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Receivers</DialogTitle></DialogHeader>
              <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
                {receivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No receivers yet.</p>
                ) : (
                  receivers.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {parcels.filter((p) => p.receiver_id === r.id).length} parcel(s)
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => removeReceiver(r.id, r.display_name)}>
                        <Trash2 className="size-4 mr-1.5" /> Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="transition-all hover:scale-105 hover:shadow-lg active:scale-95">
                <Send className="size-4 mr-2 transition-transform group-hover:translate-x-0.5" /> Send Parcel
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Dispatch a new parcel</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="recv">Receiver</Label>
              <Select value={selectedReceiver} onValueChange={setSelectedReceiver}>
                <SelectTrigger id="recv"><SelectValue placeholder={receivers.length ? "Select a receiver" : "No receivers available"} /></SelectTrigger>
                <SelectContent>
                  {receivers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
              <div className="space-y-2">
                <Label htmlFor="loc">Location</Label>
                <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. New York, NY" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">Box quantity</Label>
                <Input id="qty" type="number" min={1} value={boxQuantity} onChange={(e) => setBoxQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description (optional)</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's inside?" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={sendParcel} disabled={sending || !location.trim() || !selectedReceiver}>
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
                    {p.receiver_id ? <>To <span className="font-medium text-foreground">{namesById[p.receiver_id] ?? "—"}</span></> : <span className="font-medium text-foreground">Parcel</span>}
                    {p.location ? ` · 📍 ${p.location}` : ""}
                    {` · 📦 ${p.box_quantity} box${p.box_quantity > 1 ? "es" : ""}`}
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
    </>
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
