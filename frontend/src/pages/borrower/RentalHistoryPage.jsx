import { useEffect, useState } from "react";
import {
  disputeApi,
  paymentApi,
  rentalApi,
  reviewApi,
} from "../../api/endpoints";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ChatWindow from "../../components/chat/ChatWindow";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatCurrency, formatDate } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";

const RentalHistoryPage = () => {
  const { user } = useAuth();
  const [rentals, setRentals] = useState([]);
  const [activeChatRentalId, setActiveChatRentalId] = useState("");
  const [paymentMeta, setPaymentMeta] = useState({});
  const [reviewDraft, setReviewDraft] = useState({});
  const [disputeDraft, setDisputeDraft] = useState({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const loadRentals = async () => {
    try {
      const res = await rentalApi.myRentals();
      setRentals(res.data.data.rentals);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load rental history.");
    }
  };

  useEffect(() => {
    loadRentals();
  }, []);

  const uploadVideo = async (rentalId, file, type) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("video", file);
    if (type === "before") await rentalApi.uploadBeforeVideo(rentalId, formData);
    else await rentalApi.uploadAfterVideo(rentalId, formData);
    loadRentals();
  };

  const releaseItem = async (rentalId) => {
    try {
      await rentalApi.release(rentalId);
      loadRentals();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to release item.");
    }
  };

  const createOrder = async (rentalId) => {
    try {
      const res = await paymentApi.createOrder(rentalId);
      const paymentData = res.data.data || {};
      setPaymentMeta((prev) => ({
        ...prev,
        [rentalId]: {
          ...prev[rentalId],
          orderId: paymentData.orderId || "",
          paymentId: paymentData.mockPaymentId || prev[rentalId]?.paymentId || "",
          signature: paymentData.signature || prev[rentalId]?.signature || "",
          isMock: Boolean(paymentData.isMock),
        },
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create payment order.");
    }
  };

  const payWithMockRazorpay = async (rentalId) => {
    try {
      const res = await paymentApi.createOrder(rentalId);
      const paymentData = res.data.data || {};
      setPaymentMeta((prev) => ({
        ...prev,
        [rentalId]: {
          ...prev[rentalId],
          orderId: paymentData.orderId || "",
          paymentId: paymentData.mockPaymentId || "",
          signature: paymentData.signature || "",
          isMock: Boolean(paymentData.isMock),
        },
      }));

      if (!paymentData.isMock) {
        setError("Mock Razorpay is disabled. Set MOCK_RAZORPAY=true in backend/.env and restart the server.");
        return;
      }

      await paymentApi.verify(rentalId, {
        orderId: paymentData.orderId,
        paymentId: paymentData.mockPaymentId,
        signature: paymentData.signature,
      });
      loadRentals();
    } catch (err) {
      setError(err.response?.data?.message || "Mock payment failed.");
    }
  };

  const verifyPayment = async (rentalId) => {
    try {
      const payload = paymentMeta[rentalId] || {};
      await paymentApi.verify(rentalId, payload);
      loadRentals();
    } catch (err) {
      setError(err.response?.data?.message || "Payment verification failed.");
    }
  };

  const copyReceipt = async (rental) => {
    const receiptText = [
      `Receipt: ${rental.payment?.receiptNumber || ""}`,
      `Item: ${rental.itemId?.name || ""}`,
      `Amount: ${formatCurrency(rental.totalAmount)}`,
      `Method: ${rental.payment?.method || "Razorpay"}`,
      `Paid At: ${rental.payment?.paidAt ? formatDate(rental.payment.paidAt) : ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(receiptText);
      setInfo("Payment proof copied to clipboard.");
      setTimeout(() => setInfo(""), 2000);
    } catch {
      setError("Unable to copy payment proof.");
    }
  };

  const downloadBill = (rental) => {
    const billWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
    if (!billWindow) {
      setError("Popup blocked. Please allow popups to download the PDF-style bill.");
      return;
    }

    const escapeHtml = (value) =>
      `${value || ""}`
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const formatMoney = (value) => `INR ${Number(value || 0).toFixed(2)}`;
    const paidAt = rental.payment?.paidAt ? formatDate(rental.payment.paidAt) : "-";
    const receipt = rental.payment?.receiptNumber || "-";
    const billHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Borrowly Receipt ${receipt}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              background: #0a0a0a;
              color: #f4f4f5;
              padding: 32px;
            }
            .sheet {
              max-width: 820px;
              margin: 0 auto;
              background: linear-gradient(180deg, #111111 0%, #18181b 100%);
              border: 1px solid #3f3f46;
              border-radius: 24px;
              padding: 28px;
              box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
            }
            .top {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              align-items: flex-start;
              border-bottom: 1px solid #27272a;
              padding-bottom: 18px;
              margin-bottom: 18px;
            }
            h1 {
              margin: 0;
              font-size: 28px;
              letter-spacing: 0.5px;
            }
            .sub {
              margin-top: 6px;
              color: #a1a1aa;
              font-size: 13px;
            }
            .badge {
              border: 1px solid rgba(34, 197, 94, 0.35);
              background: rgba(34, 197, 94, 0.12);
              color: #86efac;
              padding: 10px 14px;
              border-radius: 999px;
              font-weight: 700;
              font-size: 12px;
              white-space: nowrap;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 14px;
              margin-top: 18px;
            }
            .card {
              border: 1px solid #27272a;
              background: rgba(24, 24, 27, 0.92);
              border-radius: 18px;
              padding: 16px;
            }
            .label {
              color: #a1a1aa;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin-bottom: 6px;
            }
            .value {
              font-size: 15px;
              font-weight: 700;
              color: #fafafa;
              line-height: 1.45;
            }
            .summary {
              margin-top: 18px;
              border-top: 1px solid #27272a;
              padding-top: 18px;
            }
            .summaryRow {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              padding: 10px 0;
              border-bottom: 1px dashed #27272a;
              font-size: 14px;
            }
            .summaryRow strong { color: #fff; }
            .footer {
              margin-top: 18px;
              color: #a1a1aa;
              font-size: 12px;
              line-height: 1.6;
            }
            @media print {
              body { padding: 0; background: #fff; color: #000; }
              .sheet { border: none; border-radius: 0; box-shadow: none; }
              .card { background: #fff; }
              .badge { color: #166534; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="top">
              <div>
                <h1>Borrowly Receipt</h1>
                <div class="sub">Official payment bill generated for your rental transaction.</div>
              </div>
              <div class="badge">PAID</div>
            </div>

            <div class="grid">
              <div class="card">
                <div class="label">Receipt Number</div>
                <div class="value">${receipt}</div>
              </div>
              <div class="card">
                <div class="label">Payment Method</div>
                <div class="value">${rental.payment?.method || "Razorpay"}</div>
              </div>
              <div class="card">
                <div class="label">Item</div>
                <div class="value">${escapeHtml(rental.itemId?.name || "-")}</div>
              </div>
              <div class="card">
                <div class="label">Paid At</div>
                <div class="value">${paidAt}</div>
              </div>
              <div class="card">
                <div class="label">Borrower</div>
                <div class="value">${escapeHtml(user?.name || "-")}</div>
              </div>
              <div class="card">
                <div class="label">Lender</div>
                <div class="value">${escapeHtml(rental.ownerId?.name || "-")}</div>
              </div>
            </div>

            <div class="summary">
              <div class="summaryRow"><span>Rental Period</span><strong>${formatDate(rental.startDate)} to ${formatDate(rental.endDate)}</strong></div>
              <div class="summaryRow"><span>Rent</span><strong>${formatMoney(rental.rentAmount)}</strong></div>
              <div class="summaryRow"><span>Deposit</span><strong>${formatMoney(rental.depositAmount)}</strong></div>
              <div class="summaryRow"><span>Late Fine</span><strong>${formatMoney(rental.latePenalty || 0)}</strong></div>
              <div class="summaryRow"><span>Total Paid</span><strong>${formatMoney(rental.totalAmount)}</strong></div>
            </div>

            <div class="footer">
              This PDF-style receipt is generated automatically by Borrowly and can be kept as payment proof.
              ${rental.estimatedLatePenalty ? ` Current overdue estimate: INR ${Number(rental.estimatedLatePenalty).toFixed(2)}.` : ""}
            </div>
          </div>
          <script>
            window.onload = function () {
              setTimeout(function () {
                window.print();
              }, 350);
            };
          </script>
        </body>
      </html>
    `;

    billWindow.document.open();
    billWindow.document.write(billHtml);
    billWindow.document.close();
    setInfo("PDF-style bill opened for download.");
    setTimeout(() => setInfo(""), 2000);
  };

  const submitReview = async (rental) => {
    try {
      const draft = reviewDraft[rental._id] || {};
      await reviewApi.create({
        rentalId: rental._id,
        targetUserId: rental.ownerId?._id,
        rating: Number(draft.rating || 5),
        comment: draft.comment || "",
      });
      loadRentals();
    } catch (err) {
      setError(err.response?.data?.message || "Review submission failed.");
    }
  };

  const submitDispute = async (rentalId) => {
    try {
      const draft = disputeDraft[rentalId] || {};
      if (!draft.reason) return;
      const formData = new FormData();
      formData.append("rentalId", rentalId);
      formData.append("reason", draft.reason);
      if (draft.video) formData.append("video", draft.video);
      await disputeApi.create(formData);
      loadRentals();
    } catch (err) {
      setError(err.response?.data?.message || "Dispute submission failed.");
    }
  };

  const settleDispute = async (rental) => {
    try {
      if (!window.confirm("Mark this dispute as settled and complete the rental?")) return;
      await disputeApi.settle(rental.dispute._id, {
        resolutionNotes: "Settled by the rental participants.",
      });
      loadRentals();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to settle dispute.");
    }
  };

  return (
    <DashboardLayout title="My Rentals">
      <div className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {info ? <p className="text-sm text-emerald-400">{info}</p> : null}
        {rentals.map((rental) => (
          <article key={rental._id} className="card-lift animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold">{rental.itemId?.name}</h3>
              <Badge>{rental.rentalStatus}</Badge>
            </div>
            <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
              <p>From: {formatDate(rental.startDate)}</p>
              <p>To: {formatDate(rental.endDate)}</p>
              <p>Rent: {formatCurrency(rental.rentAmount)}</p>
              <p>Deposit: {formatCurrency(rental.depositAmount)}</p>
            </div>

            {rental.isOverdue ? (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold text-amber-300">Late return alert</p>
                <p className="mt-1 text-zinc-200">{rental.overdueMessage}</p>
                <p className="text-zinc-300">
                  Current fine estimate: {formatCurrency(rental.estimatedLatePenalty)}
                </p>
                <p className="text-zinc-300">Release the item as soon as you upload return proof.</p>
              </div>
            ) : null}

            {rental.payment?.receiptNumber ? (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                <p className="font-semibold text-emerald-300">Payment proof generated</p>
                <p className="mt-1 text-zinc-200">Receipt: {rental.payment.receiptNumber}</p>
                <p className="text-zinc-300">Method: {rental.payment.method || "Razorpay"}</p>
                <p className="text-zinc-300">Paid at: {rental.payment.paidAt ? formatDate(rental.payment.paidAt) : "-"}</p>
                <p className="text-zinc-300">Amount: {formatCurrency(rental.totalAmount)}</p>
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => copyReceipt(rental)}>
                      Copy payment proof
                    </Button>
                    <Button variant="muted" onClick={() => downloadBill(rental)}>
                      Download PDF bill
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {rental.rentalStatus === "AwaitingPayment" ? (
              <div className="mt-3 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-zinc-950/90 to-indigo-500/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                      Checkout
                    </p>
                    <h4 className="font-display text-lg font-bold text-zinc-100">
                      Rent and deposit are tracked separately
                    </h4>
                    <p className="mt-1 max-w-2xl text-sm text-zinc-300">
                      The rent covers the booking itself. The deposit is held as security and comes
                      back after the return is confirmed.
                    </p>
                  </div>
                  <Badge tone="warning">Awaiting payment</Badge>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.05fr]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                        Rent charge
                      </p>
                      <p className="mt-2 text-3xl font-bold text-zinc-50">
                        {formatCurrency(rental.rentAmount)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-300">
                        Covers the item for {rental.numberOfDays || 0} day
                        {Number(rental.numberOfDays || 0) === 1 ? "" : "s"}.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                        Security deposit
                      </p>
                      <p className="mt-2 text-3xl font-bold text-zinc-50">
                        {formatCurrency(rental.depositAmount)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-300">
                        Held separately and refunded after the rental is completed.
                      </p>
                    </div>
                    <div className="sm:col-span-2 rounded-2xl border border-zinc-700 bg-zinc-950/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            Total due now
                          </p>
                          <p className="mt-1 text-sm text-zinc-300">
                            Rent + deposit are collected together for checkout.
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {formatCurrency(rental.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                      <Button onClick={() => createOrder(rental._id)}>Create Razorpay Order</Button>
                      <Button variant="muted" onClick={() => payWithMockRazorpay(rental._id)}>
                        Pay with Mock Razorpay
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-700 bg-zinc-950/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Payment verification
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      For mock checkout or manual testing, fill in the payment identifiers here and
                      confirm once the gateway response is ready.
                    </p>
                    <div className="mt-4 grid gap-3">
                      <Input
                        label="Order ID"
                        value={paymentMeta[rental._id]?.orderId || ""}
                        onChange={(e) =>
                          setPaymentMeta((prev) => ({
                            ...prev,
                            [rental._id]: { ...prev[rental._id], orderId: e.target.value },
                          }))
                        }
                      />
                      <Input
                        label="Payment ID"
                        value={paymentMeta[rental._id]?.paymentId || ""}
                        onChange={(e) =>
                          setPaymentMeta((prev) => ({
                            ...prev,
                            [rental._id]: { ...prev[rental._id], paymentId: e.target.value },
                          }))
                        }
                      />
                      <Input
                        label="Signature"
                        value={paymentMeta[rental._id]?.signature || ""}
                        onChange={(e) =>
                          setPaymentMeta((prev) => ({
                            ...prev,
                            [rental._id]: { ...prev[rental._id], signature: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <Button className="mt-4 w-full" onClick={() => verifyPayment(rental._id)}>
                      {paymentMeta[rental._id]?.isMock ? "Complete Mock Payment" : "Verify payment"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {rental.rentalStatus === "AwaitingPickupProof" ? (
              <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/80 p-3">
                <p className="text-sm font-semibold">Upload before-pickup video proof</p>
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-300"
                  type="file"
                  accept="video/*"
                  onChange={(e) => uploadVideo(rental._id, e.target.files?.[0], "before")}
                />
              </div>
            ) : null}

            {rental.rentalStatus === "Active" ? (
              <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/80 p-3">
                <p className="text-sm font-semibold">Upload after-return video proof</p>
                {rental.isOverdue ? (
                  <p className="mt-1 text-xs text-amber-300">
                    Late fine is currently {formatCurrency(rental.estimatedLatePenalty)} and increases until return proof is uploaded.
                  </p>
                ) : null}
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-300"
                  type="file"
                  accept="video/*"
                  onChange={(e) => uploadVideo(rental._id, e.target.files?.[0], "after")}
                />
                <div className="mt-3">
                  <Button variant="muted" onClick={() => releaseItem(rental._id)}>
                    Release item
                  </Button>
                </div>
              </div>
            ) : null}

            {["AwaitingPickupProof", "Active", "ReturnRequested", "Completed"].includes(rental.rentalStatus) ? (
              <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/80 p-3">
                <p className="text-sm font-semibold">Need help? Raise dispute</p>
                <p className="mt-1 text-xs text-zinc-400">
                  You can open a dispute as soon as the item is picked up, without waiting for return.
                </p>
                <Input
                  label="Reason"
                  value={disputeDraft[rental._id]?.reason || ""}
                  onChange={(e) =>
                    setDisputeDraft((prev) => ({
                      ...prev,
                      [rental._id]: { ...prev[rental._id], reason: e.target.value },
                    }))
                  }
                />
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-300"
                  type="file"
                  accept="video/*"
                  onChange={(e) =>
                    setDisputeDraft((prev) => ({
                      ...prev,
                      [rental._id]: { ...prev[rental._id], video: e.target.files?.[0] },
                    }))
                  }
                />
                <Button className="mt-2" variant="ghost" onClick={() => submitDispute(rental._id)}>
                  Raise dispute
                </Button>
              </div>
            ) : null}

            {rental.rentalStatus === "Completed" ? (
              <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/80 p-3">
                {rental.myReview ? (
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Your review is submitted</p>
                    <p className="mt-1 text-sm text-zinc-300">Rating: {rental.myReview.rating}/5</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Comment: {rental.myReview.comment || "No comment provided."}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Leave rating/review</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        label="Rating (1-5)"
                        type="number"
                        min="1"
                        max="5"
                        value={reviewDraft[rental._id]?.rating || "5"}
                        onChange={(e) =>
                          setReviewDraft((prev) => ({
                            ...prev,
                            [rental._id]: { ...prev[rental._id], rating: e.target.value },
                          }))
                        }
                      />
                      <Input
                        label="Comment"
                        value={reviewDraft[rental._id]?.comment || ""}
                        onChange={(e) =>
                          setReviewDraft((prev) => ({
                            ...prev,
                            [rental._id]: { ...prev[rental._id], comment: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <Button className="mt-2" onClick={() => submitReview(rental)}>
                      Submit review
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            {rental.rentalStatus === "Disputed" ? (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm font-semibold text-amber-200">Dispute in progress</p>
                <p className="mt-1 text-xs text-amber-100/80">
                  Once the issue is settled, you can complete the dispute and release the item for relisting or deletion.
                </p>
                <Button
                  className="mt-3"
                  variant="ghost"
                  onClick={() => settleDispute(rental)}
                  disabled={!rental.dispute?._id}
                >
                  Complete dispute
                </Button>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="muted" onClick={() => setActiveChatRentalId(rental._id)}>
                Open chat
              </Button>
              <span className="text-xs text-zinc-400">Lender: {rental.ownerId?.name}</span>
              <span className="text-xs text-zinc-400">You: {user?.name}</span>
            </div>
          </article>
        ))}
        {!rentals.length ? <p className="text-sm text-zinc-400">No rentals yet.</p> : null}
        <ChatWindow rentalId={activeChatRentalId} />
      </div>
    </DashboardLayout>
  );
};

export default RentalHistoryPage;
