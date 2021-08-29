import { remote } from 'electron';
import React from 'react'

export default function ExternalUrl(props: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>) {
  return (
    <a {...props} onClick={e => {
      e.preventDefault();
      remote.shell.openExternal(props.href);
    }}></a>
  )
}
