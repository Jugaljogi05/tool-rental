import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { useAuth } from "../../context/AuthContext";
import { getRouteForRole } from "../../utils/authRoutes";
import { isStrongPassword, isValidEmail, PASSWORD_RULE_MESSAGE } from "../../utils/validation";

const RegisterPage = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "borrower",
    lat: "",
    lng: "",
  });
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("Detecting your location...");
  const { register, loading } = useAuth();
  const navigate = useNavigate();

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

  useEffect(() => {
    fetchLocation();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isStrongPassword(form.password)) {
      setError(PASSWORD_RULE_MESSAGE);
      return;
    }

    if (!form.lat || !form.lng) {
      setError("Location is required. Please allow location access and retry.");
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        location: { lat: Number(form.lat), lng: Number(form.lng) },
      };
      const response = await register(payload);
      navigate(getRouteForRole(response.data.user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg space-y-4 rounded-3xl border border-zinc-700 bg-zinc-900/90 p-6 text-zinc-100 shadow-mono"
      >
        <h1 className="font-display text-3xl font-bold">Create Borrowly Account</h1>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            minLength={8}
            required
          />
          <div className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs md:col-span-2">
            <p className="font-semibold">Location (auto-detected)</p>
            <p>Lat: {form.lat || "-"}</p>
            <p>Lng: {form.lng || "-"}</p>
            <p className="mt-1 text-zinc-400">{locationMessage}</p>
            <button
              type="button"
              onClick={fetchLocation}
              className="mt-2 rounded-lg border border-zinc-600 px-2 py-1 text-xs font-semibold hover:bg-zinc-800"
            >
              Retry location
            </button>
          </div>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Role</span>
          <select
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          >
            <option value="borrower">Borrower</option>
            <option value="lender">Lender</option>
          </select>
        </label>
        <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-100" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
        <p className="text-xs text-zinc-400">
          Password rule: 8-64 chars with uppercase, lowercase, number, and special character.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-sm">
          Already registered?{" "}
          <Link className="font-semibold text-zinc-100 underline" to="/login">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;
