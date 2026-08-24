import { useEffect, useState } from "react";

import { Code, FolderOpen, Printer, Save } from "lucide-react";

import {
  compileLabel,
  getPrintJobStatus,
  listDocuments,
  listPrinters,
  saveDocument,
  submitPrintJob,
} from "@/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLabelStore } from "@/state/labelStore";
import type { LabelDoc } from "@/types/labelSchema";

export default function LabelToolbar() {
  const { doc, setDoc, setName } = useLabelStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [loadOpen, setLoadOpen] = useState(false);
  const [savedDocs, setSavedDocs] = useState<LabelDoc[]>([]);

  const [zplOpen, setZplOpen] = useState(false);
  const [zpl, setZpl] = useState("");

  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveDocument(doc);
      setDoc(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenLoad() {
    setLoadOpen(true);
    try {
      setSavedDocs(await listDocuments());
    } catch {
      setSavedDocs([]);
    }
  }

  async function handleViewZpl() {
    try {
      setZpl(await compileLabel(doc, quantity));
    } catch (err) {
      setZpl(err instanceof Error ? `Compile failed: ${err.message}` : "Compile failed");
    }
    setZplOpen(true);
  }

  async function handlePrint() {
    setPrintStatus("submitting...");
    try {
      const printers = await listPrinters();
      if (!printers.default_queue_name) {
        setPrintStatus("no printer queue configured");
        return;
      }
      const result = await submitPrintJob(doc, printers.default_queue_name, quantity);
      setPrintStatus(`${result.job_id}: submitted`);
      setActiveJobId(result.job_id);
    } catch (err) {
      setPrintStatus(err instanceof Error ? `Print failed: ${err.message}` : "Print failed");
    }
  }

  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      try {
        const { status } = await getPrintJobStatus(activeJobId);
        setPrintStatus(`${activeJobId}: ${status}`);
        if (status === "completed") setActiveJobId(null);
      } catch {
        setActiveJobId(null);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeJobId]);

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2">
      <Input
        className="h-8 max-w-64"
        value={doc.name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Label name"
      />

      <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save"}
      </Button>

      <Button variant="outline" size="sm" onClick={handleOpenLoad}>
        <FolderOpen className="h-4 w-4" />
        Load
      </Button>

      <Button variant="outline" size="sm" onClick={handleViewZpl}>
        <Code className="h-4 w-4" />
        View ZPL
      </Button>

      <Input
        type="number"
        min={1}
        className="h-8 w-16"
        value={quantity}
        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
        title="Print quantity (^PQ) -- text fields with auto-increment enabled will step across copies"
      />

      <Button variant="default" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4" />
        Print{quantity > 1 ? ` (${quantity})` : ""}
      </Button>

      {saveError && <span className="text-xs text-destructive">{saveError}</span>}
      {printStatus && <span className="text-xs text-muted-foreground">{printStatus}</span>}

      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load label</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {savedDocs.length === 0 && <p className="text-sm text-muted-foreground">No saved labels yet.</p>}
            {savedDocs.map((d) => (
              <button
                key={d.id}
                className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setDoc(d);
                  setLoadOpen(false);
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={zplOpen} onOpenChange={setZplOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compiled ZPL</DialogTitle>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
            {zpl}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
