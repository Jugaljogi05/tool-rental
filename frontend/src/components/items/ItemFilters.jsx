import Input from "../common/Input";
import Button from "../common/Button";

const ItemFilters = ({ filters, setFilters, onApply }) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onApply();
    }}
    className="animate-fade-up grid gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm md:grid-cols-5"
  >
    <Input
      label="Search item"
      placeholder="Drill machine..."
      value={filters.q}
      onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
      wrapperClassName="md:col-span-2"
    />
    <p className="md:col-span-4 -mt-1 text-xs text-zinc-400">
      Try natural phrases like "something to tighten bolts" and the semantic search will match intent, not just keywords.
    </p>
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Category</span>
      <select
        value={filters.category}
        onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
      >
        <option value="all">All</option>
        <option value="Tools">Tools</option>
        <option value="Kitchen">Kitchen</option>
        <option value="Furniture">Furniture</option>
        <option value="Electronics">Electronics</option>
      </select>
    </label>
    <label className="space-y-1 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Radius (km)</span>
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-zinc-200">
          {filters.radiusKm} km
        </span>
      </div>
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        value={filters.radiusKm}
        onChange={(e) => setFilters((prev) => ({ ...prev, radiusKm: e.target.value }))}
        className="w-full accent-cyan-400"
      />
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>1 km</span>
        <span>10 km</span>
      </div>
    </label>
    <div className="flex items-end md:col-span-5">
      <Button type="submit" className="w-full">
        Apply
      </Button>
    </div>
  </form>
);

export default ItemFilters;
