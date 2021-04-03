import React from 'react';
import Settings from '../../toxen/Settings';
import { remote } from "electron";
import "./SettingsInput.scss";
import SettingsInputCheckbox from './SettingsInputFields/SettingsInputCheckbox';
import SettingsInputSelect from './SettingsInputFields/SettingsInputSelect';
import JSONX from '../../toxen/JSONX';


type Props = [
  PropsTypeText,
  PropsTypeFile,
  PropsTypeFolder,
  PropsTypeCheckbox,
  PropsTypeSelect,
][number];

interface PropsTemplate<T extends string> {
  name: string;
  type: T;
  displayName?: string;
  /**
   * If not defined, will use settings default value.
   */
  getValueTemplateCallback?: () => any;
}

interface PropsTypeText extends PropsTemplate<"text"> { }
interface PropsTypeFile extends PropsTemplate<"file"> {
  parseOutput?: (value: string) => string
}
interface PropsTypeFolder extends PropsTemplate<"folder"> {
  parseOutput?: (value: string) => string
}
interface PropsTypeCheckbox extends PropsTemplate<"checkbox"> { }
interface PropsTypeSelect extends PropsTemplate<"select"> { }

export default class SettingsInput extends React.Component<Props> {

  constructor(props: Props) {
    super(props);
  }

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

      case "select":
      case "string":
        return String(value);
    }
  }
  
  public static toStringValue(type: string, value: any): string {
    switch (type) {
      case "number":
        return String(value);

      case "boolean":
        return value ? "1" :"0";

      default:
        return value;
    }
  }

  render() {
    let { name } = SettingsInput.getNameAndType(this.props.name);
    let value: any = "";
    let dataTemplate = (typeof this.props.getValueTemplateCallback == "function" ? this.props.getValueTemplateCallback() : Settings.data);
    
    value = JSONX.getObjectValue(dataTemplate, name) ?? "";
    
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
                  const parseOutput = (this.props as PropsTypeFile).parseOutput;
                  ref.current.value = typeof parseOutput === "function" ? parseOutput(value[0]) : value[0];
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
                  const parseOutput = (this.props as PropsTypeFile).parseOutput;
                  ref.current.value = typeof parseOutput === "function" ? parseOutput(value[0]) : value[0];
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
      
      case "select": {
        return (
          <>
            {label}
            <br/>
            <SettingsInputSelect name={this.props.name} defaultValue={value} >
              {this.props.children}
            </SettingsInputSelect>
            <br />
          </>
        )
      }
    }
  }
}
