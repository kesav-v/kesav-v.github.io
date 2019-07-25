import React, { Component } from 'react';
import { Button } from '@material-ui/core';

import './InfoCard.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleDown } from "@fortawesome/free-solid-svg-icons";

export default class InfoCard extends Component {

    render() {
        return (
            <div className="info-card-container">
                <div className="info-card-title">{this.props.title}</div>
                <div className="info-card-description">{this.props.description}</div>
                <div className="info-card-learn-more-container">
                    {
                        this.props.transitionText &&
                        <Button
                            variant="outlined"
                            color="secondary"
                            className="learn-more"
                            onClick={this.props.onNext}
                        >
                            <span className="learn-more">{this.props.transitionText}</span>
                            <FontAwesomeIcon icon={faAngleDown} />
                        </Button>
                    }
                </div>
            </div>
        )
    }
}