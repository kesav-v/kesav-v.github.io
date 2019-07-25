import React, { Component } from 'react';
import './Home.css';

import InfoCard from './InfoCard/InfoCard';

export default class Home extends Component {

    constructor(props) {
        super(props);
        this.state = {
            cardIndex: 0,
        };
        this.infoCards = [
            {
                name: "Hello, world!",
                description: "I'm Kesav.",
                transition: "Who??",
            },
            {
                name: "Student",
                description: "3rd year EECS major at UC Berkeley. Go Bears!",
                transition: "What else??",
            },
            {
                name: "Developer",
                description: "Check out my Github!",
            }
        ]
    }

    scrollToNextInfoCard = () => {
        this.setState({

        })
    };

    render() {
        return (
            <div className="home-container">
                <InfoCard
                    title="Hello, world!"
                    description="I'm Kesav."
                    transitionText="Who??"
                    onNext={this.scrollToNextInfoCard}
                />
            </div>
        )
    }
}