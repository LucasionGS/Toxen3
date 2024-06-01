import React, { Component } from 'react'
import Theme, { ThemeStyleTemplate } from '../../toxen/Theme'
import { Toxen } from '../../ToxenApp'
import Button from '../Button/Button';
import Expandable from '../Expandable/Expandable'
import SidepanelSectionHeader from '../Sidepanel/SidepanelSectionHeader';

interface State {

}

interface Props {

}

export default class ThemeEditorPanel extends Component<State, Props> {
  render() {
    const theme = Toxen.theme || new Theme();
    return (
      <div>
        <SidepanelSectionHeader>
          Theme Editor
          <Button onClick={
            () => {
              Toxen.theme.save();
              Toxen.setMode("Player");
            }
          }>Save and finish</Button>
        </SidepanelSectionHeader>
        {(() => {
          const sessions: JSX.Element[] = [];
          for (const sectionName in ThemeStyleTemplate) {
            if (Object.prototype.hasOwnProperty.call(ThemeStyleTemplate, sectionName)) {
              const section = ThemeStyleTemplate[sectionName];
              
              sessions.push(
                <Expandable key={sectionName} title={sectionName}>
                  <div>
                    {(() => {
                      const styles: JSX.Element[] = [];
                      for (const styleName in section) {
                        if (Object.prototype.hasOwnProperty.call(section, styleName)) {
                          const style = section[styleName];
                          styles.push(
                            <div key={styleName}>
                              <div>{style.title}</div>
                              <div>{style.description}</div>
                              <div>{style.type}</div>
                              <div>Value: {theme.styles[style.title]?.value}</div>
                            </div>
                          );
                        }
                      }
                      return styles;
                    })()}
                  </div>
                </Expandable>
              )
            }
          }
          return sessions;
        })()}
      </div>
    )
  }
}
