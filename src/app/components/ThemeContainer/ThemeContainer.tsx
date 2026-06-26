import React, { useEffect, useMemo, useRef } from "react"
import Theme from "../../toxen/Theme"
import ThemeContainerController from "../../toxen/controllers/ThemeContainerController"
import { useController } from "../../lib/useController"

interface Props {
  controller?: ThemeContainerController;
  onReady?: (controller: ThemeContainerController) => void;
}

export default function ThemeContainer(props: Props) {
  const controller = useMemo(
    () => props.controller ?? new ThemeContainerController(),
    []
  );
  useController(controller);

  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  useEffect(() => {
    onReadyRef.current?.(controller);
  }, [controller]);

  if (!controller.theme) return (<></>);
  return (
    <style>
      {Theme.parseToCSS(controller.theme)}
    </style>
  )
}
