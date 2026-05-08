import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/common/Button";
import DarkVeil from "../components/background/DarkVeil";

const linksByRole = {
  borrower: [
    { to: "/borrower/dashboard", label: "Explore Items" },
    { to: "/borrower/rentals", label: "My Rentals" },
  ],
  lender: [
    { to: "/lender/dashboard", label: "My Inventory" },
    { to: "/lender/add-item", label: "List New Item" },
    { to: "/lender/requests", label: "Rental Requests" },
  ],
  admin: [{ to: "/admin/dashboard", label: "Admin Panel" }],
};

const DashboardLayout = ({ title, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = linksByRole[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-screen p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <DarkVeil
          hueShift={14}
          noiseIntensity={0.012}
          scanlineIntensity={0.045}
          speed={0.28}
          scanlineFrequency={0.9}
          warpAmount={0.04}
          resolutionScale={0.75}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/80 via-[#05070b]/88 to-[#05070b]/95" />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-4 md:grid-cols-[260px_1fr]">
        <aside className="animate-fade-up rounded-3xl border border-zinc-700 bg-zinc-900/70 p-5 text-zinc-100 shadow-mono backdrop-blur-md">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight">
            BORROWLY
          </Link>
          <div className="mt-6 space-y-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    isActive ? "bg-white text-zinc-900" : "bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 text-xs text-zinc-300">
            <p className="font-semibold">{user?.name}</p>
            <p>{user?.email}</p>
            <p>Role: {user?.role}</p>
            <p>Trust Score: {user?.trustScore ?? 0}</p>
          </div>
          <Button variant="ghost" className="mt-4 w-full" onClick={handleLogout}>
            Logout
          </Button>
        </aside>
        <main className="space-y-4">
          <header className="animate-fade-up-delay-1 rounded-3xl border border-zinc-700 bg-zinc-900/70 p-5 text-zinc-100 shadow-mono backdrop-blur-md">
            <h1 className="font-display text-2xl font-bold">{title}</h1>
          </header>
          <section className="animate-fade-up-delay-2 rounded-3xl border border-zinc-700 bg-zinc-900/70 p-5 text-zinc-100 shadow-mono backdrop-blur-md">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
