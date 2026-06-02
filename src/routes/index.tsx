import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AlignCenterHorizontal, Truck, CheckCircle2, Package } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pu Parcel — Modern Package Tracking" },
      { name: "description", content: "Send and track parcels in real time." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      navigate({ to: role === "admin" ? "/admin" : "/receiver" });
    }
  }, [user, role, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
              <AlignCenterHorizontal className="size-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Pu Parcel</span>
          </div>
          <Button onClick={() => navigate({ to: "/login" })}>Sign in</Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-sm font-medium">
            <Truck className="size-4" /> Real-time parcel tracking
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
            Ship smarter. Track instantly.
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            A streamlined package tracking system with separate dashboards for senders and receivers — updates appear in real time.
          </p>
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button size="lg" onClick={() => navigate({ to: "/login" })}>Get Started</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto">
          {[
            { icon: Package, title: "Send Parcels", desc: "Admin dispatches with one click." },
            { icon: Truck, title: "Live Tracking", desc: "Status syncs instantly across panels." },
            { icon: CheckCircle2, title: "Confirm Delivery", desc: "Receiver marks parcels as delivered." },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
              <div className="size-10 rounded-lg bg-accent flex items-center justify-center mb-4">
                <f.icon className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
