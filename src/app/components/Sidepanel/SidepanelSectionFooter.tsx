import React from 'react'
import "./SidepanelSectionFooter.scss";

interface Props {
  children?: React.ReactNode | (() => React.ReactNode);
}

/**
 * A footer for a section in the sidepanel.
 * @param props Only takes children. If children is a function, it will be called to render the children. Useful for dynamic content.
 */
export default function SidepanelSectionFooter(props: Props) {
  return (
    <div className="sidepanel-section-footer">
      {typeof props.children === "function" ? props.children() : props.children}
    </div>
  )
}
