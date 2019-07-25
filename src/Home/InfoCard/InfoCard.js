import React, { Component } from 'react';
import { Fab } from '@material-ui/core';
import { ExpandMore } from '@material-ui/icons';

import './InfoCard.css';
import { Link } from "react-scroll";

export default class InfoCard extends Component {

    render() {
        return (
            <div className="info-card-container">
                <div className="info-card-title">{this.props.title}</div>
                <div className="info-card-description">{this.props.description}</div>
                <hr />
                <div className="info-card-learn-more-container">
                    {
                        this.props.transition &&
                        <Link to={this.props.name} spy={true} smooth={true} offset={50} duration={500}>
                            <Fab
                                variant="outlined"
                                color="secondary"
                                className="learn-more"
                                onClick={this.props.onNext}
                            >
                                <ExpandMore />
                            </Fab>
                        </Link>
                    }
                </div>
            </div>
        )
    }
}