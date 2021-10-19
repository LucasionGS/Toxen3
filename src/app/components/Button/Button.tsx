import React, { PropsWithChildren } from 'react'

interface Props extends React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, PropsWithChildren<{
  txStyle?: keyof typeof buttonStyles
  txDisabled?: boolean | (() => boolean);
  disabledTitle?: string;
}> {

}

export default class Button extends React.Component<Props> {
  constructor(props: Props) {
    super(props)
  }
  
  render() {
    const newProps = { ...this.props };
    const classes = [
      "tx-btn",
      this.props.className,
      buttonStyles[this.props.txStyle] ? buttonStyles[this.props.txStyle] : ""
    ].filter(a => a);

    // Special tx props
    newProps.className = classes.join(" ");
    delete newProps.txStyle;
    newProps.disabled = typeof this.props.txDisabled === "function" ? this.props.txDisabled() : (this.props.txDisabled ?? this.props.disabled);
    delete newProps.txDisabled;
    if (newProps.disabled && this.props.disabledTitle) newProps.title = this.props.disabledTitle;
    delete newProps.disabledTitle;

    return (
      <button {...newProps}>

      </button>
    )
  }
}

  const buttonStyles = {
    action: "tx-btn-action",
    warning: "tx-btn-warning",
    cancel: "tx-btn-cancel",
    next: "tx-btn-next",
  }