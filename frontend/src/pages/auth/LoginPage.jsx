import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { getRouteForRole } from "../../utils/authRoutes";
import { isValidEmail } from "../../utils/validation";

const LoginPage = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      const response = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      const roleRoute = getRouteForRole(response.data.user.role);
      const redirectPath = typeof location.state?.from === "string" ? location.state.from : roleRoute;
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-700 bg-zinc-900/90 p-6 text-zinc-100 shadow-mono"
      >
        <h1 className="font-display text-3xl font-bold">Borrowly</h1>
        <p className="text-sm text-zinc-300">Hyperlocal rentals within 5 km.</p>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          required
        />
        <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-100" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-sm">
          New user?{" "}
          <Link className="font-semibold text-zinc-100 underline" to="/register">
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
