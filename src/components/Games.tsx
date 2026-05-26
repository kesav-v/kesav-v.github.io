import React from "react";
import GameCard from "./GameCard";
import "../styles/GameCard.css";

const Games: React.FC = () => {
  const games = [
    {
      title: "Infinite Chess",
      description:
        "Play infinite chess against an AI opponent or challenge your friends in real-time matches.",
      path: "/games/infinite-chess",
      comingSoon: false,
    },
    {
      title: "Rank Everything",
      description:
        "Compare random Wikipedia articles head-to-head and build Elo rankings for everything you've judged.",
      path: "/games/rank-everything",
      comingSoon: false,
    },
  ];

  return (
    <div className="section">
      <h1>Games</h1>
      <p>Check out these interactive games I've implemented:</p>
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

export default Games;

