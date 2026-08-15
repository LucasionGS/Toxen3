import { Toxen } from "../ToxenApp";

interface Shortcut {
  /** Lowercased `KeyboardEvent.key` this shortcut fires on. */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Shown to the user when listing shortcuts. */
  description: string;
  action: () => void;
}

export const shortcuts: Shortcut[] = [
  {
    key: "f",
    ctrl: true,
    description: "Search the track list",
    action: () => Toxen.focusSongSearch(),
  },
  {
    key: "f",
    ctrl: true,
    shift: true,
    description: "Scroll to the playing track",
    action: () => Toxen.showCurrentSong(),
  },
];

/**
 * Binds the application-wide shortcuts. Listens in the capture phase so a panel
 * or a focused field can't swallow a combination before it is handled.
 */
export function attachShortcuts(target: Window | Document = window) {
  const handler = (e: KeyboardEvent) => {
    const key = e.key?.toLowerCase();
    if (!key) return;

    const match = shortcuts.find(s => (
      s.key === key
      && !!s.ctrl === (e.ctrlKey || e.metaKey)
      && !!s.shift === e.shiftKey
      && !!s.alt === e.altKey
    ));
    if (!match) return;

    e.preventDefault();
    e.stopPropagation();
    match.action();
  };

  target.addEventListener("keydown", handler, true);
  return function detachShortcuts() {
    target.removeEventListener("keydown", handler, true);
  };
}
