import React from 'react'
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

      if (toxenapi.isDesktop()) {
        toxenapi.remote.shell.openExternal(props.href);
      }
      else {
        window.open(props.href, "_blank");
      }
    }}
    onContextMenu={e => {
      e.preventDefault();
      if (toxenapi.isDesktop()) {
        toxenapi.remote.Menu.buildFromTemplate([
          {
            label: 'Open in browser',
            click: () => {
              toxenapi.remote.shell.openExternal(props.href);
            },
          },
          {
            label: 'Copy URL',
            click: () => {
              toxenapi.remote.clipboard.writeText(props.href);
              Toxen.notify({
                title: "Copied URL to clipboard",
                content: <ExternalUrl href={props.href}>{props.href}</ExternalUrl>,
                expiresIn: 3000,
              });
            }
          }
        ]).popup();
      }
      else {
        navigator.clipboard.writeText(props.href);
        Toxen.notify({
          title: "Copied URL to clipboard",
          content: <ExternalUrl href={props.href}>{props.href}</ExternalUrl>,
          expiresIn: 3000,
        });
      }
    }}
    ></a>
  )
}
