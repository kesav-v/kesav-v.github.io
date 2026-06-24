import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  categoryDisplayName,
  fetchRandomPair,
  normalizeCategoryTitle,
  searchCategories,
  WikiArticle,
  WikiCategory,
} from "../../api/wikipedia";
import {
  loadSavedCategory,
  POPULAR_CATEGORIES,
  saveCategory,
} from "../../lib/rankCategory";
import {
  getArticleElo,
  getRankings,
  RatedArticle,
  recordVote,
} from "../../lib/wikiElo";

const RankEverything: React.FC = () => {
  const [pair, setPair] = useState<[WikiArticle, WikiArticle] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [showRankings, setShowRankings] = useState(false);
  const [rankings, setRankings] = useState<RatedArticle[]>([]);
  const [lastVote, setLastVote] = useState<{
    winner: string;
    loser: string;
    winnerDelta: number;
    loserDelta: number;
  } | null>(null);

  const [activeCategory, setActiveCategory] = useState<string | null>(
    loadSavedCategory
  );
  const [categoryQuery, setCategoryQuery] = useState(() => {
    const saved = loadSavedCategory();
    return saved ? categoryDisplayName(saved) : "";
  });
  const [suggestions, setSuggestions] = useState<WikiCategory[]>([]);
  const [searchingCategories, setSearchingCategories] = useState(false);

  const refreshRankings = useCallback(() => {
    setRankings(getRankings());
  }, []);

  const loadPair = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastVote(null);
    try {
      const next = await fetchRandomPair(activeCategory);
      setPair(next);
      setExplanation("");
    } catch {
      const label = activeCategory
        ? categoryDisplayName(activeCategory)
        : "Wikipedia";
      setError(
        `Could not load articles from ${label}. Try another category or skip.`
      );
      setPair(null);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    loadPair();
  }, [loadPair]);

  useEffect(() => {
    if (showRankings) refreshRankings();
  }, [showRankings, refreshRankings]);

  useEffect(() => {
    const trimmed = categoryQuery.trim().replace(/^category:/i, "");
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setSearchingCategories(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchCategories(trimmed);
        if (!cancelled) setSuggestions(results);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearchingCategories(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [categoryQuery]);

  const applyCategory = (category: string | null) => {
    setActiveCategory(category);
    saveCategory(category);
    if (category) {
      setCategoryQuery(categoryDisplayName(category));
    } else {
      setCategoryQuery("");
    }
    setSuggestions([]);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeCategoryTitle(categoryQuery);
    if (normalized === activeCategory) {
      loadPair();
      return;
    }
    applyCategory(normalized);
  };

  const handleVote = async (winner: WikiArticle, loser: WikiArticle) => {
    const result = recordVote(
      winner,
      loser,
      explanation.trim() || undefined
    );
    setLastVote({
      winner: result.winner.title,
      loser: result.loser.title,
      winnerDelta: result.winner.elo - result.comparison.winnerEloBefore,
      loserDelta: result.loser.elo - result.comparison.loserEloBefore,
    });
    refreshRankings();
    await loadPair();
  };

  const renderArticleCard = (
    article: WikiArticle,
    opponent: WikiArticle,
    side: "left" | "right"
  ) => {
    const elo = getArticleElo(article.pageId);
    return (
      <article className={`rank-card rank-card--${side}`}>
        <div className="rank-card-meta">
          <span className="rank-elo">{elo} Elo</span>
        </div>
        <h3>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            {article.title}
          </a>
        </h3>
        <div
          className="rank-extract-wrap"
          tabIndex={0}
          aria-label="Article preview"
        >
          <p className="rank-extract">{article.extract}</p>
        </div>
        <button
          type="button"
          className="rank-pick-btn"
          disabled={loading}
          onClick={() => handleVote(article, opponent)}
        >
          Pick this one
        </button>
      </article>
    );
  };

  return (
    <div className="section wiki-page rank-page">
      <div className="rank-header">
        <Link to="/slop" className="rank-back-link">
          ← Slop
        </Link>
        <div className="rank-header-row">
          <h2>Rank Everything</h2>
          <div className="rank-toolbar">
            <button
              type="button"
              className={`wiki-refresh-btn rank-toggle-btn ${
                showRankings ? "rank-toggle-btn--active" : ""
              }`}
              onClick={() => setShowRankings((v) => !v)}
            >
              {showRankings ? "Hide" : "Rankings"}
            </button>
            <button
              type="button"
              className="wiki-refresh-btn rank-secondary-btn"
              onClick={loadPair}
              disabled={loading}
            >
              Skip
            </button>
          </div>
        </div>

        <section className="rank-category" aria-label="Category filter">
          <p className="rank-category-label">Category</p>
          <div className="rank-category-modes">
            <button
              type="button"
              className={`rank-category-mode ${
                activeCategory === null ? "rank-category-mode--active" : ""
              }`}
              onClick={() => applyCategory(null)}
            >
              All Wikipedia
            </button>
            {POPULAR_CATEGORIES.map((cat) => (
              <button
                key={cat.title}
                type="button"
                className={`rank-category-mode ${
                  activeCategory === cat.title
                    ? "rank-category-mode--active"
                    : ""
                }`}
                onClick={() => applyCategory(cat.title)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <form className="rank-category-form" onSubmit={handleCategorySubmit}>
            <input
              type="search"
              className="rank-category-input"
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              placeholder="Search categories (e.g. Astronomy, Dogs)…"
              aria-label="Search Wikipedia categories"
              autoComplete="off"
            />
            <button
              type="submit"
              className="wiki-refresh-btn rank-category-apply"
              disabled={!categoryQuery.trim()}
            >
              Apply
            </button>
          </form>

          {searchingCategories && (
            <p className="rank-category-hint">Searching…</p>
          )}

          {!searchingCategories && suggestions.length > 0 && (
            <ul className="rank-category-suggestions">
              {suggestions.map((cat) => (
                <li key={cat.title}>
                  <button
                    type="button"
                    className="rank-category-suggestion"
                    onClick={() => applyCategory(cat.title)}
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="rank-category-active">
            {activeCategory
              ? `Comparing articles in: ${categoryDisplayName(activeCategory)}`
              : "Comparing random articles from all of Wikipedia"}
          </p>
        </section>
      </div>

      {error && <p className="wiki-error">{error}</p>}

      <section className="rank-matchup" aria-label="Article comparison">
        {loading && !pair ? (
          <div className="rank-versus rank-versus--loading">
            <div className="rank-card rank-card--loading" />
            <div className="rank-vs">vs</div>
            <div className="rank-card rank-card--loading" />
          </div>
        ) : pair ? (
          <div className={`rank-versus ${loading ? "rank-versus--busy" : ""}`}>
            {renderArticleCard(pair[0], pair[1], "left")}
            <div className="rank-vs">vs</div>
            {renderArticleCard(pair[1], pair[0], "right")}
          </div>
        ) : null}
      </section>

      {lastVote && (
        <p className="rank-vote-feedback">
          <strong>{lastVote.winner}</strong> (
          {lastVote.winnerDelta >= 0 ? "+" : ""}
          {lastVote.winnerDelta}) beat <strong>{lastVote.loser}</strong> (
          {lastVote.loserDelta})
        </p>
      )}

      <label className="rank-explanation-label">
        Explanation <span className="rank-optional">(optional)</span>
        <textarea
          className="rank-explanation-input"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Why did you pick one over the other?"
          rows={2}
          disabled={loading}
        />
      </label>

      {showRankings && (
        <section className="rank-leaderboard">
          <h3>Rankings ({rankings.length} articles)</h3>
          {rankings.length === 0 ? (
            <p className="rank-empty">No rated articles yet. Vote on a pair!</p>
          ) : (
            <ol className="rank-leaderboard-list">
              {rankings.map((item, index) => (
                <li key={item.pageId} className="rank-leaderboard-row">
                  <span className="rank-place">{index + 1}</span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rank-leaderboard-title"
                  >
                    {item.title}
                  </a>
                  <span className="rank-leaderboard-elo">{item.elo}</span>
                  <span className="rank-leaderboard-record">
                    {item.wins}W–{item.losses}L
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
};

export default RankEverything;
