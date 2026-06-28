import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import "./App.css";
import Home from "./components/Home";
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
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-link${isActive ? " nav-link--active" : ""}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/slop"
            className={({ isActive }) =>
              `nav-link${isActive ? " nav-link--active" : ""}`
            }
          >
            Slop
          </NavLink>
        </nav>
      )}
      <main className={isChessboardActive ? "main-content fullscreen" : "main-content"}>
          <Routes>
            <Route path="/" element={<Home />} />
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
