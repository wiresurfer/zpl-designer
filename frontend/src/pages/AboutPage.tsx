import { LINKEDIN_URL } from "@/contact";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">About</h1>
      <p className="mb-8 text-sm text-muted-foreground">A ZPL label designer for Zebra printers.</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          zpl-designer is a browser-based canvas for laying out Zebra labels — text, shapes, barcodes, QR
          codes, and raw ZPL escape hatches — compiled to real ZPL and sent to a printer over CUPS.
        </p>

        <div>
          <h2 className="mb-2 font-medium">This site</h2>
          <p className="text-muted-foreground">
            This is a static build of the designer UI only. There's no backend behind it, so Save, Load,
            View&nbsp;ZPL, and Print won't work here — they need the FastAPI backend running somewhere
            with access to a CUPS-registered Zebra queue.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-medium">Running it yourself</h2>
          <p className="text-muted-foreground">
            The backend is a small FastAPI app (<code className="rounded bg-muted px-1 py-0.5">uvicorn app.main:app</code>)
            that talks to CUPS for printing and keeps a SQLite store for saved labels. See{" "}
            <code className="rounded bg-muted px-1 py-0.5">backend/</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5">docs/zpl-notes.md</code> in the repo for setup
            and the hardware notes gathered against a real ZD230.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-medium">Want a Docker image?</h2>
          <p className="text-muted-foreground">
            A packaged container isn't published yet, but I'll put one together on request — reach out on{" "}
            <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              LinkedIn
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
