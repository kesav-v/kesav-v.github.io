import React from "react";
import Engineering from "./Engineering";
import Chess from "./Chess";
import Music from "./Music";

const Home: React.FC = () => {
  return (
    <div className="section">
      <h1>Welcome</h1>
      <p>
        I'm <a href="https://www.linkedin.com/in/kesav-viswanadha/">Kesav</a>.
      </p>
      <Engineering />
      <Chess />
      <Music />
    </div>
  );
};

export default Home;
