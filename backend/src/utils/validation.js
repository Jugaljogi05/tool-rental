export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$/;

export const PASSWORD_RULE_MESSAGE =
  "Password must be 8-64 characters and include uppercase, lowercase, number, and special character.";

export const isValidEmail = (email) => EMAIL_REGEX.test(`${email || ""}`.trim().toLowerCase());

export const isStrongPassword = (password) => PASSWORD_REGEX.test(`${password || ""}`);
