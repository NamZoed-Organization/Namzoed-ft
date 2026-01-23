import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    TouchableOpacity
} from "react-native";

interface ChatImagePickerProps {
  currentUserUUID: string;
  chatPartnerId: string;
  onOptimisticImage: (optimisticMsg: any) => void;
  onUploadSuccess: (finalMsg: any, optimisticId: string) => void;
  onUploadError: (optimisticId: string) => void;
}

export default function ChatImagePicker({
  currentUserUUID,
  chatPartnerId,
  onOptimisticImage,
  onUploadSuccess,
  onUploadError
}: ChatImagePickerProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleImagePick = async () => {
    if (isUploading) return;

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant access to your photo library to send images.');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        aspect: [4, 3],
      });

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

      console.log('📸 Creating optimistic image message');
      onOptimisticImage(optimisticMessage);

      // Upload to Supabase Storage
      await uploadImageToSupabase(imageUri, optimisticId);

    } catch (error) {
      console.error('❌ Image pick error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
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

      console.log('📤 Uploading to:', filePath);

      // Fetch the image as blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      // Convert blob to ArrayBuffer
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload successful:', uploadData.path);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log('🔗 Public URL:', publicUrl);

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

    } catch (error) {
      console.error('❌ Upload failed:', error);
      Alert.alert('Upload Failed', 'Failed to send image. Please try again.');
      onUploadError(optimisticId);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleImagePick}
      disabled={isUploading}
      className="mr-2 w-10 h-10 rounded-full items-center justify-center bg-green-100"
    >
      {isUploading ? (
        <ActivityIndicator size="small" color="#10b981" />
      ) : (
        <Ionicons name="image" size={22} color="#10b981" />
      )}
    </TouchableOpacity>
  );
}
