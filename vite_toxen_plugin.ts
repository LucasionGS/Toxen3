import { Plugin } from 'vite';

export default function toxenApi(type: string) {
  return <Plugin>{ // Toxen specific
    name: 'replace-toxenapi-path',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('app.tsx')) {
        return code.replace('/*REPLACED_BY_VITE*/import "./ToxenControllers/toxenapi";', '/*REPLACED_BY_VITE*/import "./ToxenControllers/toxenapi_'+ type +'";');
      }
    }
  };
}