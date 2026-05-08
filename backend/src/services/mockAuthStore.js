import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const mockUsers = new Map();

export const isMockAuthEnabled = () =>
  `${process.env.MOCK_AUTH || process.env.SKIP_DB || "false"}`.toLowerCase() === "true";

const normalizeEmail = (email = "") => email.toLowerCase().trim();

export const findMockUserByEmail = (email) => {
  const target = normalizeEmail(email);
  for (const user of mockUsers.values()) {
    if (user.email === target) return user;
  }
  return null;
};

export const findMockUserById = (id) => mockUsers.get(`${id}`) || null;

export const createMockUser = async ({ name, email, password, role, phone, location }) => {
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const user = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: name.trim(),
    email: normalizeEmail(email),
    passwordHash,
    role: role || "borrower",
    phone: phone || "",
    location: {
      lat: Number(location.lat),
      lng: Number(location.lng),
    },
    ratingAverage: 0,
    ratingCount: 0,
    trustScore: 50,
    lenderBalance: 0,
    completedRentals: 0,
    failedDisputes: 0,
    isSuspended: false,
    createdAt: now,
    updatedAt: now,
  };

  mockUsers.set(user._id, user);
  return user;
};

export const verifyMockPassword = (user, candidatePassword) =>
  bcrypt.compare(candidatePassword, user.passwordHash);

export const updateMockUserLocation = (id, lat, lng) => {
  const user = mockUsers.get(`${id}`);
  if (!user) return null;
  user.location = { lat: Number(lat), lng: Number(lng) };
  user.updatedAt = new Date();
  mockUsers.set(user._id, user);
  return user;
};

export const updateMockUserBalance = (id, amount) => {
  const user = mockUsers.get(`${id}`);
  if (!user) return null;
  user.lenderBalance = Number((Number(user.lenderBalance || 0) + Number(amount || 0)).toFixed(2));
  user.updatedAt = new Date();
  mockUsers.set(user._id, user);
  return user;
};

export const signTokenForUser = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

export const sanitizeMockUser = (user) => {
  const clone = { ...user };
  delete clone.passwordHash;
  return clone;
};

export const getPublicMockUserById = (id) => {
  const user = findMockUserById(id);
  if (!user) return null;
  const clean = sanitizeMockUser(user);
  return {
    _id: clean._id,
    name: clean.name,
    ratingAverage: clean.ratingAverage,
    trustScore: clean.trustScore,
    ratingCount: clean.ratingCount,
    lenderBalance: clean.lenderBalance,
  };
};
