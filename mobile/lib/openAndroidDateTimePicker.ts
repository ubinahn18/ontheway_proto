import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

// Android has no combined "datetime" dialog — chain a date picker into a
// time picker and merge the two results. (iOS renders inline with a spinner
// instead, handled separately wherever this is used.)
export function openAndroidDateTimePicker(current: Date, onPick: (date: Date) => void) {
  DateTimePickerAndroid.open({
    value: current,
    mode: 'date',
    onChange: (_, pickedDate) => {
      if (!pickedDate) return;
      DateTimePickerAndroid.open({
        value: current,
        mode: 'time',
        onChange: (_, pickedTime) => {
          if (!pickedTime) return;
          const combined = new Date(pickedDate);
          combined.setHours(pickedTime.getHours(), pickedTime.getMinutes());
          onPick(combined);
        },
      });
    },
  });
}
