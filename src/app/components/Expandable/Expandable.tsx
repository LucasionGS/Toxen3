import React, { Component } from "react"
import "./Expandable.scss";

type Props = React.PropsWithChildren<{
  title: React.ReactNode;
  expanded?: boolean;
  disabled?: boolean;
  onToggle?: (newState: boolean) => void;
}>;

interface State {
  expanded: boolean;
  disabled: boolean;
}

export default class Expandable extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      expanded: props.expanded || false,
      disabled: props.disabled || false
    }

    console.log(this.props);
  }

  public toggle() {
    const newState = !this.state.expanded
    this.setState({ expanded: newState });

    if (this.props.onToggle) {
      this.props.onToggle(newState);
    }
  }

  render() {
    console.log(this.props);

    const { expanded } = this.state;
    const classList = [
      "expandable",
      expanded ? "expandable-expanded" : "expandable-collapsed"
    ];
    return (
      <div className={classList.join(" ")}>
        <div className="expandable-title"
          onClick={() => this.toggle()}
        >
          <span className="expandable-title-text">{this.props.title}</span>
          <span className="expandable-arrow">{"<"}</span>
        </div>
        <div className="expandable-content">
          {this.props.children}
        </div>
      </div>
    );
  }
}
