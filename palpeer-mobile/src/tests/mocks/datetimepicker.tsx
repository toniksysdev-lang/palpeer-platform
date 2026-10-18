import { View } from 'react-native';

export default function DateTimePicker(props: { testID?: string }) {
  return <View testID={props.testID ?? 'datetimepicker'} />;
}
