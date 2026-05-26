const STORAGE_KEY = "rank-everything-category";

export function loadSavedCategory(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveCategory(category: string | null): void {
  try {
    if (category) {
      localStorage.setItem(STORAGE_KEY, category);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore quota errors
  }
}

export const POPULAR_CATEGORIES = [
  { name: "Science", title: "Category:Science" },
  { name: "Sports", title: "Category:Sports" },
  { name: "Films", title: "Category:Films" },
  { name: "Video games", title: "Category:Video games" },
  { name: "History", title: "Category:History" },
  { name: "Music", title: "Category:Music" },
] as const;
