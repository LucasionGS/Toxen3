import React from 'react';

interface Props {
  id: any;
  icon?: React.ReactElement<"i">;
  title?: string;
  separator?: boolean;
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