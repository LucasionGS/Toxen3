import React, { Component } from 'react'
import Time from '../toxen/Time';
import "./LoadingScreen.scss";
import MessageCard from './MessageCard/MessageCard';

interface LoadingScreenProps {
  initialShow?: boolean;
  getRef?: (ref: LoadingScreen) => void;
}

interface LoadingScreenState {
  show: boolean;
  content: React.ReactNode;
}

export default class LoadingScreen extends Component<LoadingScreenProps, LoadingScreenState> {
  constructor(props: LoadingScreenProps) {
    super(props);

    this.state = {
      show: false,
      // content: (<p className="center">Loading...</p>)
      content: (
        <MessageCard title="Title">
          Test content
        </MessageCard>
      )
    }
  }

  componentDidMount() {
    if (typeof this.props.initialShow === "boolean") this.toggleShow(this.props.initialShow);
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  toggleShow(force?: boolean) {
    this.setState({
      show: force ?? !this.state.show
    })
  }

  public setContent(content: React.ReactNode) {
    this.setState({
      content
    });
  }

  render() {
    return (
      <div className={"toxen-loading-screen" + (this.state.show ? " toxen-loading-screen-show" : "")}>
        <div className="toxen-loading-screen-content">
          {this.state.content}
        </div>
      </div>
    )
  }
}