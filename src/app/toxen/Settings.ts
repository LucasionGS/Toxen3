export default class Settings {
  
  data: ISettings;
}

export interface ISettings {
  libraryDirectory: string;
  isRemote: boolean;
}