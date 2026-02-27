import { supabase } from "@/lib/supabase";

type ChatMessageType = "text" | "image" | "audio";

interface ChatPushPayload {
  senderId: string;
  receiverId: string;
  messageType: ChatMessageType;
  messagePreview?: string;
}

const NOTIFY_FUNCTION_NAME = "notify-chat-message";
const SUPABASE_FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${NOTIFY_FUNCTION_NAME}`;


const summarizeInvokeError = async (error: unknown): Promise<string> => {
  const err = error as {
    message?: string;
    context?: {
      status?: number;
      text?: () => Promise<string>;
    };
  };

  const parts: string[] = [];
  if (err?.message) {
    parts.push(err.message);
  }

  if (typeof err?.context?.status === "number") {
    parts.push(`status=${err.context.status}`);
  }

  if (typeof err?.context?.text === "function") {
    try {
      const body = (await err.context.text()).trim();
      if (body) {
        const truncatedBody = body.length > 400 ? `${body.slice(0, 397)}...` : body;
        parts.push(`body=${truncatedBody}`);
      }
    } catch {
      // Ignore body parse failures.
    }
  }

  return parts.join(" | ") || "Unknown function invoke error";
};

const normalizePreview = (
  messageType: ChatMessageType,
  preview?: string,
): string => {
  const trimmed = preview?.trim() ?? "";
  if (trimmed.length > 0) {
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
  }

  if (messageType === "image") return "Sent an image";
  if (messageType === "audio") return "Sent a voice message";
  return "Sent a message";
};

export async function sendChatPushNotification({
  senderId,
  receiverId,
  messageType,
  messagePreview,
}: ChatPushPayload): Promise<boolean> {
  if (!senderId || !receiverId || senderId === receiverId) {
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean;
      error?: string;
      warning?: string;
      delivered?: boolean;
      recipients?: number;
    }>(NOTIFY_FUNCTION_NAME, {
      body: {
        sender_id: senderId,
        receiver_id: receiverId,
        message_type: messageType,
        preview: normalizePreview(messageType, messagePreview),
      },
    });

    if (error) {
      const detail = await summarizeInvokeError(error);
      if (detail.includes("status=404") || detail.includes('"code":"NOT_FOUND"')) {
      }
      return false;
    }

    if (!data?.success) {
      if (data?.error) {
      } else {
      }
      return false;
    }

    if (data.warning) {
      console.info("notify-chat-message accepted with warning:", data.warning, {
        delivered: data.delivered ?? null,
        recipients: data.recipients ?? null,
      });
    }

    return true;
  } catch (err) {
    return false;
  }
}
