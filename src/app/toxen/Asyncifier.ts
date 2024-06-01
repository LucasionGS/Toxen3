import React from "react";

namespace Asyncifier {
  export function createSetState<Props = { }, State = { }>(component: React.Component<Props, State>) {
    return function setStateAsync<K extends keyof State>(state: ((prevState: Readonly<State>, props: Readonly<Props>) => (Pick<State, K> | State | null)) | (Pick<State, K> | State | null)) {
      return new Promise<void>((resolve) => {
        component.setState<K>(state, resolve);
      });
    }
  }
}

export default Asyncifier;