import React from 'react';
import Settings from '../../toxen/Settings';
import { remote } from "electron";
import "./SettingsInput.css";
import SettingsInputCheckbox from './SettingsInputCheckbox';


type Props = [
  PropsTypeText,
  PropsTypeFile,
  PropsTypeFolder,
  PropsTypeCheckbox,
][number];

interface PropsTemplate<T extends string> {
  name: string;
  type: T;
  displayName?: string;
}

interface PropsTypeText extends PropsTemplate<"text"> { }

interface PropsTypeFile extends PropsTemplate<"file"> { }

interface PropsTypeFolder extends PropsTemplate<"folder"> { }

interface PropsTypeCheckbox extends PropsTemplate<"checkbox"> { }

export default class SettingsInput extends React.Component<Props> {

  public static getNameAndType(nameAndType: string) {
    let type: string = null;
    if (nameAndType.indexOf("*") > -1) {
      [nameAndType, type] = nameAndType.split("*"); // Assign special type.
    }
    return {
      name: nameAndType,
      type
    };
  }

  public static getValue(type: string, value: any): any {
    switch (type) {
      case "number":
        return Number(value);

      case "boolean":
        if (value === "1") return true;
        if (value === "0") return false;
        return Boolean(value);

      case "string":
        return String(value);
    }
  }

  render() {
    let { name } = SettingsInput.getNameAndType(this.props.name);
    let value: any = "";
    if (Settings.data) {
      value = (Settings.data as any)[name] ?? "";
    }
    let label = (<label htmlFor={this.props.name}>{this.props.displayName ? this.props.displayName : name}</label>);
    switch (this.props.type) {
      case "text": {
        return (
          <>
            {label}
            <br />
            <input className="tx-form-field" type="text" name={this.props.name} defaultValue={value} />
            <br />
            <br />
          </>
        )
      }
      
      case "file": {
        const ref = React.createRef<HTMLInputElement>();
        return (
          <>
            {label}
            <br />
            <input ref={ref} className="tx-form-field" type="text" readOnly name={this.props.name} defaultValue={value} onClick={
              () => {
                let value = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
                  properties: [
                    'openFile'
                  ]
                });
                if (value) {
                  ref.current.value = value[0];
                }
              }
            }/>
            <br />
            <br />
          </>
        )
      }
      
      case "folder": {
        const ref = React.createRef<HTMLInputElement>();
        return (
          <>
            {label}
            <br />
            <input ref={ref} className="tx-form-field" type="text" readOnly name={this.props.name} defaultValue={value} onClick={
              () => {
                let value = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
                  properties: [
                    'openDirectory'
                  ]
                });
                if (value) {
                  ref.current.value = value[0];
                }
              }
            }/>
            <br />
            <br />
          </>
        )
      }

      case "checkbox": {
        return (
          <>
            <SettingsInputCheckbox name={this.props.name} defaultChecked={value} >
              {label}
            </SettingsInputCheckbox>
            <br />
          </>
        )
      }
    }
  }
}
