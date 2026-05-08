import Notification from "../models/Notification.js";

export const createNotification = async ({ userId, title, message, type = "info", metadata = {} }) =>
  Notification.create({ userId, title, message, type, metadata });
