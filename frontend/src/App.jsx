import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AdminDashboard from "./pages/admin/AdminDashboard";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import BorrowerDashboard from "./pages/borrower/BorrowerDashboard";
import ItemDetailsPage from "./pages/borrower/ItemDetailsPage";
import RentalHistoryPage from "./pages/borrower/RentalHistoryPage";
import AddItemPage from "./pages/lender/AddItemPage";
import LenderDashboard from "./pages/lender/LenderDashboard";
import RequestsPage from "./pages/lender/RequestsPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { getRouteForRole } from "./utils/authRoutes";

const HomeRoute = () => {
  const { user, token } = useAuth();
  if (!token || !user) return <LandingPage />;
  return <Navigate to={getRouteForRole(user.role)} replace />;
};

const PublicOnlyRoute = ({ children }) => {
  const { user, token } = useAuth();

  if (token && user) {
    return <Navigate to={getRouteForRole(user.role)} replace />;
  }

  return children;
};

const App = () => (
  <Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route
      path="/login"
      element={
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      }
    />
    <Route
      path="/register"
      element={
        <PublicOnlyRoute>
          <RegisterPage />
        </PublicOnlyRoute>
      }
    />

    <Route
      path="/borrower/dashboard"
      element={
        <ProtectedRoute roles={["borrower", "admin"]}>
          <BorrowerDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/borrower/item/:id"
      element={
        <ProtectedRoute roles={["borrower", "admin"]}>
          <ItemDetailsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/borrower/rentals"
      element={
        <ProtectedRoute roles={["borrower", "admin"]}>
          <RentalHistoryPage />
        </ProtectedRoute>
      }
    />

    <Route
      path="/lender/dashboard"
      element={
        <ProtectedRoute roles={["lender", "admin"]}>
          <LenderDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/lender/add-item"
      element={
        <ProtectedRoute roles={["lender", "admin"]}>
          <AddItemPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/lender/requests"
      element={
        <ProtectedRoute roles={["lender", "admin"]}>
          <RequestsPage />
        </ProtectedRoute>
      }
    />

    <Route
      path="/admin/dashboard"
      element={
        <ProtectedRoute roles={["admin"]}>
          <AdminDashboard />
        </ProtectedRoute>
      }
    />

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default App;
