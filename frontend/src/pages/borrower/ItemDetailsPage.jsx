import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from "lucide-react";
import { aiApi, itemApi, rentalApi, reviewApi } from "../../api/endpoints";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../utils/format";

const pad = (value) => String(value).padStart(2, "0");

const toLocalISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromISODate = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatCalendarLabel = (value) => {
  const date = fromISODate(value);
  if (!date) return "Select date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const buildCalendarGrid = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  return cells;
};

const LIGHTBOX_MIN_SCALE = 1;
const LIGHTBOX_MAX_SCALE = 4;
const LIGHTBOX_SCALE_STEP = 0.25;

const ImageLightbox = ({ open, src, alt, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "+" || event.key === "=") {
        setZoom((prev) => Math.min(LIGHTBOX_MAX_SCALE, Number((prev + LIGHTBOX_SCALE_STEP).toFixed(2))));
      }
      if (event.key === "-") {
        setZoom((prev) => Math.max(LIGHTBOX_MIN_SCALE, Number((prev - LIGHTBOX_SCALE_STEP).toFixed(2))));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const changeZoom = (direction) => {
    setZoom((prev) => {
      const next = direction === "in" ? prev + LIGHTBOX_SCALE_STEP : prev - LIGHTBOX_SCALE_STEP;
      const clamped = Math.min(LIGHTBOX_MAX_SCALE, Math.max(LIGHTBOX_MIN_SCALE, Number(next.toFixed(2))));
      if (clamped === LIGHTBOX_MIN_SCALE) {
        setPan({ x: 0, y: 0 });
      }
      return clamped;
    });
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -LIGHTBOX_SCALE_STEP : LIGHTBOX_SCALE_STEP;
    setZoom((prev) => {
      const next = Math.min(LIGHTBOX_MAX_SCALE, Math.max(LIGHTBOX_MIN_SCALE, Number((prev + delta).toFixed(2))));
      if (next === LIGHTBOX_MIN_SCALE) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const endDrag = () => {
    dragRef.current.active = false;
  };

  const handlePointerDown = (event) => {
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.panX + (event.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (event.clientY - dragRef.current.startY),
    });
  };

  if (!open || !src || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[160] bg-black/95 p-3 sm:p-5"
      onClick={onClose}
    >
      <div className="flex h-full w-full flex-col rounded-[28px] border border-zinc-800 bg-zinc-950/95 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Fullscreen viewer</p>
            <p className="text-sm text-zinc-400">Use buttons, mouse wheel, or drag to pan when zoomed.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeZoom("out")}
              className="rounded-full border border-zinc-700 p-2 text-zinc-200 transition hover:bg-zinc-900"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeZoom("in")}
              className="rounded-full border border-zinc-700 p-2 text-zinc-200 transition hover:bg-zinc-900"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded-full border border-zinc-700 p-2 text-zinc-200 transition hover:bg-zinc-900"
              aria-label="Reset zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-700 p-2 text-zinc-200 transition hover:bg-zinc-900"
              aria-label="Close viewer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-3 overflow-hidden p-3 md:grid-cols-[1fr_220px]">
          <div
            className="relative flex min-h-[55vh] items-center justify-center overflow-hidden rounded-[24px] border border-zinc-800 bg-black"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-[85vh] max-w-full select-none object-contain"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                cursor: zoom > 1 ? "grab" : "zoom-in",
              }}
              draggable={false}
            />
          </div>

          <aside className="flex flex-col gap-3 rounded-[24px] border border-zinc-800 bg-zinc-950/90 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Zoom</p>
              <p className="mt-1 text-3xl font-display font-bold">{Math.round(zoom * 100)}%</p>
            </div>
            <div className="space-y-2 text-sm text-zinc-300">
              <p>Drag the image when zoomed in.</p>
              <p>Use mouse wheel or +/- to zoom.</p>
              <p>Press Esc to close the viewer.</p>
            </div>
            <button
              type="button"
              onClick={resetView}
              className="mt-auto rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-800"
            >
              Reset view
            </button>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
};

