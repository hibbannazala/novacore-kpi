"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getKpiRole } from "@/types";
import type { Feedback } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bug, Sparkles, MessageSquare, Clock, CheckCircle, XCircle, Activity } from "lucide-react";

const typeIcon = {
  bug: <Bug className="h-4 w-4 text-rose-500" />,
  feature: <Sparkles className="h-4 w-4 text-amber-500" />,
  other: <MessageSquare className="h-4 w-4 text-blue-500" />,
};

const statusLabel: Record<Feedback["status"], string> = {
  open: "Baru",
  in_progress: "Diproses",
  resolved: "Selesai",
  rejected: "Ditolak",
};

function rowToFeedback(row: Record<string, unknown>): Feedback {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    department: row.department as string,
    role: row.role as Feedback["role"],
    type: row.type as Feedback["type"],
    message: row.message as string,
    status: row.status as Feedback["status"],
    createdAt: { seconds: new Date(row.created_at as string).getTime() / 1000, nanoseconds: 0, toDate: () => new Date(row.created_at as string) } as any,
    updatedAt: { seconds: new Date(row.updated_at as string).getTime() / 1000, nanoseconds: 0, toDate: () => new Date(row.updated_at as string) } as any,
  };
}

export default function FeedbacksPage() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | Feedback["type"]>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Feedback["status"]>("all");

  const role = user ? getKpiRole(user) : null;
  if (role && role !== "developer") {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">Akses tidak diizinkan.</p>
      </div>
    );
  }

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });
      setFeedbacks((data ?? []).map(rowToFeedback as any));
      setLoading(false);
    }

    fetch();

    const channel = supabase
      .channel("feedbacks_all")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  async function updateStatus(id: string, newStatus: Feedback["status"]) {
    try {
      const supabase = createClient();
      await supabase.from("feedbacks").update({ status: newStatus }).eq("id", id);
    } catch (e) {
      console.error("Gagal mengupdate status feedback", e);
    }
  }

  const filtered = feedbacks.filter((f) => {
    if (filterType !== "all" && f.type !== filterType) return false;
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Laporan Bug & Fitur</h2>
          <p className="text-sm text-muted-foreground">Kumpulan aspirasi, komentar, dan bug report dari tim.</p>
        </div>
      </div>

      <div className="flex gap-2 bg-muted p-1 rounded-lg w-fit">
        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
          <SelectTrigger className="w-36 h-8 text-xs bg-background">
            <SelectValue placeholder="Semua Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            <SelectItem value="bug">Bug / Error</SelectItem>
            <SelectItem value="feature">Fitur Baru</SelectItem>
            <SelectItem value="other">Lainnya</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
          <SelectTrigger className="w-36 h-8 text-xs bg-background">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="open">Baru</SelectItem>
            <SelectItem value="in_progress">Diproses</SelectItem>
            <SelectItem value="resolved">Selesai</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center border rounded-xl border-dashed">
            <p className="text-muted-foreground text-sm">Tidak ada laporan yang sesuai filter.</p>
          </div>
        ) : (
          filtered.map((f) => (
            <div key={f.id} className="rounded-xl border bg-card flex flex-col overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
                {typeIcon[f.type]}
                <span className="text-xs font-semibold capitalize flex-1">
                  {f.type === "other" ? "Lainnya" : f.type}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {f.createdAt?.toDate().toLocaleDateString("id-ID")}
                </span>
              </div>

              <div className="p-4 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium">{f.userName}</p>
                    <p className="text-[10px] text-muted-foreground">{f.department} · {f.role}</p>
                  </div>
                  <Select
                    value={f.status}
                    onValueChange={(v: any) => updateStatus(f.id, v)}
                  >
                    <SelectTrigger className="h-6 text-[10px] w-28 px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Baru</SelectItem>
                      <SelectItem value="in_progress">Diproses</SelectItem>
                      <SelectItem value="resolved">Selesai</SelectItem>
                      <SelectItem value="rejected">Ditolak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{f.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
