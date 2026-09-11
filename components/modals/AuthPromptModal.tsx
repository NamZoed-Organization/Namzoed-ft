/**
 * The gate a guest hits on anything that needs an account.
 *
 * It is `DialogCard` (§ Dialogs) — it was a hand-rolled card with three
 * stacked pill buttons: a filled "Log In", a grey "Create Account", and a
 * grey text "Not now" underneath. Three answers to a two-answer question, and
 * the third was only restating what tapping the scrim already does.
 *
 * So: two actions, and the scrim is the way out. "Log in" stays the filled
 * one, because a guest reaching this point has usually been browsing signed
 * out rather than never having signed up.
 */

import DialogCard from "@/components/ui/DialogCard";
import { useAppRouter } from "@/utils/navigation";
import { UserRound } from "lucide-react-native";
import React from "react";
import { Modal } from "react-native";

interface AuthPromptModalProps {
  visible: boolean;
  onClose: () => void;
  /** Why the account is needed — "Sign in to add friends". */
  message?: string;
  /** Skip the native `<Modal>` wrapper. Set it when the caller is already
   *  presenting a full-screen modal (`HamburgerMenu` is), since nesting one
   *  native modal in another is unreliable on iOS. Leave it off inside a
   *  fixed-height parent like `TopNavbar`, where a bare absolute overlay
   *  would be confined to the bar. */
  embedded?: boolean;
}

export default function AuthPromptModal({
  visible,
  onClose,
  message = "Sign in to access this feature",
  embedded,
}: AuthPromptModalProps) {
  const router = useAppRouter();

  const card = (
    <DialogCard
      visible={visible}
      onDismiss={onClose}
      title="Account required"
      message={message}
      icon={<UserRound size={22} color="#094569" strokeWidth={1.9} />}
      actions={[
        {
          label: "Create account",
          style: "cancel",
          onPress: () => router.push("/signup"),
        },
        {
          label: "Log in",
          onPress: () => router.push("/login"),
        },
      ]}
    />
  );

  if (embedded) return card;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {card}
    </Modal>
  );
}
