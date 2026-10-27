"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/format";
import { HELP_ATTACHMENT_DAYS, HELP_CATEGORY_LABEL, HELP_STATUS_LABEL, type HelpStatus, type HelpTicket } from "@/lib/help";

export const STATUS_TONE: Record<HelpStatus, "gold" | "blue" | "green"> = { baru: "gold", diproses: "blue", selesai: "green" };

/** One help message with its context, attachment and replies, plus a reply box. */
export function HelpThread({ t, admin, onChanged }: { t: HelpTicket; admin?: boolean; onChanged: () => void }) {
  const run = useStore((s) => s.run);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const r = await run("replyHelp", { ticketId: t.id, message: reply });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setReply("");
    toast.success("Balasan terkirim");
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[t.status]}>{HELP_STATUS_LABEL[t.status]}</Badge>
        <span className="text-sm font-semibold">{HELP_CATEGORY_LABEL[t.category]}</span>
        <span className="text-sm text-muted">· {formatDateTime(t.createdAt)}</span>
      </div>
      {admin && t.user && <p className="text-sm"><b>{t.user.name}</b> · {t.user.email}</p>}
      <p className="whitespace-pre-wrap break-words text-[15px]">{t.message}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-xl bg-ivory p-3 text-sm text-muted">
        <dt>Halaman</dt><dd className="break-all">{t.context.page}</dd>
        <dt>Peran</dt><dd>{t.context.role}</dd>
        {t.context.temple && <><dt>Pura</dt><dd>{t.context.temple}</dd></>}
        <dt>Perangkat</dt><dd>{t.context.device} · {t.context.browser}{t.context.screen ? ` · layar ${t.context.screen}` : ""}</dd>
      </dl>
      {t.attachment ? (
        <a href={t.attachment} target="_blank" rel="noreferrer" className="inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.attachment} alt="Gambar lampiran" className="max-h-48 rounded-xl border border-line" />
        </a>
      ) : t.attachmentRemovedAt ? (
        <p className="text-sm italic text-muted">Gambar lampiran sudah dihapus otomatis ({HELP_ATTACHMENT_DAYS} hari setelah selesai).</p>
      ) : null}

      {t.replies.length > 0 && (
        <ul className="space-y-2">
          {t.replies.map((r) => (
            <li key={r.id} className={cn("rounded-2xl p-3 text-[15px]", r.fromAdmin ? "mr-6 bg-mint/70" : "ml-6 bg-stone-100")}>
              <p className="text-sm font-semibold">{r.authorName} <span className="font-normal text-muted">· {formatDateTime(r.createdAt)}</span></p>
              <p className="whitespace-pre-wrap break-words">{r.message}</p>
            </li>
          ))}
        </ul>
      )}

      <Field label={admin ? "Balas" : "Tambahkan keterangan / balas"} htmlFor={`balas-${t.id}`}>
        <Textarea id={`balas-${t.id}`} rows={2} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} />
      </Field>
      {!admin && <p className="text-sm text-muted">Jangan menulis kata sandi, PIN, kode OTP, atau kode rahasia apa pun.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {admin && (["baru", "diproses", "selesai"] as HelpStatus[]).filter((s) => s !== t.status).map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={async () => { const r = await run("setHelpStatus", { ticketId: t.id, status: s }); if (!r.ok) toast.error(r.error); else onChanged(); }}>
            Tandai {HELP_STATUS_LABEL[s]}
          </Button>
        ))}
        <Button size="sm" loading={busy} disabled={!reply.trim()} onClick={send}><Send className="h-4 w-4" /> Kirim balasan</Button>
      </div>
    </div>
  );
}
