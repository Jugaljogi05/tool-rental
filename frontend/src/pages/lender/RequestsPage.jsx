import { useEffect, useState } from "react";
import { rentalApi } from "../../api/endpoints";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import ChatWindow from "../../components/chat/ChatWindow";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatCurrency, formatDate } from "../../utils/format";

const OPEN_REQUEST_STATUSES = new Set([
  "Pending",
  "AwaitingPayment",
  "AwaitingPickupProof",
  "Active",
  "ReturnRequested",
]);

const RequestsPage = () => {
  const [rentals, setRentals] = useState([]);
  const [selectedChat, setSelectedChat] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await rentalApi.myRentals();
      const openRentals = (res.data.data.rentals || []).filter((rental) =>
        OPEN_REQUEST_STATUSES.has(rental.rentalStatus)
      );
      setRentals(openRentals);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load rental requests.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (fn) => {
    setError("");
    try {
      await fn();
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Action failed.");
    }
  };

  return (
    <DashboardLayout title="Rental Requests">
      <div className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {rentals.map((rental) => (
          <article key={rental._id} className="card-lift animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold">{rental.itemId?.name}</h3>
              <Badge>{rental.rentalStatus}</Badge>
            </div>
            <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
              <p>Borrower: {rental.borrowerId?.name}</p>
              <p>From: {formatDate(rental.startDate)}</p>
              <p>To: {formatDate(rental.endDate)}</p>
              <p>Total: {formatCurrency(rental.totalAmount)}</p>
            </div>

            {rental.isOverdue ? (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold text-amber-300">Overdue return alert</p>
                <p className="mt-1 text-zinc-200">{rental.overdueMessage}</p>
                <p className="text-zinc-300">
                  Fine currently due: {formatCurrency(rental.estimatedLatePenalty)}
                </p>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {rental.rentalStatus === "Pending" ? (
                <>
                  <Button onClick={() => act(() => rentalApi.respond(rental._id, "accept"))}>Accept</Button>
                  <Button variant="ghost" onClick={() => act(() => rentalApi.respond(rental._id, "reject"))}>
                    Reject
                  </Button>
                </>
              ) : null}
              {rental.rentalStatus === "AwaitingPickupProof" ? (
                <Button onClick={() => act(() => rentalApi.activate(rental._id))}>Activate rental</Button>
              ) : null}
              {rental.rentalStatus === "ReturnRequested" ? (
                <Button onClick={() => act(() => rentalApi.confirmReturn(rental._id))}>Release item</Button>
              ) : null}
              <Button variant="muted" onClick={() => setSelectedChat(rental._id)}>
                Open chat
              </Button>
            </div>
          </article>
        ))}
        {!rentals.length ? <p className="text-sm text-zinc-400">No rental requests yet.</p> : null}
        <ChatWindow rentalId={selectedChat} />
      </div>
    </DashboardLayout>
  );
};

export default RequestsPage;
