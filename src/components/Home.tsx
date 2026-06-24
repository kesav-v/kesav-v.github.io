import React from "react";
import About from "./About";

const Home: React.FC = () => {
  return (
    <div className="section">
      <h1>Welcome</h1>
      <p>
        I'm <a href="https://www.linkedin.com/in/kesav-viswanadha/">Kesav</a>.
      </p>
      <About />
    </div>
  );
};

export default Home;
