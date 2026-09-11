/**
 * Native-modal sequencing helpers.
 *
 * On iOS a modal presented in the same commit that dismisses another one
 * frequently never appears — UIKit is still tearing the first down. RN gives
 * no completion callback for a <Modal> unmount, so the workaround is to let
 * the dismissal animation finish before presenting the next thing (another
 * modal, or a system picker).
 *
 * Android tears modals down synchronously and needs no wait, so these are
 * no-ops there.
 */
import { InteractionManager, Platform } from "react-native";

/** RN's own <Modal> fade — long enough for the transition to settle. */
const MODAL_DISMISS_MS = 120;
/** The system photo picker / camera takes noticeably longer to slide away. */
const SYSTEM_PICKER_DISMISS_MS = 400;

export async function waitForIosModalDismiss(
  delayMs: number = MODAL_DISMISS_MS,
): Promise<void> {
  if (Platform.OS !== "ios") return;
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Presents a system picker (photo library, camera) with nothing of ours on
 * screen, and waits out its dismissal on the way back.
 *
 * Two rules, both learned the hard way, and both about the fact that
 * LoadingOverlay is itself a <Modal>:
 *
 * 1. Nothing of ours may be presented when the picker is launched. On iOS
 *    expo-image-picker presents from the *topmost presented* view
 *    controller, so an overlay left up means the picker is asked to present
 *    on a modal that is still fading in — UIKit drops that presentation, the
 *    picker never appears, and its promise never settles, so the screen
 *    spins forever.
 *
 * 2. It is not enough to take the overlay down first, either: a <Modal>
 *    dismissed while it is still presenting leaves an orphaned window that
 *    swallows every touch, which reads as the whole app freezing. So the
 *    overlay must never go up ahead of the picker at all — callers raise it
 *    only once this resolves with an asset in hand, to cover the upload.
 *
 * The trailing wait exists because returning from the picker starts *its*
 * dismissal, and whatever the caller puts up next (the overlay, a crop
 * screen) is another native modal that would lose the same race.
 */
export async function presentSystemPicker<T>(
  present: () => Promise<T>,
): Promise<T> {
  await waitForIosModalDismiss();
  try {
    return await present();
  } finally {
    await waitForIosModalDismiss(SYSTEM_PICKER_DISMISS_MS);
  }
}
