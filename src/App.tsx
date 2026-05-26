import React, { useEffect } from "react";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import "./App.css";
import Home from "./components/Home";
import Engineering from "./components/Engineering";
import Chess from "./components/Chess";
import Music from "./components/Music";
import Games from "./components/Games";
import InfiniteChess from "./components/games/InfiniteChess";
import RankEverything from "./components/games/RankEverything";

function AppContent() {
  const location = useLocation();
  const isChessboardActive = location.pathname.includes("/games/infinite-chess");

  useEffect(() => {
    const { documentElement: html, body } = document;
    if (isChessboardActive) {
      html.classList.add("scroll-locked");
      body.classList.add("scroll-locked");
    } else {
      html.classList.remove("scroll-locked");
      body.classList.remove("scroll-locked");
    }
    return () => {
      html.classList.remove("scroll-locked");
      body.classList.remove("scroll-locked");
    };
  }, [isChessboardActive]);

  return (
    <div className={`App ${isChessboardActive ? "chessboard-active" : ""}`}>
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
          <Link to="/games" className="nav-link">
            Games
          </Link>
        </nav>
      )}
      <main className={isChessboardActive ? "main-content fullscreen" : "main-content"}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/engineering" element={<Engineering />} />
            <Route path="/chess" element={<Chess />} />
            <Route path="/music" element={<Music />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/rank-everything" element={<RankEverything />} />
            <Route path="/games/infinite-chess" element={<InfiniteChess />} />
            <Route
              path="/games/infinite-chess/:gameId"
              element={<InfiniteChess />}
            />
          </Routes>
        </main>
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
