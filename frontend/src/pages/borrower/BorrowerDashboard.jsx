import { useEffect, useState } from "react";
import { itemApi } from "../../api/endpoints";
import MapToggle from "../../components/common/MapToggle";
import ItemFilters from "../../components/items/ItemFilters";
import ItemCard from "../../components/items/ItemCard";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";

const BorrowerDashboard = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ q: "", category: "all", radiusKm: "5" });
  const [mode, setMode] = useState("list");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchMeta, setSearchMeta] = useState({
    searchMode: "standard",
    semanticSearchUsed: false,
    semanticSearchProvider: "",
  });

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        ...filters,
        lat: user?.location?.lat,
        lng: user?.location?.lng,
      };
      const res = await itemApi.listNearby(params);
      setItems(res.data.data.items);
      setSearchMeta(
        res.data.meta || {
          searchMode: "standard",
          semanticSearchUsed: false,
          semanticSearchProvider: "",
        }
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load nearby items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.location) loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <DashboardLayout title="Borrower Dashboard">
      <div className="space-y-4">
        <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-300">
            Showing items within {filters.radiusKm} km radius. Choose any distance from 1 km to 10 km.
          </p>
          <MapToggle mode={mode} onChange={setMode} />
        </div>
        {searchMeta.semanticSearchUsed ? (
          <div className="animate-fade-up rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Semantic search is active for this query.
            {searchMeta.semanticSearchProvider ? (
              <span className="ml-1 text-cyan-200/80">
                {searchMeta.semanticSearchProvider.includes("lexical")
                  ? `Fallback used: ${searchMeta.semanticSearchProvider}`
                  : `Engine: ${searchMeta.semanticSearchProvider}`}
              </span>
            ) : null}
          </div>
        ) : null}
        <ItemFilters filters={filters} setFilters={setFilters} onApply={loadItems} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-zinc-300">Loading nearby items...</p> : null}
        {mode === "list" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item._id} item={item} />
            ))}
          </div>
        ) : (
          <div className="animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
            <p className="mb-3 text-sm font-semibold">Map View (coordinates + map links)</p>
            <div className="space-y-2 text-sm">
              {items.map((item) => {
                const [lng, lat] = item.location.coordinates;
                return (
                  <div key={item._id} className="card-lift flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
                    <span>
                      {item.name} ({lat.toFixed(4)}, {lng.toFixed(4)})
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-zinc-300 underline"
                    >
                      Open Map
                    </a>
                  </div>
                );
              })}
              {!items.length ? <p className="text-zinc-300">No items found for selected filters.</p> : null}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BorrowerDashboard;
