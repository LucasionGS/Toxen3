import React, { Component } from 'react'
import Time from '../../toxen/Time';
import "./MessageCards.scss";

type MessageCardType = "normal" | "error" | "warning";

interface MessageCardsProps {
}

interface MessageCardsState {
  messages: MessageCardOptions[];
}

export class MessageCards extends Component<MessageCardsProps, MessageCardsState> {
  constructor(props: MessageCardsProps) {
    super(props);
    this.state = {
      messages: []
    };
  }

  public addMessage(message: Omit<Omit<MessageCardOptions, "createdAt">, "uniqueId">) {
    const newMessage: MessageCardOptions = {
      ...message,
      createdAt: Date.now(),
      uniqueId: Math.random().toString(36).substring(2, 15), // Unique identifier to find and delete correct message.
    };
    this.setState({
      messages: [newMessage, ...this.state.messages]
    });
  }

  public render() {
    return (
      <div className="message-cards">
        {this.state.messages.map(msg => {
          return (
            <MessageCard
              key={msg.createdAt}
              title={msg.title}
              type={msg.type}
              listRef={{ current: this }}
              uniqueId={msg.uniqueId}
              expiresIn={msg.expiresIn}
              disableClose={msg.disableClose}
            >
              {msg.content}
            </MessageCard>
          );
        })}
      </div>
    );
  }
}

interface MessageCardProps {
  title?: string;
  type?: MessageCardType;
  listRef: React.RefObject<MessageCards>;
  uniqueId: string;
  /**
   * Time in milliseconds to wait before removing the message.
   */
  expiresIn?: number;
  disableClose?: boolean;
}

interface MessageCardOptions extends Omit<MessageCardProps, "listRef"> {
  content: React.ReactNode;
  createdAt: number;
}

interface MessageCardState {

}

class MessageCard extends Component<MessageCardProps, MessageCardState> {
  constructor(props: MessageCardProps) {
    super(props);

    this.state = {

    }
  }

  componentDidMount() {
  }

  timeCreated = Time.now();

  close() {
    this.props.listRef.current.setState({
      messages: this.props.listRef.current.state.messages.filter(msg => msg.uniqueId !== this.props.uniqueId)
    });
  }

  render() {
    const {
      title,
      children,
      type
    } = this.props;

    if (this.props.expiresIn) {
      setTimeout(() => {
        this.close();
      }, this.props.expiresIn);
    }
    
    return (
      <div className={"message-card message-card-type-" + (type || "normal")}>
        {!this.props.disableClose ? (<div className="message-card-close" onClick={
          () => {
            this.close();
          }
        } />): ""}
        {title ? <div className="message-card-title">{title}</div> : ""}

        <div className="message-card-content">
          {children}
        </div>

        <div className="message-card-footer">
          {this.timeCreated.toTimestamp("hh:mm:ss")}
        </div>
      </div>
    )
  }
}