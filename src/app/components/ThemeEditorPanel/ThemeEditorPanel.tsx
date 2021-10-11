import React, { Component } from 'react'
import { ThemeStyleTemplate } from '../../toxen/Theme'
import Expandable from '../Expandable/Expandable'

interface State {

}

interface Props {

}

export default class ThemeEditorPanel extends Component<State, Props> {
  render() {
    return (
      <div>
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
