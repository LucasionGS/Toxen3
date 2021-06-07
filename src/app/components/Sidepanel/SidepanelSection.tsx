import React from 'react';
import Sidepanel from './Sidepanel';

interface Props {
  id: any;
  icon?: React.ReactElement<"i">;
  title?: string;
  separator?: boolean;
  scrollY?: number;
  dynamicContent?: (section: SidepanelSection) => React.ReactNode;
}

class SidepanelSection extends React.Component<Props> {
  render() {
    return (
      <div>
        {typeof this.props.dynamicContent === "function" ? this.props.dynamicContent(this) : this.props.children}
      </div>
    )
  }
}

export default SidepanelSection;