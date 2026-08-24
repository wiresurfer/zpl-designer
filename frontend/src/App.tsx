import { useState } from "react";

import LabelCanvas from "@/canvas/LabelCanvas";
import DemoBanner from "@/DemoBanner";
import ElementPalette from "@/editor/ElementPalette";
import ElementPropertyPanel from "@/editor/ElementPropertyPanel";
import Nav, { type View } from "@/Nav";
import AboutPage from "@/pages/AboutPage";
import RoadmapPage from "@/pages/RoadmapPage";
import LabelToolbar from "@/print/LabelToolbar";
import { LabelStoreProvider } from "@/state/labelStore";

function App() {
  const [view, setView] = useState<View>("designer");

  return (
    <div className="flex h-screen flex-col">
      <Nav view={view} setView={setView} />

      {view === "roadmap" && (
        <div className="flex-1 overflow-auto">
          <RoadmapPage />
        </div>
      )}
      {view === "about" && (
        <div className="flex-1 overflow-auto">
          <AboutPage />
        </div>
      )}
      {view === "designer" && (
        <LabelStoreProvider>
          <DemoBanner onAbout={() => setView("about")} />
          <LabelToolbar />
          <div className="flex flex-1 gap-4 overflow-hidden p-4">
            <aside className="w-40 shrink-0">
              <ElementPalette />
            </aside>
            <main className="flex flex-1 items-start justify-center overflow-auto">
              <LabelCanvas />
            </main>
            <aside className="w-72 shrink-0 overflow-y-auto border-l border-border pl-4">
              <ElementPropertyPanel />
            </aside>
          </div>
        </LabelStoreProvider>
      )}
    </div>
  );
}

export default App;
