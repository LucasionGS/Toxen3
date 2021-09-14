import React, { PropsWithChildren } from 'react'

interface Props extends React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, PropsWithChildren<{
  txStyle?: keyof typeof buttonStyles
}> {

}

export default function Button(props: Props) {
  const newProps = { ...props };
  newProps.className = `${props.className ? props.className + " tx-btn" : "tx-btn"} ${buttonStyles[props.txStyle] ? buttonStyles[props.txStyle] : ""}`;
  delete newProps.txStyle;
  
  return (
    <button {...newProps}>

    </button>
  )
}

const buttonStyles = {
  action: "tx-btn-action",
  warning: "tx-btn-warning",
  cancel: "tx-btn-cancel",
  next: "tx-btn-next",
}