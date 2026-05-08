import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/format";
import { formatDistance } from "../../utils/distance";
import Badge from "../common/Badge";

const ItemCard = ({ item }) => (
  <article className="card-lift animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 shadow-mono backdrop-blur-sm">
    <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
      {item.imageUrls?.[0] ? (
        <img
          src={item.imageUrls[0]}
          alt={item.name}
          className="h-56 w-full object-contain bg-black p-2"
          loading="lazy"
        />
      ) : (
        <div className="flex h-56 items-end justify-between bg-gradient-to-br from-cyan-500/20 via-zinc-950 to-indigo-500/20 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Product preview</p>
            <p className="mt-1 text-2xl font-display font-bold">{item.category}</p>
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
            No image
          </span>
        </div>
      )}
    </div>
    <div className="mb-2 flex items-center justify-between">
      <h3 className="font-display text-lg font-bold">{item.name}</h3>
      <Badge>{item.category}</Badge>
    </div>
    {Array.isArray(item.imageUrls) && item.imageUrls.length ? (
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {item.imageUrls.length} photo{item.imageUrls.length === 1 ? "" : "s"} available
      </p>
    ) : null}
    {typeof item.semanticScore === "number" ? (
      <div className="mb-2 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
        AI match {Math.round(item.semanticScore * 100)}%
      </div>
    ) : null}
    <p className="line-clamp-2 text-sm text-zinc-300">{item.description}</p>
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-300">
      <p>Price/day: <strong>{formatCurrency(item.pricePerDay)}</strong></p>
      <p>Deposit: <strong>{formatCurrency(item.depositAmount)}</strong></p>
      <p>Distance: <strong>{formatDistance(item.distanceKm)}</strong></p>
      <p>Owner trust: <strong>{item.ownerId?.trustScore ?? 0}</strong></p>
    </div>
    <Link
      to={`/borrower/item/${item._id}`}
      className="mt-4 inline-flex rounded-xl border border-zinc-600 px-3 py-2 text-sm font-semibold transition hover:bg-zinc-800"
    >
      View details
    </Link>
  </article>
);

export default ItemCard;
