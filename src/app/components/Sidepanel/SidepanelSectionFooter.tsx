import React from 'react'
import "./SidepanelSectionHeader.scss";

export default function SidepanelSectionFooter(props: {children?: React.ReactNode }) {
  return (
    <div className="sidepanel-section-footer">
      {props.children}
    </div>
  )
}
