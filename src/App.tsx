import React from "react";
import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import "./App.css";
import Home from "./components/Home";
import Engineering from "./components/Engineering";
import Chess from "./components/Chess";
import Music from "./components/Music";

function App() {
  return (
    <Router>
      <div className="App">
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
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/engineering" element={<Engineering />} />
            <Route path="/chess" element={<Chess />} />
            <Route path="/music" element={<Music />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
