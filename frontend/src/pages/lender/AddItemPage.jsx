import { useEffect, useState } from "react";
import { aiApi, itemApi } from "../../api/endpoints";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import DashboardLayout from "../../layouts/DashboardLayout";

const REQUIRED_IMAGE_SLOTS = [
  { key: "front", label: "Front view", hint: "Main face, label, and overall condition." },
  { key: "back", label: "Back view", hint: "Rear side and any ports, handles, or markings." },
  { key: "left", label: "Left view", hint: "One side angle so buyers can judge shape." },
  { key: "right", label: "Right view", hint: "Opposite side angle for full coverage." },
];

const createEmptyForm = () => ({
  name: "",
  description: "",
  category: "Tools",
  pricePerDay: "",
  depositAmount: "",
  lat: "",
  lng: "",
  video: null,
  images: [null, null, null, null],
  extraImages: [],
  livenessPromptResponse: "",
});

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });

const extractVideoFrames = (file, frameCount = 3) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const frames = [];

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    if (!context) {
      cleanup();
      reject(new Error("Canvas is not available."));
      return;
    }

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const captureFrame = (time) =>
      new Promise((resolveFrame, rejectFrame) => {
        const seekHandler = () => {
          try {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.8));
            resolveFrame();
          } catch (captureError) {
            rejectFrame(captureError);
          }
        };

        const onError = () => rejectFrame(new Error("Unable to seek video."));

        video.addEventListener("seeked", seekHandler, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.currentTime = Math.min(Math.max(time, 0), Math.max((video.duration || 0) - 0.1, 0));
      });

    video.addEventListener(
      "loadedmetadata",
      async () => {
        try {
          const duration = video.duration || 0;
          const samplePoints = Array.from({ length: frameCount }, (_, index) =>
            ((index + 1) / (frameCount + 1)) * duration
          );
          for (const point of samplePoints) {
            // eslint-disable-next-line no-await-in-loop
            await captureFrame(point);
          }
          cleanup();
          resolve(frames);
        } catch (captureError) {
          cleanup();
          reject(captureError);
        }
      },
      { once: true }
    );

    video.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error("Unable to load video for frame extraction."));
      },
      { once: true }
    );
  });

const getSelectedImages = (form) =>
  [...form.images.filter(Boolean), ...form.extraImages].filter(Boolean);

