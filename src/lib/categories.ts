export const CATEGORIES = [
  "ID Cards",
  "Books",
  "Mobile Phones",
  "Laptops",
  "Wallets",
  "Keys",
  "Bags",
  "Chargers",
  "Documents",
  "Electronics",
  "Others",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LOST_STATUSES = ["pending", "matched", "recovered"] as const;
export const FOUND_STATUSES = ["pending", "claimed", "returned"] as const;
