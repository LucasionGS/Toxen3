import React from 'react'
import { Toxen } from '../ToxenApp'
import { useForceUpdate } from '@mantine/hooks';

interface Props {
  id: string;
  children: React.ReactNode;
}

/**
 * Unused currently.
 */
export default function Reloadable(props: Props) {
  const [id, setId] = React.useState(props.id);
  const forceUpdate = useForceUpdate();

  React.useEffect(() => {
    console.log("Set reloadable", id);
    // Toxen.setReloadable(id, () => {
    //   forceUpdate();
    //   console.log("Reloaded", id, Toxen.playlist?.name);
    //   setId(props.id);
    // });

    // return () => {
    //   Toxen.removeReloadable(id);
    // }
  }, [props.id]);
  
  return props.children;
}
