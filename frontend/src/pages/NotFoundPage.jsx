import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
    <h1 className="font-display text-4xl font-black">404</h1>
    <p className="text-zinc-600">Page not found.</p>
    <Link to="/" className="rounded-xl border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper">
      Go home
    </Link>
  </div>
);

export default NotFoundPage;
