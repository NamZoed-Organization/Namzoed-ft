import React from "react";
import { Platform, TextInput, TextInputProps, View } from "react-native";
import { clamp, useResponsive } from "@/utils/responsive";

interface FormInputProps extends TextInputProps {
  leftIcon?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  disabled?: boolean;
  multiline?: boolean;
  minHeightClassName?: string;
}

export default function FormInput({
  leftIcon,
  rightAccessory,
  disabled = false,
  multiline = false,
  minHeightClassName,
  style,
  ...props
}: FormInputProps) {
  const isAndroid = Platform.OS === "android";
  const { ms } = useResponsive();
  const inputHeight = clamp(ms(48), 44, 56);
  const verticalPadding = multiline ? clamp(ms(12), 10, 16) : isAndroid ? 6 : 8;
  const horizontalPadding = clamp(ms(16), 12, 20);
  const inputFontSize = clamp(ms(16), 14, 18);
  const iconSpacing = clamp(ms(8), 6, 10);
  const borderRadius = clamp(ms(12), 10, 16);

  return (
    <View
      className={`bg-gray-50 border flex-row items-center ${
        disabled ? "border-gray-200 opacity-70" : "border-gray-200"
      } ${multiline ? "items-start" : ""}`}
      style={{
        minHeight: multiline ? undefined : inputHeight,
        paddingTop: verticalPadding,
        paddingBottom: verticalPadding,
        paddingHorizontal: horizontalPadding,
        borderRadius,
      }}
    >
      {leftIcon ? <View>{leftIcon}</View> : null}
      <TextInput
        {...props}
        editable={!disabled && props.editable !== false}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : props.textAlignVertical}
        placeholderTextColor={props.placeholderTextColor || "#9CA3AF"}
        className={`flex-1 text-gray-900 ${
          multiline ? `pt-0 ${minHeightClassName || "min-h-[120px]"}` : ""
        }`}
        style={[
          {
            marginLeft: leftIcon ? iconSpacing : 0,
            paddingVertical: multiline ? 0 : isAndroid ? 0 : 0,
            fontSize: inputFontSize,
          },
          style,
        ]}
      />
      {rightAccessory ? <View>{rightAccessory}</View> : null}
    </View>
  );
}
