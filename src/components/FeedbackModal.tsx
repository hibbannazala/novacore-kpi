"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bug } from "lucide-react";

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, kpiRole } = useAuth();
  const [type, setType] = useState<"bug" | "feature" | "other">("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !user || !kpiRole) return;

    setSubmitting(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("feedbacks").insert({
        user_id: user.id,
        user_name: user.name,
        department: user.department || "Unknown",
        role: kpiRole,
        type,
        message: message.trim(),
        status: "open",
      });
      if (err) throw err;
      setSuccess(true);
      setMessage("");
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch {
      setError("Gagal mengirim laporan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-rose-500" />
            Laporkan Bug / Fitur
          </DialogTitle>
          <DialogDescription>
            Bantu kami memperbaiki sistem dengan melaporkan masalah atau usulan fitur.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium text-green-600">Laporan berhasil dikirim!</p>
            <p className="text-xs text-muted-foreground">Terima kasih atas masukan Anda.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipe Laporan</label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug / Error</SelectItem>
                  <SelectItem value="feature">Usulan Fitur Baru</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Deskripsi</label>
              <Textarea
                placeholder="Jelaskan bug yang ditemukan atau fitur yang diinginkan..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting || !message.trim()}>
                {submitting ? "Mengirim..." : "Kirim Laporan"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
