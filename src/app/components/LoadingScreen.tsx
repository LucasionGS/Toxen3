import React, { Component } from 'react'
import "./LoadingScreen.scss";

interface LoadingScreenProps {
  initialShow?: boolean;
  getRef?: (ref: LoadingScreen) => void;
}

interface LoadingScreenState {
  show: boolean;
}

export default class LoadingScreen extends Component<LoadingScreenProps, LoadingScreenState> {
  constructor(props: LoadingScreenProps) {
    super(props);

    this.state = {
      show: false
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
  
  render() {
    return (
      <div className={"toxen-loading-screen" + (this.state.show ? " toxen-loading-screen-show" : "")}>
        Now loading...
      </div>
    )
  }
}