import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashboardShell, StatusBadge } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Package as PackageIcon, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/receiver")({
  head: () => ({ meta: [{ title: "Receiver Dashboard — ParcelTrack" }] }),
  component: ReceiverPage,
});

type Parcel = {
  id: string;
  tracking_number: string;
  description: string | null;
  sender_id: string;
  status: "dispatched" | "delivered";
  created_at: string;
  delivered_at: string | null;
  location: string | null;
  box_quantity: number;
};

function ReceiverPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && (!user || role !== "receiver")) navigate({ to: "/login" });
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!user || role !== "receiver") return;

    const load = async () => {
      const { data } = await supabase
        .from("parcels")
        .select("*")
        .order("created_at", { ascending: false });
      const list = (data ?? []) as Parcel[];
      setParcels(list);
      const senderIds = Array.from(new Set(list.map((p) => p.sender_id)));
      if (senderIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", senderIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => (map[p.id] = p.display_name));
        setSenderNames(map);
      }
    };
    load();

    const channel = supabase
      .channel("receiver-parcels")
      .on("postgres_changes", { event: "*", schema: "public", table: "parcels" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newP = payload.new as Parcel;
          setParcels((prev) => [newP, ...prev]);
          toast.success(`New parcel: ${newP.tracking_number}`);
          supabase.from("profiles").select("id, display_name").eq("id", newP.sender_id).maybeSingle().then(({ data }) => {
            if (data) setSenderNames((s) => ({ ...s, [data.id]: data.display_name }));
          });
        } else if (payload.eventType === "UPDATE") {
          setParcels((prev) => prev.map((p) => (p.id === (payload.new as Parcel).id ? (payload.new as Parcel) : p)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role]);

  const markDelivered = async (id: string) => {
    const { error } = await supabase
      .from("parcels")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as delivered");
  };

  const stats = {
    total: parcels.length,
    dispatched: parcels.filter((p) => p.status === "dispatched").length,
    delivered: parcels.filter((p) => p.status === "delivered").length,
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <DashboardShell title="Receiver Dashboard" subtitle="Incoming parcels — confirm delivery in one click">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={PackageIcon} label="Total received" value={stats.total} />
        <StatCard icon={Clock} label="Awaiting delivery" value={stats.dispatched} accent="warning" />
        <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} accent="success" />
      </div>

      <h2 className="text-lg font-semibold mb-4">Your parcels</h2>

      {parcels.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageIcon className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No parcels yet. They'll appear here in real time.</p>
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
                    From <span className="font-medium text-foreground">{senderNames[p.sender_id] ?? "—"}</span>
                    {p.location ? ` · 📍 ${p.location}` : ""}
                    {` · 📦 ${p.box_quantity} box${p.box_quantity > 1 ? "es" : ""}`}
                    {p.description ? ` · ${p.description}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Received {new Date(p.created_at).toLocaleString()}
                    {p.delivered_at && ` · Delivered ${new Date(p.delivered_at).toLocaleString()}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={p.status} />
                {p.status === "dispatched" && (
                  <Button size="sm" onClick={() => markDelivered(p.id)}>
                    <CheckCircle2 className="size-4 mr-1.5" /> Mark delivered
                  </Button>
                )}
              </div>
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
