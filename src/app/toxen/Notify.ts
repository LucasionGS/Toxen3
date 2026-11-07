import type React from "react";
import { showNotification } from "@mantine/notifications";
import type { MessageCardOptions } from "../components/MessageCard/MessageCards";

/**
 * User-facing notifications (toasts). `Toxen.log`, `Toxen.warn`, `Toxen.error`, `Toxen.notify` and
 * `Toxen.sendError` delegate here.
 */
export class Notify {
  private constructor() { }

  /**
   * Predefined error messages and how long (ms) they stay on screen.
   */
  public static readonly PRESET_ERRORS = {
    CURRENTLY_EDITING_SONG: ["You are currently editing a song. Please save or cancel your changes.", 5000],
    CURRENTLY_EDITING_THEME: ["You are currently editing a theme. Please save or cancel your changes.", 5000],
    CURRENTLY_EDITING_SUBTITLES: ["You are currently editing subtitles. Please save or cancel your changes.", 5000],
  };

  /**
   * Show an info notification and log the message to the console.
   * @param message Content to show.
   * @param expiresIn Time in ms before it closes by itself. Stays open when omitted.
   * @returns The notification ID.
   */
  public static log(message: React.ReactNode, expiresIn?: number) {
    console.log(message);
    return Notify.notify({
      title: "Info",
      content: message,
      expiresIn: expiresIn,
      type: "normal",
    });
  }

  /**
   * Show a warning notification and log the message to the console.
   * @param message Content to show.
   * @param expiresIn Time in ms before it closes by itself. Stays open when omitted.
   */
  public static warn(message: React.ReactNode, expiresIn?: number) {
    console.warn(message);
    Notify.notify({
      title: "Warning",
      content: message,
      expiresIn: expiresIn,
      type: "warning",
    });
  }

  /**
   * Show an error notification and log the message to the console.
   * @param message Content to show.
   * @param expiresIn Time in ms before it closes by itself. Stays open when omitted.
   */
  public static error(message: React.ReactNode, expiresIn?: number) {
    console.error(message);
    Notify.notify({
      title: "Error",
      content: message,
      expiresIn: expiresIn,
      type: "error",
    });
  }

  /**
   * Show one of the predefined error messages.
   */
  public static sendError(error: Notify.PresetError) {
    const [message, expiresIn] = Notify.PRESET_ERRORS[error] as [string, number];
    return Notify.error(message, expiresIn);
  }

  /**
   * Send a notification.
   * @returns The notification ID.
   */
  public static notify(notification: Notify.Notification) {
    const id = Math.random().toString(36).substring(2);
    showNotification({
      id,
      message: notification.content,
      withCloseButton: !(notification.disableClose ?? false),
      autoClose: notification.expiresIn ?? false,
      title: notification.title,
      color: notification.type == "error" ? "red" : notification.type == "warning" ? "yellow" : "green",
    });
    return id;
  }
}

export namespace Notify {
  export type Notification = Omit<Omit<MessageCardOptions, "createdAt">, "uniqueId">;
  export type PresetError = keyof typeof Notify.PRESET_ERRORS;
}

export default Notify;
