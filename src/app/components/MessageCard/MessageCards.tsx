import React, { Component } from 'react'
import Time from '../../toxen/Time';
import "./MessageCards.scss";

type MessageCardType = "normal" | "error" | "warning";

interface MessageCardsProps {
}

interface MessageCardsState {
  messages: MessageCardOptions[];
}

interface MessageCardProps {
  title?: string;
  type?: MessageCardType;
  uniqueId: string;
  /**
   * Time in milliseconds to wait before removing the message.
   */
  expiresIn?: number;
  disableClose?: boolean;
}

export interface MessageCardOptions extends Omit<MessageCardProps, "listRef"> {
  content: React.ReactNode;
  createdAt: number;
}

interface MessageCardState {
  isClosing: boolean;
}