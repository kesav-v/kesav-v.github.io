import React from "react";
import { Link } from "react-router-dom";
import "../styles/GameCard.css";

interface GameCardProps {
  title: string;
  description: string;
  path: string;
  comingSoon?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({
  title,
  description,
  path,
  comingSoon = false,
}) => {
  return (
    <Link
      to={comingSoon ? "#" : path}
      className={`game-card ${comingSoon ? "coming-soon" : ""}`}
    >
      <div className="game-card-content">
        <h3>{title}</h3>
        <p>{description}</p>
        {comingSoon && <span className="coming-soon-badge">Coming Soon</span>}
      </div>
    </Link>
  );
};

export default GameCard;
