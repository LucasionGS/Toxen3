import React from 'react';
import Sidepanel from './Sidepanel';

interface Props {
  id: any;
  icon?: React.ReactElement<"i">;
  title?: string;
  separator?: boolean;
  scrollY?: number;
}

class SidepanelSection extends React.Component<Props> {

  render() {
    return (
      <div>
        {this.props.children}
      </div>
    )
  }
}

export default SidepanelSection;