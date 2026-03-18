import PopupMessage from "@/components/ui/PopupMessage";
import { uploadFileToSupabase } from "@/lib/uploadFile";
import { supabase } from "@/lib/supabase";
import { sendChatPushNotification } from "@/services/chatPushService";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    TouchableOpacity
} from "react-native";

interface ChatImagePickerProps {
  currentUserUUID: string;
  chatPartnerId: string;
  onOptimisticImage: (optimisticMsg: any) => void;
  onUploadSuccess: (finalMsg: any, optimisticId: string) => void;
  onUploadError: (optimisticId: string) => void;
  /** 'gallery' (default) opens the photo library; 'camera' opens the camera. */
  mode?: 'gallery' | 'camera';
}

export default function ChatImagePicker({
  currentUserUUID,
  chatPartnerId,
  onOptimisticImage,
  onUploadSuccess,
  onUploadError,
  mode = 'gallery',
}: ChatImagePickerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [popup, setPopup] = useState<{visible: boolean; type: 'warning'|'error'; title: string; message: string}>({visible: false, type: 'warning', title: '', message: ''});
  const showPopup = (type: 'warning'|'error', title: string, message: string) => setPopup({visible: true, type, title, message});

  const handleImagePick = async () => {
    if (isUploading) return;

    try {
      let result: ImagePicker.ImagePickerResult;

      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showPopup('warning', 'Camera Access Needed', 'Please allow camera access to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        // Pick image
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
        });
      }

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets[0].uri;
      setIsUploading(true);

      // Create optimistic message
      const optimisticId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticMessage = {
        id: optimisticId,
        sender_id: currentUserUUID,
        receiver_id: chatPartnerId,
        message_type: 'image',
        image_url: imageUri, // Local URI for preview
        content: null,
        created_at: new Date().toISOString(),
        is_read: false,
        isOptimistic: true
      };

      onOptimisticImage(optimisticMessage);

      // Upload to Supabase Storage
      await uploadImageToSupabase(imageUri, optimisticId);

    } catch (error) {
    console.error('❌ Image pick error:', error);
    showPopup('error', 'Image Error', 'Could not load this image. Please try again.');
    setIsUploading(false);
  }
};

  const uploadImageToSupabase = async (imageUri: string, optimisticId: string) => {
    try {
      // Generate conversation key (sorted UUIDs for consistency)
      const conversationKey = [currentUserUUID, chatPartnerId].sort().join('_');
      
      // Generate unique file path
      const timestamp = Date.now();
      const fileName = `${optimisticId}_${timestamp}.jpg`;
      const filePath = `${conversationKey}/${fileName}`;

      await uploadFileToSupabase(imageUri, 'chat-images', filePath, 'image/jpeg', true);

      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      // Insert message into database
      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .insert([{
          sender_id: currentUserUUID,
          receiver_id: chatPartnerId,
          message_type: 'image',
          image_url: publicUrl,
          content: null,
          is_read: false
        }])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        throw insertError;
      }

      console.log('✅ Image message saved to DB:', insertData.id.substring(0, 8));
      onUploadSuccess(insertData, optimisticId);

      void sendChatPushNotification({
        senderId: String(currentUserUUID),
        receiverId: String(chatPartnerId),
        messageType: "image",
      });

    } catch (error) {
      console.error('❌ Upload failed:', error);
      showPopup('error', 'Upload Failed', 'Could not send the image. Please try again.');
      onUploadError(optimisticId);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleImagePick}
        disabled={isUploading}
        className="mr-1 w-9 h-9 items-center justify-center"
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Ionicons
            name={mode === 'camera' ? 'camera-outline' : 'image-outline'}
            size={21}
            color="#6b7280"
          />
        )}
      </TouchableOpacity>
      <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
        <PopupMessage visible={popup.visible} type={popup.type} title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />
      </Modal>
    </>
  );
}
