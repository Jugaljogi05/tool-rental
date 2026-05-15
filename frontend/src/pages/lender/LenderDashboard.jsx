import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi, itemApi, rentalApi } from "../../api/endpoints";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatCurrency } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";

const LenderDashboard = () => {
  const [items, setItems] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [error, setError] = useState("");
  const { setUser } = useAuth();

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, rentalsRes] = await Promise.all([itemApi.myItems(), rentalApi.myRentals()]);
      setItems(itemsRes.data.data.items);
      setRentals(rentalsRes.data.data.rentals);
      try {
        const profileRes = await authApi.me();
        setUser(profileRes.data.data.user);
      } catch {
        // If profile refresh fails, keep showing the rental-derived totals.
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load lender dashboard.");
    }
  }, [setUser]);

  useEffect(() => {
    loadData();
    const intervalId = window.setInterval(loadData, 8000);
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadData]);

  useEffect(() => {
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const earnings = useMemo(
    () => rentals.reduce((sum, rental) => sum + Number(rental.lenderEarnings || 0), 0),
    [rentals]
  );

  const updateAvailability = async (itemId, availabilityStatus) => {
    try {
      await itemApi.updateAvailability(itemId, { availabilityStatus });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update availability.");
    }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm("Delete this listing? This action will hide it from the platform.")) return;

    try {
      await itemApi.delete(itemId);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete item.");
    }
  };

  return (
    <DashboardLayout title="Lender Dashboard">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="card-lift animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Total Items</p>
            <p className="font-display text-2xl font-bold">{items.length}</p>
          </div>
          <div className="card-lift animate-fade-up-delay-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Active Rentals</p>
            <p className="font-display text-2xl font-bold">
              {rentals.filter((r) => ["Active", "ReturnRequested"].includes(r.rentalStatus)).length}
            </p>
          </div>
          <div className="card-lift animate-fade-up-delay-2 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Earnings</p>
            <p className="font-display text-2xl font-bold">{formatCurrency(earnings)}</p>
            <p className="mt-1 text-xs text-zinc-400">Includes confirmed payments and late fees.</p>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={item._id} className="card-lift animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
              <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
                {item.imageUrls?.[0] ? (
                  <img
                    src={item.imageUrls[0]}
                    alt={item.name}
                    className="h-44 w-full object-contain bg-black p-2"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-gradient-to-br from-cyan-500/20 via-zinc-950 to-indigo-500/20 text-zinc-300">
                    No preview image
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold">{item.name}</h3>
                <Badge>{item.availabilityStatus}</Badge>
              </div>
              {Array.isArray(item.imageUrls) && item.imageUrls.length ? (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {item.imageUrls.length} photo{item.imageUrls.length === 1 ? "" : "s"}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-zinc-300">{item.description}</p>
              <p className="mt-2 text-sm text-zinc-300">Price/day: {formatCurrency(item.pricePerDay)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="muted" onClick={() => updateAvailability(item._id, "Available")}>
                  Set Available
                </Button>
                <Button variant="ghost" onClick={() => updateAvailability(item._id, "Blocked")}>
                  Block
                </Button>
                <Button variant="danger" onClick={() => deleteItem(item._id)}>
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LenderDashboard;