const AddItemPage = () => {
  const [form, setForm] = useState(createEmptyForm);
  const [formKey, setFormKey] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("Detecting your location...");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDetails, setGeneratedDetails] = useState(null);

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is not supported by your browser.");
      return;
    }

    setLocationMessage("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setForm((prev) => ({ ...prev, lat, lng }));
        setLocationMessage("Location captured.");
      },
      () => {
        setLocationMessage("Location permission denied. Enable location and retry.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const buildAiPayload = async () => {
    const images = [];
    const selectedImages = getSelectedImages(form).slice(0, 8);

    for (const imageFile of selectedImages) {
      // eslint-disable-next-line no-await-in-loop
      const dataUrl = await fileToDataUrl(imageFile);
      images.push(dataUrl);
    }

    if (form.video) {
      const frames = await extractVideoFrames(form.video, 3);
      images.push(...frames);
    }

    return {
      images,
      video: null,
      hint: [form.name, form.description, form.livenessPromptResponse].filter(Boolean).join(" "),
    };
  };

  const autoGenerateDetails = async () => {
    setError("");
    setMessage("");
    setIsGenerating(true);
    try {
      const payload = await buildAiPayload();
      if (!payload.images.length && !form.video) {
        setError("Add item images or a video before using auto-generate.");
        return;
      }

      const res = await aiApi.generateListing(payload);
      const data = res.data?.data || {};
      setGeneratedDetails({
        title: data.title || "",
        description: data.description || "",
        category: data.category || "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        condition: data.condition || "",
        suggestedPrice: data.suggestedPrice ?? null,
        generated: res.data?.meta?.generated || false,
        reason: res.data?.meta?.reason || "",
      });

      setForm((prev) => ({
        ...prev,
        name: data.title || prev.name,
        description: data.description || prev.description,
        category: data.category || prev.category,
        pricePerDay:
          data.suggestedPrice !== null && data.suggestedPrice !== undefined
            ? String(data.suggestedPrice)
            : prev.pricePerDay,
      }));

      setMessage(
        res.data?.meta?.generated
          ? "AI listing details generated."
          : "AI could not generate details. You can keep editing manually."
      );
    } catch (err) {
      setGeneratedDetails({
        title: "",
        description: "",
        category: "",
        tags: [],
        condition: "",
        suggestedPrice: null,
        generated: false,
        reason: err.response?.data?.message || "AI generation unavailable.",
      });
      setError(err.response?.data?.message || "Unable to generate listing details.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  const updateRequiredImage = (index, file) => {
    setForm((prev) => {
      const images = [...prev.images];
      images[index] = file || null;
      return { ...prev, images };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!form.lat || !form.lng) {
      setError("Location is required. Please allow location access and retry.");
      return;
    }

    if (form.images.filter(Boolean).length < 4) {
      setError("Please upload all 4 borrower-facing item photos before listing.");
      return;
    }

    try {
      const data = new FormData();
      data.append("name", form.name);
      data.append("description", form.description);
      data.append("category", form.category);
      data.append("pricePerDay", form.pricePerDay);
      data.append("depositAmount", form.depositAmount);
      data.append("lat", form.lat);
      data.append("lng", form.lng);
      if (form.video) {
        data.append("video", form.video);
      }
      getSelectedImages(form).forEach((file) => {
        data.append("images", file);
      });
      data.append("livenessPromptResponse", form.livenessPromptResponse);

      await itemApi.create(data);
      setMessage("Item listed successfully.");
      setForm(createEmptyForm());
      setFormKey((key) => key + 1);
      setGeneratedDetails(null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create item.");
    }
  };

  const selectedImageCount = form.images.filter(Boolean).length + form.extraImages.length;

  return (
    <DashboardLayout title="List New Item">
      <form
        key={formKey}
        onSubmit={submit}
        className="animate-fade-up grid gap-4 md:grid-cols-2"
      >
        <Input
          label="Item name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
        />
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Category
          </span>
          <select
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          >
            <option value="Tools">Tools</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Furniture">Furniture</option>
            <option value="Electronics">Electronics</option>
          </select>
        </label>

        <label className="md:col-span-2 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Description
          </span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
            rows="3"
            required
          />
        </label>

        <Input
          label="Price per day"
          type="number"
          min="0"
          value={form.pricePerDay}
          onChange={(e) => setForm((p) => ({ ...p, pricePerDay: e.target.value }))}
          required
        />
        <Input
          label="Deposit amount"
          type="number"
          min="0"
          value={form.depositAmount}
          onChange={(e) => setForm((p) => ({ ...p, depositAmount: e.target.value }))}
          required
        />

        <div className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs md:col-span-2">
          <p className="font-semibold">Item location (auto-detected)</p>
          <p>Lat: {form.lat || "-"}</p>
          <p>Lng: {form.lng || "-"}</p>
          <p className="mt-1 text-zinc-400">{locationMessage}</p>
          <button
            type="button"
            onClick={fetchLocation}
            className="mt-2 rounded-lg border border-zinc-600 px-2 py-1 text-xs font-semibold transition hover:bg-zinc-800"
          >
            Retry location
          </button>
        </div>

        <section className="md:col-span-2 rounded-3xl border border-zinc-700 bg-zinc-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                Borrower gallery
              </p>
              <h3 className="font-display text-lg font-bold">Upload 4 required photos for borrowers</h3>
            </div>
            <p className="text-xs text-zinc-400">{selectedImageCount}/4 images selected</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {REQUIRED_IMAGE_SLOTS.map((slot, index) => (
              <label
                key={slot.key}
                className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {slot.label}
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    Required
                  </span>
                </div>
                <input
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-300"
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => updateRequiredImage(index, e.target.files?.[0] || null)}
                />
                <p className="text-xs text-zinc-400">{slot.hint}</p>
                <p className="text-xs text-zinc-200">
                  {form.images[index] ? form.images[index].name : "No image selected yet."}
                </p>
              </label>
            ))}
          </div>
        </section>

        <label className="md:col-span-2 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Extra images for the gallery
          </span>
          <input
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-300"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setForm((p) => ({ ...p, extraImages: Array.from(e.target.files || []) }))}
          />
          <p className="text-xs text-zinc-400">
            Optional, but helpful for close-ups, accessories, labels, or damage marks.
          </p>
        </label>

        <label className="md:col-span-2 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Working-condition video (optional)
          </span>
          <input
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-300"
            type="file"
            accept="video/*"
            onChange={(e) => setForm((p) => ({ ...p, video: e.target.files?.[0] || null }))}
          />
          <p className="text-xs text-zinc-400">
            The video can help verification, but the 4 product images are what borrowers will browse first.
          </p>
        </label>

        <div className="md:col-span-2">
          <Input
            label="Video prompt response (optional)"
            placeholder="Example: This video shows my cordless drill working."
            value={form.livenessPromptResponse}
            onChange={(e) => setForm((p) => ({ ...p, livenessPromptResponse: e.target.value }))}
          />
        </div>

        <p className="md:col-span-2 text-xs text-zinc-400">
          Tip: Mention the exact item name in your response to help AI mismatch checks.
        </p>

        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={autoGenerateDetails} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Auto Generate Details"}
          </Button>
          <Button type="submit">List item</Button>
        </div>

        {generatedDetails ? (
          <div className="md:col-span-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
            <p className="font-semibold">AI Suggestions</p>
            <p className="mt-1">Condition: {generatedDetails.condition || "n/a"}</p>
            <p>Suggested price: {generatedDetails.suggestedPrice ?? "n/a"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {generatedDetails.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-cyan-400/30 px-2 py-1 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
            {generatedDetails.reason ? (
              <p className="mt-2 text-xs text-cyan-100/80">{generatedDetails.reason}</p>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="md:col-span-2 text-sm text-emerald-400">{message}</p> : null}
        {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      </form>
    </DashboardLayout>
  );
};

export default AddItemPage;
