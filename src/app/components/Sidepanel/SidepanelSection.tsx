import React from 'react';
import { Toxen } from '../../ToxenApp';
import Sidepanel from './Sidepanel';

interface Props {
  id: any;
  icon?: React.ReactElement<"i">;
  title?: string;
  separator?: boolean;
  scrollY?: number;
  dynamicContent?: (section: SidepanelSection) => React.ReactNode | Promise<React.ReactNode>;
}

interface State {
  content: React.ReactNode;
}

class SidepanelSection extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const content = typeof this.props.dynamicContent === "function" ? this.props.dynamicContent(this) : this.props.children
    if (content instanceof Promise) {
      this.state = { content: "Loading..." };
      content.then((content) => {
        this.setState({ content });
      })
      .catch((error) => {
        this.setState({ content: "Something went wrong during the loading." });
        Toxen.error(error);
      });
    }
    else this.state = { content: content };
  }
  
  render() {
    return (
      <div>
        {this.state.content}
      </div>
    )
  }
}

export default SidepanelSection;