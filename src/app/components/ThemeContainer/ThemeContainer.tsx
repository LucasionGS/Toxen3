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

  setTheme(theme: Theme) {
    this.setState({
      theme: theme
    })
  }

  render() {
    if (!this.state.theme) return (<></>);
    return (
      <style>
        {Theme.parseToCSS(this.state.theme)}
      </style>
    )
  }
}
