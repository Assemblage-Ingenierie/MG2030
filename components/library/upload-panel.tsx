"use client";

// ============================================================
// Dépôt de document : upload DIRECT navigateur → R2.
//
// Le fichier ne traverse jamais une fonction serveur (brief §4). La séquence :
//   1. le serveur délivre une URL pré-signée (route presign-upload) ;
//   2. le navigateur envoie le fichier À R2, en PUT direct ;
//   3. le serveur enregistre les métadonnées.
//
// `XMLHttpRequest` et non `fetch` : c'est la seule API qui expose la
// progression d'un envoi. Sur un fichier d'un gigaoctet et une liaison lente,
// une barre figée fait annuler l'opération.
// ============================================================

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { registerDocument } from "@/app/(app)/library/actions";
import { cn } from "@/lib/cn";

type Phase = "idle" | "signing" | "uploading" | "recording" | "done" | "error";

export function UploadPanel({ folderId, folderPath }: { folderId: string; folderPath: string }) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function upload(file: File) {
    setFilename(file.name);
    setProgress(0);
    setMessage(null);
    setPhase("signing");

    // ── 1. URL pré-signée ─────────────────────────────────────────────────
    const signResponse = await fetch("/api/documents/presign-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        folderId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      }),
    });

    if (!signResponse.ok) {
      const { error } = (await signResponse.json().catch(() => ({}))) as { error?: string };
      setPhase("error");
      setMessage(t(`library.error_${error ?? "generic"}`));
      return;
    }

    const { uploadUrl, objectKey, requiredHeaders } = (await signResponse.json()) as {
      uploadUrl: string;
      objectKey: string;
      requiredHeaders: Record<string, string>;
    };

    // ── 2. Envoi direct vers R2 ───────────────────────────────────────────
    setPhase("uploading");
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", uploadUrl, true);
      for (const [header, value] of Object.entries(requiredHeaders)) {
        xhr.setRequestHeader(header, value);
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.onabort = () => resolve(false);
      xhr.send(file);
    });
    xhrRef.current = null;

    if (!ok) {
      setPhase("error");
      setMessage(t("library.error_upload_failed"));
      return;
    }

    // ── 3. Métadonnées ────────────────────────────────────────────────────
    // Le fichier est déjà dans R2 : si cette étape échoue, l'objet devient
    // orphelin. On le signale explicitement plutôt que de faire croire à un
    // échec complet — l'administrateur saura qu'il reste un objet à nettoyer.
    setPhase("recording");
    const result = await registerDocument({
      folderId,
      objectKey,
      originalFilename: file.name,
      sizeBytes: file.size,
      mimeType: file.type || "application/octet-stream",
    });

    if (!result.ok) {
      setPhase("error");
      setMessage(t("library.error_orphan", { key: objectKey }));
      return;
    }

    setPhase("done");
    setProgress(100);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const busy = phase === "signing" || phase === "uploading" || phase === "recording";

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t("library.upload")}</h3>
          <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">{folderPath}</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t("library.uploading") : t("library.chooseFile")}
          </Button>
          {phase === "uploading" && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                xhrRef.current?.abort();
                setPhase("idle");
              }}
            >
              {t("common.cancel")}
            </Button>
          )}
        </div>
      </div>

      {busy && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--app-bg)]">
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{ width: `${progress}%`, backgroundColor: "var(--accent)" }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-[var(--text-muted)]">
            {phase === "uploading" ? `${progress}%` : t(`library.phase_${phase}`)}
          </span>
        </div>
      )}

      {message && (
        <p
          role="alert"
          className={cn("rounded-md px-3 py-2 text-sm")}
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {message}
        </p>
      )}

      {phase === "done" && filename && (
        <p className="text-sm" style={{ color: "var(--ok)" }}>
          {t("library.uploaded_ok", { name: filename })}
        </p>
      )}
    </Card>
  );
}
