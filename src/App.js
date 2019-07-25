import React from 'react';
import './App.css';
import Home from './Home/Home';
import MainLayout from './Layout/MainLayout';
import { BrowserRouter as Router, Route } from 'react-router-dom';

function App() {
    return (
        <Router>
            <Route exact path="" component={Home} />
            <Route exact path="/test" component={MainLayout} />
        </Router>
    );
}

export default App;