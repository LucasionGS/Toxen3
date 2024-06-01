import React from 'react'
import "./SidepanelSectionHeader.scss";

export default function SidepanelSectionHeader(props: {children?: React.ReactNode }) {
  return (
    <div className="sidepanel-section-header">
      {props.children}
    </div>
  )
}
