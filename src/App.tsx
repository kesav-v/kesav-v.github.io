import React, { useEffect } from "react";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import "./App.css";
import Home from "./components/Home";
import Engineering from "./components/Engineering";
import Chess from "./components/Chess";
import Music from "./components/Music";
import Slop from "./components/Slop";
import InfiniteChess from "./components/games/InfiniteChess";
import RankEverything from "./components/games/RankEverything";
import Clipify from "./components/games/Clipify";
import SpotifyOAuthHandler from "./components/SpotifyOAuthHandler";
import { hasSpotifyCallbackParams } from "./lib/spotifyAuth";

function AppContent() {
  const location = useLocation();
  const isChessboardActive = /^\/slop\/infinite-chess(\/|$)/.test(
    location.pathname
  );
  const isOAuthCallback = hasSpotifyCallbackParams();

  useEffect(() => {
    document.body.classList.toggle("scroll-locked", isChessboardActive);
    return () => {
      document.body.classList.remove("scroll-locked");
    };
  }, [isChessboardActive]);

  return (
    <div className={`App ${isChessboardActive ? "chessboard-active" : ""}`}>
      {isOAuthCallback ? (
        <main className="main-content">
          <SpotifyOAuthHandler />
        </main>
      ) : (
        <>
      {!isChessboardActive && (
        <nav className="nav-bar">
          <Link to="/" className="nav-link">
            Home
          </Link>
          <Link to="/engineering" className="nav-link">
            Engineering
          </Link>
          <Link to="/chess" className="nav-link">
            Chess
          </Link>
          <Link to="/music" className="nav-link">
            Music
          </Link>
          <Link to="/slop" className="nav-link">
            Slop
          </Link>
        </nav>
      )}
      <main className={isChessboardActive ? "main-content fullscreen" : "main-content"}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/engineering" element={<Engineering />} />
            <Route path="/chess" element={<Chess />} />
            <Route path="/music" element={<Music />} />
            <Route path="/slop" element={<Slop />} />
            <Route path="/slop/rank-everything" element={<RankEverything />} />
            <Route path="/slop/clipify" element={<Clipify />} />
            <Route path="/slop/infinite-chess" element={<InfiniteChess />} />
            <Route
              path="/slop/infinite-chess/:gameId"
              element={<InfiniteChess />}
            />
          </Routes>
        </main>
      </>
      )}
      </div>
    );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
