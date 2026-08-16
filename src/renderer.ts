import "@mantine/core/styles.css";
// NOTE: @mantine/notifications/styles.css is deliberately NOT imported.
// Its root rule is `position: fixed; width: calc(100% - 2 * spacing.md)` with no
// `pointer-events: none`, which combines with the inline styles on <Notifications>
// in ToxenApp.tsx to cover the whole window and swallow every click.
// Notifications are styled by those inline styles and app SCSS instead.
// Adopting the stylesheet requires reworking that inline style block first.
import "./root.scss";
import "./app";