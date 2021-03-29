import React, { Component } from 'react'

interface LoadingScreenProps {
  id: number;
}

interface LoadingScreenState {
  showing: boolean;
}

export default class LoadingScreen extends Component<LoadingScreenProps, LoadingScreenState> {
  constructor(props: LoadingScreenProps) {
    super(props);

    this.state = {
      showing: true
    }
  }
  
  render() {
    return (
      <div>
        
      </div>
    )
  }
}