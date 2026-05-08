import apiClient from "./client";

export const authApi = {
  register: (payload) => apiClient.post("/auth/register", payload),
  login: (payload) => apiClient.post("/auth/login", payload),
  me: () => apiClient.get("/auth/me"),
  updateLocation: (payload) => apiClient.patch("/auth/me/location", payload),
};

export const itemApi = {
  listNearby: (params) => apiClient.get("/items", { params }),
  getById: (id, params) => apiClient.get(`/items/${id}`, { params }),
  myItems: () => apiClient.get("/items/mine"),
  create: (formData) =>
    apiClient.post("/items", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id) => apiClient.delete(`/items/${id}`),
  updateAvailability: (id, payload) => apiClient.patch(`/items/${id}/availability`, payload),
};

export const rentalApi = {
  createRequest: (payload) => apiClient.post("/rentals", payload),
  myRentals: (params) => apiClient.get("/rentals", { params }),
  getById: (id) => apiClient.get(`/rentals/${id}`),
  respond: (id, action) => apiClient.patch(`/rentals/${id}/respond`, { action }),
  uploadBeforeVideo: (id, formData) =>
    apiClient.patch(`/rentals/${id}/before-video`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  activate: (id) => apiClient.patch(`/rentals/${id}/activate`),
  uploadAfterVideo: (id, formData) =>
    apiClient.patch(`/rentals/${id}/after-video`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  release: (id) => apiClient.patch(`/rentals/${id}/release`),
  confirmReturn: (id) => apiClient.patch(`/rentals/${id}/confirm-return`),
};

export const paymentApi = {
  createOrder: (rentalId) => apiClient.post(`/payments/rentals/${rentalId}/create-order`),
  verify: (rentalId, payload) => apiClient.post(`/payments/rentals/${rentalId}/verify`, payload),
};

export const aiApi = {
  generateListing: (payload) => apiClient.post("/ai/generate-listing", payload),
  toolChat: (payload) => apiClient.post("/ai/tool-chat", payload),
  recommendations: (payload) => apiClient.post("/ai/recommendations", payload),
};

export const reviewApi = {
  create: (payload) => apiClient.post("/reviews", payload),
  byItem: (itemId) => apiClient.get(`/reviews/items/${itemId}`),
};

export const disputeApi = {
  list: (params) => apiClient.get("/disputes", { params }),
  create: (formData) =>
    apiClient.post("/disputes", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  resolve: (id, payload) => apiClient.patch(`/disputes/${id}/resolve`, payload),
};

export const chatApi = {
  listMessages: (rentalId) => apiClient.get(`/chat/rentals/${rentalId}`),
  send: (payload) => apiClient.post("/chat", payload),
};

export const adminApi = {
  analytics: () => apiClient.get("/admin/analytics"),
  users: (params) => apiClient.get("/admin/users", { params }),
  suspendUser: (userId, isSuspended) => apiClient.patch(`/admin/users/${userId}/suspend`, { isSuspended }),
  listCategories: () => apiClient.get("/admin/categories"),
  createCategory: (payload) => apiClient.post("/admin/categories", payload),
  updateCategory: (id, payload) => apiClient.patch(`/admin/categories/${id}`, payload),
};

export const notificationApi = {
  list: () => apiClient.get("/notifications"),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`),
};
