export interface WikiArticle {
  pageId: number;
  title: string;
  extract: string;
  url: string;
}

export interface WikiCategory {
  /** Display name without "Category:" prefix, e.g. "Physics" */
  name: string;
  /** Full title for API calls, e.g. "Category:Physics" */
  title: string;
}

interface WikiApiPage {
  pageid: number;
  title: string;
  extract?: string;
  fullurl: string;
}

interface WikiApiResponse {
  query?: {
    pages: Record<string, WikiApiPage>;
    allcategories?: Array<{ "*": string }>;
  };
  continue?: {
    gcmcontinue?: string;
  };
}

const API_BASE =
  "https://en.wikipedia.org/w/api.php?format=json&origin=*";

const ARTICLE_PROPS =
  "&prop=extracts|info&inprop=url&exintro=1&explaintext=1";

function pagesToArticles(pages: Record<string, WikiApiPage>): WikiArticle[] {
  return Object.values(pages)
    .filter((page) => page.extract)
    .map((page) => ({
      pageId: page.pageid,
      title: page.title,
      extract: page.extract!,
      url: page.fullurl,
    }));
}

/** Normalize user input to a full category title for the API. */
export function normalizeCategoryTitle(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(/^category:/i, "").trim();
  if (!withoutPrefix) return null;

  return `Category:${withoutPrefix}`;
}

export function categoryDisplayName(title: string): string {
  return title.replace(/^category:/i, "").trim();
}

export async function searchCategories(
  prefix: string,
  limit: number = 12
): Promise<WikiCategory[]> {
  const trimmed = prefix.trim().replace(/^category:/i, "");
  if (trimmed.length < 2) return [];

  const url =
    `${API_BASE}&action=query&list=allcategories` +
    `&acprefix=${encodeURIComponent(trimmed)}&aclimit=${limit}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`);
  }

  const data: WikiApiResponse = await response.json();
  const categories = data.query?.allcategories ?? [];

  return categories.map((row) => {
    const name = row["*"];
    return { name, title: `Category:${name}` };
  });
}

async function fetchCategoryArticles(
  categoryTitle: string,
  limit: number = 50
): Promise<WikiArticle[]> {
  const url =
    `${API_BASE}&action=query&generator=categorymembers` +
    `&gcmtitle=${encodeURIComponent(categoryTitle)}` +
    `&gcmnamespace=0&gcmtype=page&gcmlimit=${limit}${ARTICLE_PROPS}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`);
  }

  const data: WikiApiResponse = await response.json();
  const pages = data.query?.pages;
  if (!pages) return [];

  return pagesToArticles(pages);
}

function pickRandomPair(articles: WikiArticle[]): [WikiArticle, WikiArticle] {
  if (articles.length < 2) {
    throw new Error("Not enough articles with previews in this category");
  }

  const shuffled = [...articles].sort(() => Math.random() - 0.5);
  const a = shuffled[0];
  const b = shuffled.find((x) => x.pageId !== a.pageId) ?? shuffled[1];
  return [a, b];
}

export async function fetchRandomPair(
  category?: string | null
): Promise<[WikiArticle, WikiArticle]> {
  if (category) {
    const articles = await fetchCategoryArticles(category, 50);
    return pickRandomPair(articles);
  }

  const articles = await fetchRandomArticles(4);
  return pickRandomPair(articles);
}

export async function fetchRandomArticles(
  count: number = 5
): Promise<WikiArticle[]> {
  const url =
    `${API_BASE}&action=query&generator=random&grnnamespace=0&grnlimit=${count}${ARTICLE_PROPS}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`);
  }

  const data: WikiApiResponse = await response.json();
  const pages = data.query?.pages;
  if (!pages) return [];

  return pagesToArticles(pages);
}
