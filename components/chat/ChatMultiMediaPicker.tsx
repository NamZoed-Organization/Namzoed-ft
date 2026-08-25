import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { supabase } from "@/lib/supabase";
import { uploadFileToSupabase } from "@/lib/uploadFile";
import { sendChatPushNotification } from "@/services/chatPushService";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from "react";
import {
    Dimensions,
    Modal,
    StyleSheet,
    TouchableOpacity,
} from "react-native";

const { width: screenWidth } = Dimensions.get("window");
const THUMBNAIL_SIZE = 80;

interface SelectedMedia {
  id: string;
  uri: string;
  type: 'image' | 'video';
  duration?: number; // for videos
}

interface ChatMultiMediaPickerProps {
  currentUserUUID: string;
  chatPartnerId: string;
  onOptimisticImage: (optimisticMsg: any) => void;
  onUploadSuccess: (finalMsg: any, optimisticId: string) => void;
  onUploadError: (optimisticId: string) => void;
  /** 'gallery' (default) opens the photo library; 'camera' opens the camera. */
  mode?: 'gallery' | 'camera';
}

/**
 * Multi-media picker for chat
 * - Allows selecting multiple images/videos
 * - Shows preview before sending
 * - Sends all media with a single send button
 * - Similar to Instagram, WhatsApp, Telegram
 */
export default function ChatMultiMediaPicker({
  currentUserUUID,
  chatPartnerId,
  onOptimisticImage,
  onUploadSuccess,
  onUploadError,
  mode = 'gallery',
}: ChatMultiMediaPickerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [popup, setPopup] = useState<{visible: boolean; type: 'warning'|'error'; title: string; message: string}>({visible: false, type: 'warning', title: '', message: ''});

  const showPopup = (type: 'warning'|'error', title: string, message: string) => 
    setPopup({visible: true, type, title, message});

  const handleMediaPick = async () => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showPopup('warning', 'Camera Access Needed', 'Please allow camera access to take photos.');
          return;
        }
        // Camera only allows single selection
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images", "videos"],
          allowsEditing: false,
          quality: 0.7,
        });
      } else {
        // Request permissions
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showPopup('warning', 'Gallery Access Needed', 'Please allow access to your photo library to send images.');
          return;
        }
        // Gallery allows multiple selection
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          allowsMultipleSelection: true,
          selectionLimit: 10,
          quality: 0.7,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      // Convert selected assets to our format
      const newMedia: SelectedMedia[] = result.assets.map((asset, idx) => ({
        id: `${Date.now()}-${idx}`,
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        duration: asset.duration ?? undefined,
      }));

      // Directly upload the selected media
      setIsUploading(true);

      try {
        const uploadPromises = newMedia.map(media => 
          uploadSingleMedia(media)
        );

        await Promise.all(uploadPromises);
      } catch (error) {
        console.error('❌ Batch upload failed:', error);
        showPopup('error', 'Upload Failed', 'Could not send all media. Please try again.');
      } finally {
        setIsUploading(false);
      }

    } catch (error) {
      console.error('❌ Media pick error:', error);
      showPopup('error', 'Selection Error', 'Could not load media. Please try again.');
      setIsUploading(false);
    }
  };

  const uploadSingleMedia = async (media: SelectedMedia) => {
    const optimisticId = `temp-${Date.now()}-${media.id}`;
    try {
      const isVideo = media.type === 'video';

      // Create optimistic message
      const optimisticMessage = {
        id: optimisticId,
        sender_id: currentUserUUID,
        receiver_id: chatPartnerId,
        message_type: isVideo ? 'video' : 'image',
        image_url: media.uri, // Local URI for preview
        video_url: isVideo ? media.uri : undefined,
        content: null,
        created_at: new Date().toISOString(),
        is_read: false,
        isOptimistic: true,
        localStatus: 'sending',
      };

      onOptimisticImage(optimisticMessage);

      // Generate conversation key and file path
      const conversationKey = [currentUserUUID, chatPartnerId].sort().join('_');
      const timestamp = Date.now();
      const ext = isVideo ? 'mp4' : 'jpg';
      const fileName = `${optimisticId}_${timestamp}.${ext}`;
      const filePath = `${conversationKey}/${fileName}`;

      // Determine MIME type
      const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';

      // Upload file
      await uploadFileToSupabase(media.uri, isVideo ? 'chat-videos' : 'chat-images', filePath, mimeType, true);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(isVideo ? 'chat-videos' : 'chat-images')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Save to database
      const insertPayload: any = {
        sender_id: currentUserUUID,
        receiver_id: chatPartnerId,
        message_type: isVideo ? 'video' : 'image',
        content: null,
        is_read: false
      };

      if (isVideo) {
        insertPayload.video_url = publicUrl;
      } else {
        insertPayload.image_url = publicUrl;
      }

      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .insert([insertPayload])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        throw insertError;
      }

      console.log(`✅ ${isVideo ? 'Video' : 'Image'} message saved:`, insertData.id.substring(0, 8));
      onUploadSuccess(insertData, optimisticId);

      // Send push notification
      void sendChatPushNotification({
        senderId: String(currentUserUUID),
        receiverId: String(chatPartnerId),
        messageType: isVideo ? "video" : "image",
      });

    } catch (error) {
      console.error('❌ Upload failed:', error);
      onUploadError(optimisticId);
      throw error;
    }
  };

  return (
    <>
      {/* Icon button to open picker */}
      <TouchableOpacity
        onPress={handleMediaPick}
        disabled={isUploading}
        className="mr-1 w-9 h-9 items-center justify-center"
      >
        {isUploading ? (
          <CircularLoader size="small" color="#6b7280" />
        ) : (
          <Ionicons
            name={mode === 'camera' ? 'camera-outline' : 'image-outline'}
            size={21}
            color="#6b7280"
          />
        )}
      </TouchableOpacity>

      {/* Error/Warning popups */}
      <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
        <PopupMessage 
          visible={popup.visible} 
          type={popup.type} 
          title={popup.title} 
          message={popup.message} 
          onHide={() => setPopup(p => ({...p, visible: false}))} 
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({});
