import { useEffect, useReducer } from "react";
import Controller from "../toxen/controllers/Controller";

/**
 * Subscribes a function component to a {@link Controller} so it re-renders
 * whenever the controller calls `notify()`.
 *
 * @example
 * const controller = useMemo(() => new MusicPlayerController(), []);
 * useController(controller);
 *
 * @returns The same controller instance, for convenience.
 */
export function useController<T extends Controller>(controller: T): T {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsubscribe = controller.subscribe(forceUpdate);
    return unsubscribe;
  }, [controller]);

  return controller;
}
