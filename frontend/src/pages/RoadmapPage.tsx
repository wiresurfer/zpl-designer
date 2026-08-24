const shipped = [
  "Canvas label editor — text, shapes, barcodes, QR codes, raw ZPL snippets",
  "ZPL compiler with a live \"View ZPL\" preview",
  "Save/load labels against the backend's document store",
  "Direct printing to a CUPS-backed Zebra queue, with job status polling",
];

const planned = [
  {
    title: "JS printer client",
    body: "A browser-side printer client so a label can be sent straight from this page to a Zebra printer without the Python/CUPS backend in the loop — useful for the static hosted demo and for lighter-weight setups.",
  },
  {
    title: "Partsbox printing for Mac, via a Raspberry Pi bridge",
    body: "macOS has no clean native path to a networked Zebra queue for Partsbox-style small-parts labeling. Planned: a Raspberry Pi running as a CUPS print-server bridge, so a Mac on the same network can print through it.",
  },
];

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Roadmap</h1>
      <p className="mb-8 text-sm text-muted-foreground">What's working today, and what's next.</p>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Shipped</h2>
      <ul className="mb-8 space-y-2">
        {shipped.map((item) => (
          <li key={item} className="flex gap-2 text-sm">
            <span className="text-primary">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Planned</h2>
      <div className="space-y-4">
        {planned.map((item) => (
          <div key={item.title} className="rounded-lg border border-border p-4">
            <h3 className="mb-1 text-sm font-medium">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
