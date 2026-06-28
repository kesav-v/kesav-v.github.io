import React from "react";
import GameCard from "./GameCard";
import "../styles/GameCard.css";

const Slop: React.FC = () => {
  const games = [
    {
      title: "Infinite Chess",
      description:
    "Play infinite chess in a shared multiplayer world over WebSocket.",
      path: "/slop/infinite-chess",
      comingSoon: false,
    },
    {
      title: "Rank Everything",
      description:
        "Compare random Wikipedia articles head-to-head and build Elo rankings for everything you've judged.",
      path: "/slop/rank-everything",
      comingSoon: false,
    },
    {
      title: "Clipify",
      description:
        "Log in with Spotify and view all of your liked songs in a plain HTML table.",
      path: "/slop/clipify",
      comingSoon: false,
    },
  ];

  return (
    <div className="section">
      <h1>Slop</h1>
      <p>
        Random concepts I've thought of and asked AI to build for me.
        I cannot in good faith vouch for the quality of anything you might find here.
      </p>
      <div className="games-grid">
        {games.map((game) => (
          <GameCard
            key={game.path}
            title={game.title}
            description={game.description}
            path={game.path}
            comingSoon={game.comingSoon}
          />
        ))}
      </div>
    </div>
  );
};

export default Slop;

