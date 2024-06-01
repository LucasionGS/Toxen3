import React from 'react'
import "./PulsingLogo.scss";
//@ts-expect-error 
import txnLogo from "../../../icons/toxen.png";

export default function PulsingLogo() {
  return (
    <img className="pulsing-logo" src={txnLogo} alt="toxenLogo" />
  )
}
