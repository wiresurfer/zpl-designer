export default function DemoBanner({ onAbout }: { onAbout: () => void }) {
  return (
    <div className="border-b border-border bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
      Static demo — no backend attached, so Save / Load / View ZPL / Print won't work here.{" "}
      <button onClick={onAbout} className="underline underline-offset-2 hover:text-foreground">
        Run it yourself
      </button>
      .
    </div>
  );
}
