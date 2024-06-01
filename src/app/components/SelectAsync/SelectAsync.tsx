import { Loader, Select, ComboboxItem, SelectProps } from '@mantine/core'
import React, { useEffect, useState } from 'react'

interface SelectAsyncProps extends Omit<SelectProps & React.RefAttributes<HTMLInputElement>, "data"> {
  data(): Promise<(string | ComboboxItem)[]>;
}

/**
 * Works the same as a regular Mantine Select, but it loads the data asynchronously.
 */
export default function SelectAsync(props: SelectAsyncProps) {
  const [dataList, setDataList] = useState<(string | ComboboxItem)[]>(null);
  
  const data = props.data;
  // delete props.data;
  
  useEffect(() => {
    data().then(setDataList);
  }, [data]);

  if (dataList === null) {
    return <Loader />
  }

  return (
    <Select
      {...props}
      data={dataList}
    />
  );
}
