import * as remote from "@electron/remote";
import React from 'react'
import Settings from '../../toxen/Settings';
import { Toxen } from '../../ToxenApp';

/**
 * Opens a URL/path in the default method.
 * On click, code executed is equalivant to:
 * ```ts
 * const { remote } = require('electron');
 * remote.shell.openExternal(href);
 * ```
 */
export default function ExternalUrl(props: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>) {
  return (
    <a {...props} title={props.href} onClick={e => {
      e.preventDefault();
      remote.shell.openExternal(props.href);
    }}
    onContextMenu={e => {
      e.preventDefault();
      remote.Menu.buildFromTemplate([
        {
          label: 'Open in browser',
          click: () => {
            remote.shell.openExternal(props.href);
          },
        },
        {
          label: 'Copy URL',
          click: () => {
            remote.clipboard.writeText(props.href);
            Toxen.notify({
              title: "Copied URL to clipboard",
              content: <ExternalUrl href={props.href}>{props.href}</ExternalUrl>,
              expiresIn: 3000,
            });
          }
        }
      ]).popup();
    }}
    ></a>
  )
}
