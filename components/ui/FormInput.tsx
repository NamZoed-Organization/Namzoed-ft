import React from "react";
import { Platform, TextInput, TextInputProps, View } from "react-native";

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

  return (
    <View
      className={`bg-gray-50 border rounded-xl px-4 flex-row items-center ${
        disabled ? "border-gray-200 opacity-70" : "border-gray-200"
      } ${multiline ? "items-start" : ""}`}
      style={{
        minHeight: multiline ? undefined : isAndroid ? 44 : 48,
        paddingTop: multiline ? 12 : isAndroid ? 4 : 8,
        paddingBottom: multiline ? 12 : isAndroid ? 4 : 8,
      }}
    >
      {leftIcon ? <View>{leftIcon}</View> : null}
      <TextInput
        {...props}
        editable={!disabled && props.editable !== false}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : props.textAlignVertical}
        placeholderTextColor={props.placeholderTextColor || "#9CA3AF"}
        className={`flex-1 text-gray-900 text-base ${
          multiline ? `pt-0 ${minHeightClassName || "min-h-[120px]"}` : ""
        }`}
        style={[
          {
            marginLeft: leftIcon ? 8 : 0,
            paddingVertical: multiline ? 0 : isAndroid ? 0 : 0,
          },
          style,
        ]}
      />
      {rightAccessory ? <View>{rightAccessory}</View> : null}
    </View>
  );
}
