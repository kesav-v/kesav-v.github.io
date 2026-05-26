import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRandomPair, WikiArticle } from "../../api/wikipedia";
import {
  DEFAULT_ELO,
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

  const refreshRankings = useCallback(() => {
    setRankings(getRankings());
  }, []);

  const loadPair = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastVote(null);
    try {
      const next = await fetchRandomPair();
      setPair(next);
      setExplanation("");
    } catch {
      setError("Could not load articles. Please try again.");
      setPair(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPair();
  }, [loadPair]);

  useEffect(() => {
    if (showRankings) refreshRankings();
  }, [showRankings, refreshRankings]);

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
        <p className="rank-extract">{article.extract}</p>
        <button
          type="button"
          className="rank-pick-btn"
          disabled={loading}
          onClick={() => handleVote(article, opponent)}
        >
          This one is better
        </button>
      </article>
    );
  };

  return (
    <div className="section wiki-page rank-page">
      <div className="rank-header">
        <Link to="/games" className="rank-back-link">
          ← Games
        </Link>
        <h2>Rank Everything</h2>
        <p className="wiki-intro">
          Pick the better Wikipedia article. Each article starts at {DEFAULT_ELO}{" "}
          Elo and moves up or down based on your choices.
        </p>
        <div className="rank-toolbar">
          <button
            type="button"
            className={`wiki-refresh-btn rank-toggle-btn ${
              showRankings ? "rank-toggle-btn--active" : ""
            }`}
            onClick={() => setShowRankings((v) => !v)}
          >
            {showRankings ? "Hide rankings" : "Show rankings"}
          </button>
          <button
            type="button"
            className="wiki-refresh-btn rank-secondary-btn"
            onClick={loadPair}
            disabled={loading}
          >
            Skip pair
          </button>
        </div>
      </div>

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

      {lastVote && (
        <p className="rank-vote-feedback">
          Recorded: <strong>{lastVote.winner}</strong> (
          {lastVote.winnerDelta >= 0 ? "+" : ""}
          {lastVote.winnerDelta}) beat <strong>{lastVote.loser}</strong> (
          {lastVote.loserDelta})
        </p>
      )}

      {error && <p className="wiki-error">{error}</p>}

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
    </div>
  );
};

export default RankEverything;
