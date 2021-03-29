import React from 'react';
import Settings from '../../toxen/Settings';
import { remote } from "electron";
import "./SettingsInput.css";
import SettingsInputCheckbox from './SettingsInputCheckbox';


type Props = [
  PropsText,
  PropsCheckbox
][number];

interface PropsTemplate {
  name: string;
  type: "text" | "checkbox";
  displayName?: string;
}

interface PropsText extends PropsTemplate {
  type: "text";
}

interface PropsCheckbox extends PropsTemplate {
  type: "checkbox";
}

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
