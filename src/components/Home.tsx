import React from "react";
import GameCard from "./GameCard";
import "../styles/GameCard.css";

const Home: React.FC = () => {
  const games = [
    {
      title: "Chess",
      description:
        "Play chess against an AI opponent or challenge your friends in real-time matches.",
      path: "/games/chess",
      comingSoon: true,
    },
    {
      title: "2048",
      description:
        "A classic sliding puzzle game. Combine tiles to reach 2048!",
      path: "/games/2048",
      comingSoon: true,
    },
    {
      title: "Snake",
      description:
        "Guide the snake to eat food and grow longer without hitting walls or itself.",
      path: "/games/snake",
      comingSoon: true,
    },
    {
      title: "Tetris",
      description:
        "The classic block-stacking puzzle game. Clear lines to score points!",
      path: "/games/tetris",
      comingSoon: true,
    },
    {
      title: "Minesweeper",
      description:
        "Clear the minefield without detonating any mines. Use logic to win!",
      path: "/games/minesweeper",
      comingSoon: true,
    },
    {
      title: "Wordle",
      description:
        "Guess the five-letter word in six tries. Color hints guide your way!",
      path: "/games/wordle",
      comingSoon: true,
    },
  ];

  return (
    <div className="section">
      <h1>Welcome to Kesav V's Website</h1>
      <p>
        Hello! I'm Kesav, and I'm passionate about engineering, chess, and
        music. Explore the different sections of my site to learn more about my
        interests and projects.
      </p>

      <h2>Games</h2>
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

export default Home;
