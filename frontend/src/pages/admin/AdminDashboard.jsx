import { useEffect, useState } from "react";
import { adminApi, disputeApi } from "../../api/endpoints";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatCurrency } from "../../utils/format";

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [analyticsRes, usersRes, disputesRes, categoriesRes] = await Promise.all([
        adminApi.analytics(),
        adminApi.users(),
        disputeApi.list(),
        adminApi.listCategories(),
      ]);
      setAnalytics(analyticsRes.data.data);
      setUsers(usersRes.data.data.users);
      setDisputes(disputesRes.data.data.disputes);
      setCategories(categoriesRes.data.data.categories);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load admin panel.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleSuspend = async (user) => {
    try {
      await adminApi.suspendUser(user._id, !user.isSuspended);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update user suspension.");
    }
  };

  const resolveDispute = async (disputeId, verdict) => {
    try {
      await disputeApi.resolve(disputeId, {
        status: "Resolved",
        verdict,
        resolutionNotes: `Resolved by admin with ${verdict}.`,
      });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resolve dispute.");
    }
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await adminApi.createCategory({ name: newCategory.trim() });
      setNewCategory("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Category creation failed.");
    }
  };

  return (
    <DashboardLayout title="Admin Panel">
      <div className="space-y-5">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {analytics ? (
          <div className="grid gap-3 md:grid-cols-5">
            <div className="card-lift animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3"><p className="text-xs text-zinc-400">Users</p><p className="font-bold">{analytics.users}</p></div>
            <div className="card-lift animate-fade-up-delay-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3"><p className="text-xs text-zinc-400">Items</p><p className="font-bold">{analytics.items}</p></div>
            <div className="card-lift animate-fade-up-delay-2 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3"><p className="text-xs text-zinc-400">Rentals</p><p className="font-bold">{analytics.rentals}</p></div>
            <div className="card-lift animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3"><p className="text-xs text-zinc-400">Open disputes</p><p className="font-bold">{analytics.openDisputes}</p></div>
            <div className="card-lift animate-fade-up-delay-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3"><p className="text-xs text-zinc-400">Rent revenue</p><p className="font-bold">{formatCurrency(analytics.revenue?.rentRevenue)}</p></div>
          </div>
        ) : null}

        <section className="animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
          <h2 className="font-display text-lg font-bold">Disputes</h2>
          <div className="mt-3 space-y-2">
            {disputes.map((dispute) => (
              <article key={dispute._id} className="card-lift rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{dispute.reason}</p>
                  <Badge>{dispute.status}</Badge>
                </div>
                <p className="text-xs text-zinc-400">Opened by: {dispute.openedBy?.name}</p>
                {dispute.status !== "Resolved" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="muted" onClick={() => resolveDispute(dispute._id, "borrower_fault")}>
                      Borrower at fault
                    </Button>
                    <Button variant="ghost" onClick={() => resolveDispute(dispute._id, "lender_fault")}>
                      Lender at fault
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
            {!disputes.length ? <p className="text-sm text-zinc-400">No disputes available.</p> : null}
          </div>
        </section>

        <section className="animate-fade-up-delay-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
          <h2 className="font-display text-lg font-bold">Users</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="p-2">Name</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Trust</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id} className="border-b border-zinc-800 text-zinc-200">
                    <td className="p-2">{user.name}</td>
                    <td className="p-2">{user.role}</td>
                    <td className="p-2">{user.trustScore}</td>
                    <td className="p-2">{user.isSuspended ? "Suspended" : "Active"}</td>
                    <td className="p-2">
                      <Button variant="muted" onClick={() => toggleSuspend(user)}>
                        {user.isSuspended ? "Unsuspend" : "Suspend"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="animate-fade-up-delay-2 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
          <h2 className="font-display text-lg font-bold">Categories</h2>
          <div className="mt-3 flex gap-2">
            <Input label="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <div className="pt-6">
              <Button onClick={addCategory}>Add</Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {categories.map((category) => (
              <span key={category._id} className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1">
                {category.name}
              </span>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
