import { Info, LayoutGrid, Map } from "lucide-react";

export type View = "designer" | "roadmap" | "about";

const tabs: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: "designer", label: "Designer", icon: LayoutGrid },
  { id: "roadmap", label: "Roadmap", icon: Map },
  { id: "about", label: "About", icon: Info },
];

export default function Nav({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <nav className="flex items-center gap-1 border-b border-border px-4 py-1.5">
      <span className="mr-3 text-sm font-semibold">zpl-designer</span>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setView(id)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            view === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
