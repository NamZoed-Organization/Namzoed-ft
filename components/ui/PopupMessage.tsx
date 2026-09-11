/**
 * The app's message dialog — "saved", "that didn't work", "are you sure".
 *
 * It is `DialogCard` with a type: the shell, the type scale, the radius and
 * the action rules all live there, so this file is only about what the four
 * kinds *mean*. Seventy-odd screens call it, which is exactly why none of
 * them should be able to make one look different.
 *
 * **Colour is only used where colour is the message.** Error is red and
 * warning is amber because the hue is the information; success and the
 * plain kind take the brand, because "it worked" is not an event that needs
 * a colour to be understood. § Icons rules out per-item colour coding
 * everywhere else, and this is the exception it names — the same licence
 * the switches take for availability.
 *
 * The API is unchanged from the version this replaced, because the change
 * is how it looks, not how it is called.
 */

import DialogCard, { type DialogAction } from '@/components/ui/DialogCard';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react-native';
import React from 'react';

type PopupType = 'success' | 'error' | 'warning' | 'white';
type PopupActionStyle = 'default' | 'cancel' | 'destructive';

interface PopupAction {
  label: string;
  onPress?: () => void;
  style?: PopupActionStyle;
}

interface PopupMessageProps {
  visible: boolean;
  type: PopupType;
  title?: string;
  message: string;
  onHide?: () => void;
  actions?: PopupAction[];
}

const popupConfig = {
  success: {
    iconColor: '#059669',
    icon: CheckCircle,
    defaultTitle: 'Done',
  },
  error: {
    iconColor: '#DC2626',
    icon: AlertCircle,
    defaultTitle: 'Something went wrong',
  },
  warning: {
    iconColor: '#D97706',
    icon: AlertTriangle,
    defaultTitle: 'Heads up',
  },
  white: {
    iconColor: '#094569',
    icon: CheckCircle,
    defaultTitle: 'Done',
  },
};

export default function PopupMessage({
  visible,
  type,
  title,
  message,
  onHide,
  actions,
}: PopupMessageProps) {
  const config = popupConfig[type];
  const Icon = config.icon;

  return (
    <DialogCard
      visible={visible}
      onDismiss={onHide}
      title={title || config.defaultTitle}
      message={message}
      icon={<Icon size={22} color={config.iconColor} strokeWidth={2} />}
      actions={actions as DialogAction[] | undefined}
    />
  );
}
