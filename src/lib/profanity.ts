import { Filter } from "bad-words";

const filter = new Filter();

export interface DisplayNameValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDisplayName(name: string): DisplayNameValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "Display name is required." };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: "Display name must be 50 characters or less." };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Display name can only contain letters, numbers, and underscores.",
    };
  }

  if (filter.isProfane(trimmed)) {
    return {
      valid: false,
      error: "Please choose an appropriate display name.",
    };
  }

  return { valid: true };
}
