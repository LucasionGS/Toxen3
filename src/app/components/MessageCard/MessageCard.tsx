import React, { Component } from 'react'
import Time from '../../toxen/Time';
import "./MessageCard.scss";

type MessageCardType = "normal" | "error" | "warning";

interface MessageCardProps {
  getRef?: ((ref: MessageCard) => void),
  title?: string;
  type?: MessageCardType;
}

interface MessageCardState {
  
}

export default class MessageCard extends Component<MessageCardProps, MessageCardState> {
  constructor(props: MessageCardProps) {
    super(props);

    this.state = {
      
    }
  }
  
  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  timeCreated = Time.now();
  
  render() {
    const {
      title,
      children
    } = this.props;
    return (
      <div className="message-card">
        {title ? <div>{title}</div> : ""}
        
        <div className="message-card-content">
          {children}
        </div>

        <div className="message-card-footer">
          {this.timeCreated.toTimestamp("hh:mm")}
        </div>
      </div>
    )
  }
}