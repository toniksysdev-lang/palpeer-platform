import { Pressable, TextInput, View } from 'react-native';
import { useNumberPadField } from '@/components/ui/NumberPadContext';
import { numberFieldTextInputProps, suppressSystemKeyboard } from '@/components/ui/numberFieldInput';
import { amtIn, amtShow, W } from '@/newui/lib/money';
import { useC } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Flag, Row, Txt } from '@/newui/ui/kit';

/** Flag button + amount field (whole numbers up to 11 digits with commas; decimals allowed). */
export function AmountBox({ code, label, value, onChange, onPick, pickLabel }: { code: string; label: string; value: string; onChange: (v: string) => void; onPick?: () => void; pickLabel?: string }) {
  const c = useC();
  const pad = useNumberPadField({
    value,
    onChange: (raw) => onChange(amtIn(raw)),
    maxLength: 14,
    bottomLeft: '.',
    variant: 'phone',
    padKey: `amount-${code}-${label}`,
  });

  return (
    <Row gap={10}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={(pickLabel || 'Choose which money') + '. Now ' + W(code).name}
        disabled={!onPick}
        onPress={onPick}
        style={{ height: 60, paddingHorizontal: 8, borderRadius: 14, backgroundColor: c.field, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Flag cc={W(code).cc} w={46} />
        {onPick ? <Icon name="down" size={20} color={c.text} /> : null}
      </Pressable>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Txt size={16} color="text2">
          {label}
        </Txt>
        <Row gap={4}>
          <Txt size={28} w="800" noTr>
            {W(code).sym}
          </Txt>
          <TextInput
            accessibilityLabel={label}
            placeholder="0"
            placeholderTextColor={c.text4}
            value={amtShow(value)}
            onChangeText={(v) => onChange(amtIn(v))}
            {...numberFieldTextInputProps}
            onFocus={() => {
              suppressSystemKeyboard();
              pad.select();
            }}
            onPressIn={() => {
              suppressSystemKeyboard();
              pad.select();
            }}
            style={{
              minWidth: 118,
              flexShrink: 1,
              fontSize: 28,
              fontFamily: 'NotoSans_800ExtraBold',
              color: c.text,
              textAlign: 'right',
              borderBottomWidth: 3,
              borderColor: pad.active ? c.brandText : c.text,
              paddingVertical: 4,
            }}
          />
        </Row>
      </View>
    </Row>
  );
}
