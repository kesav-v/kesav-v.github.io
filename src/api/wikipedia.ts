export interface WikiArticle {
  pageId: number;
  title: string;
  extract: string;
  url: string;
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
  };
}

const WIKI_API =
  "https://en.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&prop=extracts|info&inprop=url&exintro=1&explaintext=1&format=json&origin=*";

export async function fetchRandomArticles(
  count: number = 5
): Promise<WikiArticle[]> {
  const url = `${WIKI_API}&grnlimit=${count}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`);
  }

  const data: WikiApiResponse = await response.json();
  const pages = data.query?.pages;

  if (!pages) {
    return [];
  }

  return Object.values(pages)
    .filter((page) => page.extract)
    .map((page) => ({
      pageId: page.pageid,
      title: page.title,
      extract: page.extract!,
      url: page.fullurl,
    }));
}
