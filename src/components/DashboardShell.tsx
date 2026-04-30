import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Package, LogOut } from "lucide-react";
import { toast } from "sonner";

export function DashboardShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
              <Package className="size-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">ParcelTrack</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}

export function StatusBadge({ status }: { status: "dispatched" | "delivered" }) {
  const isDelivered = status === "delivered";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
        isDelivered ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
      }`}
    >
      <span className={`size-1.5 rounded-full ${isDelivered ? "bg-success" : "bg-warning"}`} />
      {status}
    </span>
  );
}
