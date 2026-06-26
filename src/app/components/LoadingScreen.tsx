import React, { useEffect, useMemo, useRef } from 'react'
import "./LoadingScreen.scss";
import LoadingScreenController from '../toxen/controllers/LoadingScreenController';
import { useController } from '../lib/useController';

interface LoadingScreenProps {
  initialShow?: boolean;
  controller?: LoadingScreenController;
  onReady?: (controller: LoadingScreenController) => void;
}

export default function LoadingScreen(props: LoadingScreenProps) {
  const controller = useMemo(
    () => props.controller ?? new LoadingScreenController(),
    []
  );
  useController(controller);

  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  useEffect(() => {
    if (typeof props.initialShow === "boolean") controller.toggleVisible(props.initialShow);
    onReadyRef.current?.(controller);
  }, [controller]);

  return (
    <div className={"toxen-loading-screen" + (controller.visible ? " toxen-loading-screen-show" : "")}>
      <div className="toxen-loading-screen-content">
        {controller.content}
      </div>
    </div>
  )
}