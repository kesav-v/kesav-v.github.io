import { WikiArticle } from "../api/wikipedia";

export const DEFAULT_ELO = 1200;
const K_FACTOR = 32;
const STORAGE_KEY = "rank-everything-elo";

export interface RatedArticle {
  pageId: number;
  title: string;
  url: string;
  elo: number;
  wins: number;
  losses: number;
}

export interface ComparisonRecord {
  id: string;
  timestamp: number;
  winnerId: number;
  loserId: number;
  winnerTitle: string;
  loserTitle: string;
  explanation?: string;
  winnerEloBefore: number;
  loserEloBefore: number;
  winnerEloAfter: number;
  loserEloAfter: number;
}

interface WikiEloStore {
  articles: Record<string, RatedArticle>;
  comparisons: ComparisonRecord[];
}

function loadStore(): WikiEloStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { articles: {}, comparisons: [] };
    return JSON.parse(raw) as WikiEloStore;
  } catch {
    return { articles: {}, comparisons: [] };
  }
}

function saveStore(store: WikiEloStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function computeEloUpdate(
  winnerRating: number,
  loserRating: number
): { winnerNew: number; loserNew: number } {
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);
  return {
    winnerNew: Math.round(winnerRating + K_FACTOR * (1 - expectedWinner)),
    loserNew: Math.round(loserRating + K_FACTOR * (0 - expectedLoser)),
  };
}

function getOrCreateRated(
  store: WikiEloStore,
  article: WikiArticle
): RatedArticle {
  const key = String(article.pageId);
  const existing = store.articles[key];
  if (existing) return existing;

  const rated: RatedArticle = {
    pageId: article.pageId,
    title: article.title,
    url: article.url,
    elo: DEFAULT_ELO,
    wins: 0,
    losses: 0,
  };
  store.articles[key] = rated;
  return rated;
}

export interface VoteResult {
  winner: RatedArticle;
  loser: RatedArticle;
  comparison: ComparisonRecord;
}

export function recordVote(
  winnerArticle: WikiArticle,
  loserArticle: WikiArticle,
  explanation?: string
): VoteResult {
  const store = loadStore();
  const winner = getOrCreateRated(store, winnerArticle);
  const loser = getOrCreateRated(store, loserArticle);

  const winnerEloBefore = winner.elo;
  const loserEloBefore = loser.elo;
  const { winnerNew, loserNew } = computeEloUpdate(winnerEloBefore, loserEloBefore);

  winner.elo = winnerNew;
  winner.wins += 1;
  loser.elo = loserNew;
  loser.losses += 1;

  const comparison: ComparisonRecord = {
    id: `${Date.now()}-${winner.pageId}-${loser.pageId}`,
    timestamp: Date.now(),
    winnerId: winner.pageId,
    loserId: loser.pageId,
    winnerTitle: winner.title,
    loserTitle: loser.title,
    explanation: explanation?.trim() || undefined,
    winnerEloBefore,
    loserEloBefore,
    winnerEloAfter: winnerNew,
    loserEloAfter: loserNew,
  };

  store.comparisons.push(comparison);
  saveStore(store);

  return { winner, loser, comparison };
}

export function getRankings(): RatedArticle[] {
  const store = loadStore();
  return Object.values(store.articles).sort((a, b) => b.elo - a.elo);
}

export function getArticleElo(pageId: number): number {
  const store = loadStore();
  return store.articles[String(pageId)]?.elo ?? DEFAULT_ELO;
}