const DatePickerField = ({ label, value, onChange, minDate }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => fromISODate(value) || new Date());

  useEffect(() => {
    if (open && value) {
      setViewDate(fromISODate(value) || new Date());
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const calendarCells = useMemo(
    () => buildCalendarGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const minDateValue = fromISODate(minDate);
  const isDisabled = (date) => {
    if (!minDateValue) return false;
    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const min = new Date(minDateValue.getFullYear(), minDateValue.getMonth(), minDateValue.getDate());
    return candidate < min;
  };

  const selectDate = (date) => {
    setOpen(false);
    onChange(toLocalISODate(date));
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-zinc-400"
      >
        <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
        <span className="mt-1 flex items-center justify-between gap-3">
          <span className={value ? "text-zinc-100" : "text-zinc-500"}>{formatCalendarLabel(value)}</span>
          <CalendarDays className="h-4 w-4 text-zinc-400" />
        </span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-4 sm:items-center"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="rounded-full border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-900"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-semibold text-zinc-100">{monthLabel}</p>
                  <button
                    type="button"
                    onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="rounded-full border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-900"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1">
                  {calendarCells.map((date, index) => {
                    if (!date) {
                      return <span key={`empty-${index}`} className="h-10 rounded-lg" />;
                    }

                    const disabled = isDisabled(date);
                    const currentValue = fromISODate(value);
                    const selected =
                      currentValue &&
                      currentValue.getFullYear() === date.getFullYear() &&
                      currentValue.getMonth() === date.getMonth() &&
                      currentValue.getDate() === date.getDate();

                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        disabled={disabled}
                        onClick={() => selectDate(date)}
                        className={`h-10 rounded-lg text-sm transition ${
                          selected
                            ? "bg-cyan-500 text-zinc-950"
                            : disabled
                              ? "cursor-not-allowed text-zinc-700"
                              : "text-zinc-100 hover:bg-zinc-900"
                        }`}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => selectDate(new Date())}
                    >
                      Today
                    </Button>
                    <Button type="button" onClick={() => setOpen(false)}>
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

const ItemDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [dates, setDates] = useState({ startDate: "", endDate: "" });
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "Ask me how to use this item safely." },
  ]);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRecommendations = async (currentItem) => {
    if (!currentItem) return;
    setRecommendationsLoading(true);
    setRecommendationsError("");
    try {
      const res = await aiApi.recommendations({
        itemTitle: currentItem.name,
        category: currentItem.category,
        description: currentItem.description,
      });
      setRecommendations(res.data.data.recommendations || []);
    } catch (err) {
      setRecommendations([]);
      setRecommendationsError(err.response?.data?.message || "Unable to load related suggestions.");
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const loadData = async () => {
    setError("");
    try {
      const [itemRes, reviewRes] = await Promise.all([
        itemApi.getById(id, { lat: user?.location?.lat, lng: user?.location?.lng }),
        reviewApi.byItem(id),
      ]);
      const currentItem = itemRes.data.data.item;
      setItem(currentItem);
      setReviews(reviewRes.data.data.reviews);
      loadRecommendations(currentItem);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load item details.");
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!item) return;
    setSelectedImageIndex(0);
    setViewerOpen(false);
    setChatMessages([{ role: "assistant", text: `Ask me how to use ${item.name} safely.` }]);
    setChatInput("");
    setChatError("");
  }, [item]);

  const estimatedTotal = useMemo(() => {
    if (!item || !dates.startDate || !dates.endDate) return 0;
    const start = new Date(dates.startDate);
    const end = new Date(dates.endDate);
    const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1);
    return days * item.pricePerDay + item.depositAmount;
  }, [item, dates]);

  useEffect(() => {
    if (!dates.startDate || !dates.endDate) return;
    if (dates.endDate < dates.startDate) {
      setDates((prev) => ({ ...prev, endDate: prev.startDate }));
    }
  }, [dates.startDate, dates.endDate]);

  const requestRental = async () => {
    setError("");
    setSuccess("");
    try {
      await rentalApi.createRequest({
        itemId: id,
        startDate: dates.startDate,
        endDate: dates.endDate,
      });
      setSuccess("Rental request sent to lender. Wait for acceptance.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create rental request.");
    }
  };

  const sendToolQuestion = async () => {
    const question = chatInput.trim();
    if (!question || !item) return;

    setChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setChatInput("");
    setChatSending(true);
    setChatError("");

    try {
      const res = await aiApi.toolChat({
        itemTitle: item.name,
        itemDescription: item.description,
        category: item.category,
        userQuestion: question,
      });
      const answer = res.data.data.answer || "Check manual or professional help.";
      setChatMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      const fallback = err.response?.data?.message || "Check manual or professional help.";
      setChatMessages((prev) => [...prev, { role: "assistant", text: fallback }]);
      setChatError(err.response?.data?.message || "Unable to get tool guidance right now.");
    } finally {
      setChatSending(false);
    }
  };

  const galleryImages = Array.isArray(item?.imageUrls) ? item.imageUrls : [];
  const activeImage = galleryImages[selectedImageIndex] || galleryImages[0] || "";

  if (!item) {
    return (
      <DashboardLayout title="Item details">
        <p className="text-sm text-zinc-300">Loading item details...</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Item Details">
      <div className="space-y-5">
        <div className="animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              {galleryImages.length ? (
                <button
                  type="button"
                  onClick={() => setViewerOpen(true)}
                  className="group relative overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 text-left"
                >
                  <img
                    src={activeImage}
                    alt={item.name}
                    className="h-[22rem] w-full object-contain bg-black p-2"
                  />
                  <span className="absolute bottom-3 right-3 rounded-full border border-zinc-700 bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-100 opacity-0 transition group-hover:opacity-100">
                    Open fullscreen
                  </span>
                </button>
              ) : item.workingConditionVideoURL ? (
                <div className="overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950">
                  <video
                    src={item.workingConditionVideoURL}
                    controls
                    className="h-[22rem] w-full object-contain bg-black p-2"
                  />
                </div>
              ) : (
                <div className="flex h-[22rem] items-center justify-center rounded-3xl border border-zinc-700 bg-gradient-to-br from-cyan-500/20 via-zinc-950 to-indigo-500/20 text-zinc-300">
                  No listing media available.
                </div>
              )}

              {galleryImages.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {galleryImages.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      className={`overflow-hidden rounded-2xl border transition ${
                        index === selectedImageIndex
                          ? "border-cyan-400 ring-2 ring-cyan-400/40"
                          : "border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt={`${item.name} view ${index + 1}`}
                        className="h-20 w-full object-contain bg-black p-1"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold">{item.name}</h2>
                    <p className="mt-1 text-sm text-zinc-300">{item.description}</p>
                  </div>
                  <Badge>{item.category}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {galleryImages.length ? (
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-semibold uppercase tracking-wide text-cyan-100">
                      {galleryImages.length} product photos
                    </span>
                  ) : null}
                  {item.workingConditionVideoURL ? (
                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 font-semibold uppercase tracking-wide text-zinc-300">
                      Video proof available
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>
                  Price/day: <strong>{formatCurrency(item.pricePerDay)}</strong>
                </p>
                <p>
                  Deposit: <strong>{formatCurrency(item.depositAmount)}</strong>
                </p>
                <p>
                  Owner rating: <strong>{item.ownerId?.ratingAverage ?? 0}</strong>
                </p>
                <p>
                  Distance: <strong>{item.distanceKm ?? "-"} km</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        <ImageLightbox
          open={viewerOpen}
          src={galleryImages[selectedImageIndex]}
          alt={`${item.name} view ${selectedImageIndex + 1}`}
          onClose={() => setViewerOpen(false)}
        />

        <div className="animate-fade-up-delay-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
          <h3 className="font-display text-lg font-bold">Book this item</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3 items-start">
            <DatePickerField
              label="Start date"
              value={dates.startDate}
              onChange={(dateValue) => setDates((prev) => ({ ...prev, startDate: dateValue }))}
            />
            <DatePickerField
              label="End date"
              value={dates.endDate}
              minDate={dates.startDate}
              onChange={(dateValue) => setDates((prev) => ({ ...prev, endDate: dateValue }))}
            />
            <div className="rounded-xl border border-zinc-700 bg-zinc-950/80 p-3 text-sm">
              <p className="text-zinc-400">Estimated total</p>
              <p className="font-bold">{formatCurrency(estimatedTotal)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            Final amount includes distance-based surcharge, deposit escrow, and possible late penalties.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onClick={requestRental}>Request rental</Button>
            <Button variant="ghost" type="button" onClick={() => setChatOpen(true)}>
              Ask How to Use
            </Button>
          </div>
          {success ? <p className="mt-2 text-sm text-emerald-400">{success}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="animate-fade-up-delay-2 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
          <h3 className="font-display text-lg font-bold">You may also need</h3>
          {recommendationsLoading ? <p className="mt-3 text-sm text-zinc-300">Loading suggestions...</p> : null}
          {recommendationsError ? <p className="mt-3 text-sm text-red-600">{recommendationsError}</p> : null}
          {!recommendationsLoading && !recommendationsError && recommendations.length ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {recommendations.map((recommendation) => (
                <article key={recommendation.name} className="card-lift rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
                  <p className="font-semibold">{recommendation.name}</p>
                  <p className="mt-1 text-sm text-zinc-300">{recommendation.reason}</p>
                </article>
              ))}
            </div>
          ) : null}
          {!recommendationsLoading && !recommendationsError && !recommendations.length ? (
            <p className="mt-3 text-sm text-zinc-400">No related suggestions available right now.</p>
          ) : null}
        </div>

        <div className="animate-fade-up-delay-2 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
          <h3 className="font-display text-lg font-bold">Reviews</h3>
          <div className="mt-3 space-y-2">
            {reviews.map((review) => (
              <article key={review._id} className="card-lift rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 text-sm">
                <p className="font-semibold">
                  {review.reviewerId?.name} - {review.rating}/5
                </p>
                <p className="text-zinc-300">{review.comment || "No comment provided."}</p>
              </article>
            ))}
            {!reviews.length ? <p className="text-sm text-zinc-400">No reviews yet.</p> : null}
          </div>
        </div>

        {chatOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 p-4">
                <div>
                  <h3 className="font-display text-lg font-bold">Ask How to Use</h3>
                  <p className="text-xs text-zinc-400">{item.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[55vh] space-y-3 overflow-y-auto p-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "ml-auto bg-cyan-500/15 text-cyan-50"
                        : "bg-zinc-900 text-zinc-100"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-800 p-4">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask how to use this item safely..."
                  rows="3"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-400"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-zinc-400">
                    The assistant gives beginner-friendly safety guidance only.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" type="button" onClick={() => setChatMessages([{ role: "assistant", text: `Ask me how to use ${item.name} safely.` }])}>
                      Clear
                    </Button>
                    <Button type="button" onClick={sendToolQuestion} disabled={chatSending}>
                      {chatSending ? "Thinking..." : "Send"}
                    </Button>
                  </div>
                </div>
                {chatError ? <p className="mt-2 text-sm text-red-600">{chatError}</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {item.workingConditionVideoURL ? (
          <div className="animate-fade-up-delay-2 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
            <h3 className="font-display text-lg font-bold">Working-condition video</h3>
            <p className="mt-1 text-sm text-zinc-300">
              The video is kept here as additional verification, while the image gallery stays primary for browsing.
            </p>
            <video
              src={item.workingConditionVideoURL}
              controls
              className="mt-3 w-full rounded-2xl border border-zinc-700 bg-zinc-950"
            />
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default ItemDetailsPage;
