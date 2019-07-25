import React, { Component } from 'react';
import './Home.css';

import { Element } from 'react-scroll';
import { Link } from '@material-ui/core';

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
            },
            {
                name: "Student",
                description: "3rd year EECS major at UC Berkeley. Go Bears!",
            },
            {
                name: "Developer",
                description: <span>Check out my <Link color="secondary" href="https://github.com/kesav-v">Github</Link>!</span>,
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
                {
                    this.infoCards.map((info, i) => (
                        <Element name={`info-card-${i}`}>
                            <InfoCard
                                title={info.name}
                                description={info.description}
                                transition={i !== this.infoCards.length - 1}
                                onNext={this.scrollToNextInfoCard}
                                name={`info-card-${i + 1}`}
                            />
                        </Element>
                    ))
                }

            </div>
        )
    }
}