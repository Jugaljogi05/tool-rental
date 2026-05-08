import Button from "./Button";

const MapToggle = ({ mode, onChange }) => (
  <div className="animate-fade-up flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-1">
    <Button
      variant={mode === "list" ? "primary" : "muted"}
      className="px-3 py-1"
      onClick={() => onChange("list")}
    >
      List
    </Button>
    <Button
      variant={mode === "map" ? "primary" : "muted"}
      className="px-3 py-1"
      onClick={() => onChange("map")}
    >
      Map
    </Button>
  </div>
);

export default MapToggle;
