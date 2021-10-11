import React, { Component } from "react"
import Theme from "../../toxen/Theme"

interface Props {

}

interface State {
  theme: Theme;
}

export default class ThemeContainer extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      theme: null
    }
  }

  render() {
    return (
      <div style={{
        display: "none"
      }}>
        {this.state.theme}
      </div>
    )
  }
}
