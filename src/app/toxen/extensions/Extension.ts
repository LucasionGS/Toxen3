export default class Extension {
  constructor(options: ExtensionOptions) {
    this.name = options.name ?? "";
    this.version = options.version ?? "";
    this.author = options.author ?? "";
    this.description = options.description ?? "";
    this.icon = options.icon ?? "";
    this.settings = options.settings ?? "";
    this.dependencies = options.dependencies ?? "";
    this.onLoad = options.onLoad ?? "";
    this.onUnload = options.onUnload ?? "";
  }

  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  settings: string;
  dependencies: string;
  onLoad: string;
  onUnload: string;
}

interface ExtensionOptions {
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  settings: string;
  dependencies: string;
  onLoad: string;
  onUnload: string;
}