export const routeByRole = {
  borrower: "/borrower/dashboard",
  lender: "/lender/dashboard",
  admin: "/admin/dashboard",
};

export const getRouteForRole = (role) => routeByRole[role] || "/login";
