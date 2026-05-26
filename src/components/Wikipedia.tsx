import React, { useCallback, useEffect, useState } from "react";
import { fetchRandomArticles, WikiArticle } from "../api/wikipedia";

const ARTICLE_COUNT = 5;

const Wikipedia: React.FC = () => {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchRandomArticles(ARTICLE_COUNT);
      setArticles(results);
    } catch {
      setError("Could not load articles. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  return (
    <div className="section wiki-page">
      <h2>Random Wikipedia</h2>
      <p className="wiki-intro">
        Discover random articles from English Wikipedia.
      </p>

      <button
        type="button"
        className="wiki-refresh-btn"
        onClick={loadArticles}
        disabled={loading}
      >
        {loading ? "Loading…" : "Load new articles"}
      </button>

      {error && <p className="wiki-error">{error}</p>}

      {!error && (
        <ul className="wiki-article-list">
          {loading && articles.length === 0
            ? Array.from({ length: ARTICLE_COUNT }, (_, i) => (
                <li key={i} className="wiki-article wiki-article--loading">
                  <div className="wiki-skeleton wiki-skeleton--title" />
                  <div className="wiki-skeleton wiki-skeleton--text" />
                  <div className="wiki-skeleton wiki-skeleton--text wiki-skeleton--short" />
                </li>
              ))
            : articles.map((article) => (
                <li key={article.pageId} className="wiki-article">
                  <h3>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {article.title}
                    </a>
                  </h3>
                  <p>{article.extract}</p>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
};

export default Wikipedia;
