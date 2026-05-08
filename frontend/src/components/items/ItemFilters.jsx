import Input from "../common/Input";
import Button from "../common/Button";

const ItemFilters = ({ filters, setFilters, onApply }) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onApply();
    }}
    className="animate-fade-up grid gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm md:grid-cols-4"
  >
    <Input
      label="Search item"
      placeholder="Drill machine..."
      value={filters.q}
      onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
    />
    <p className="md:col-span-4 -mt-1 text-xs text-zinc-400">
      Try natural phrases like "something to tighten bolts" for AI semantic search.
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
    <Input
      label="Radius (km)"
      type="number"
      min="1"
      max="5"
      value={filters.radiusKm}
      onChange={(e) => setFilters((prev) => ({ ...prev, radiusKm: e.target.value }))}
    />
    <div className="flex items-end">
      <Button type="submit" className="w-full">
        Apply
      </Button>
    </div>
  </form>
);

export default ItemFilters;
