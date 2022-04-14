import React, { Component } from "react"
import "./Expandable.scss";

type Props = React.PropsWithChildren<{
  title: React.ReactNode;
  expanded?: boolean;
  disabled?: boolean;
  showArrow?: boolean;
  showBorder?: boolean;
  onClick?: () => void;
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
  }

  public toggle(force? :boolean) {
    const newState = force ?? !this.state.expanded;
    this.setState({ expanded: newState });
  }

  render() {
    const { expanded } = this.state;
    const classList = [
      "expandable",
      expanded ? "expandable-expanded" : "expandable-collapsed",
      !this.props.showBorder ? "expandable-no-border" : null,
    ].filter(a => a);
    return (
      <div className={classList.join(" ")}>
        <div className="expandable-title"
          onClick={() => {
            if (!this.state.disabled) this.toggle();

            if (this.props.onClick) this.props.onClick();
          }}
        >
          <span className="expandable-title-text">{this.props.title}</span>
          {(this.props.showArrow ?? true) && (
            <span className="expandable-arrow">{"◀"}</span>
          )}
        </div>
        <div className="expandable-content">
          {this.props.children}
        </div>
      </div>
    );
  }
}
