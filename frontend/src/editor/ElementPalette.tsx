import { Barcode, Code, Grid3x3, Minus, Square, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLabelStore } from "@/state/labelStore";
import type { ElementType, LineBoxPreset } from "@/types/labelSchema";

const ITEMS: { type: ElementType; preset?: LineBoxPreset; label: string; icon: typeof Type }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "barcode", label: "Barcode", icon: Barcode },
  { type: "linebox", preset: "line", label: "Line", icon: Minus },
  { type: "linebox", preset: "box", label: "Box", icon: Square },
  { type: "raw", label: "Raw ZPL", icon: Code },
];

export default function ElementPalette() {
  const { addElement, armedTool, setArmedTool } = useLabelStore();

  return (
    <div className="flex flex-col gap-1">
      <span className="mb-1 text-xs font-medium text-muted-foreground">Add element</span>
      {ITEMS.map(({ type, preset, label, icon: Icon }) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={() => addElement(type, preset)}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      ))}
      <Button
        variant={armedTool === "grid-qr" ? "default" : "outline"}
        size="sm"
        className="justify-start gap-2"
        onClick={() => setArmedTool(armedTool === "grid-qr" ? null : "grid-qr")}
      >
        <Grid3x3 className="h-4 w-4" />
        QR Grid {armedTool === "grid-qr" && "(draw a box)"}
      </Button>
    </div>
  );
}
