import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Modal,
    Text,
    TouchableOpacity,
    View
} from "react-native";

interface ChatAudioRecorderProps {
  currentUserUUID: string;
  chatPartnerId: string;
  onOptimisticAudio: (optimisticMsg: any) => void;
  onUploadSuccess: (finalMsg: any, optimisticId: string) => void;
  onUploadError: (optimisticId: string) => void;
}

export default function ChatAudioRecorder({
  currentUserUUID,
  chatPartnerId,
  onOptimisticAudio,
  onUploadSuccess,
  onUploadError
}: ChatAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const pulseAnim = useState(new Animated.Value(1))[0];

  const startRecording = async () => {
    try {
      console.log('🎤 Requesting audio permissions...');
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone access to send voice messages.');
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('🎤 Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setShowRecordingModal(true);
      setRecordingDuration(0);

      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Update duration every second
      const interval = setInterval(() => {
        setRecordingDuration((prev) => {
          const newDuration = prev + 1;
          // Auto-stop after 5 minutes
          if (newDuration >= 300) {
            stopRecording();
            clearInterval(interval);
          }
          return newDuration;
        });
      }, 1000);

      // Store interval ID for cleanup
      (recording as any)._durationInterval = interval;

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      console.log('🎤 Stopping recording...');
      
      // Clear duration interval
      const interval = (recording as any)._durationInterval;
      if (interval) clearInterval(interval);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      setRecording(null);
      setIsRecording(false);
      setShowRecordingModal(false);

      if (uri) {
        console.log('🎤 Recording saved at:', uri);
        await uploadAudioToSupabase(uri, recordingDuration);
      }

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to save recording.');
      setIsRecording(false);
      setShowRecordingModal(false);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;

    try {
      console.log('🎤 Canceling recording...');
      
      // Clear duration interval
      const interval = (recording as any)._durationInterval;
      if (interval) clearInterval(interval);

      await recording.stopAndUnloadAsync();
      setRecording(null);
      setIsRecording(false);
      setShowRecordingModal(false);
      setRecordingDuration(0);
      
    } catch (error) {
      console.error('❌ Failed to cancel recording:', error);
    }
  };

  const uploadAudioToSupabase = async (audioUri: string, duration: number) => {
    setIsUploading(true);

    try {
      // Create optimistic message
      const optimisticId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticMessage = {
        id: optimisticId,
        sender_id: currentUserUUID,
        receiver_id: chatPartnerId,
        message_type: 'audio',
        audio_url: audioUri, // Local URI for preview
        audio_duration: duration,
        content: null,
        created_at: new Date().toISOString(),
        is_read: false,
        isOptimistic: true
      };

      console.log('🎤 Creating optimistic audio message');
      onOptimisticAudio(optimisticMessage);

      // Generate conversation key (sorted UUIDs for consistency)
      const conversationKey = [currentUserUUID, chatPartnerId].sort().join('_');
      
      // Generate unique file path
      const timestamp = Date.now();
      const fileName = `${optimisticId}_${timestamp}.m4a`;
      const filePath = `${conversationKey}/${fileName}`;

      console.log('📤 Uploading audio to:', filePath);

      // Read file as base64
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }

      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-audio')
        .upload(filePath, bytes.buffer, {
          contentType: 'audio/m4a',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload successful:', uploadData.path);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-audio')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log('🔗 Public URL:', publicUrl);

      // Insert message into database
      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .insert([{
          sender_id: currentUserUUID,
          receiver_id: chatPartnerId,
          message_type: 'audio',
          audio_url: publicUrl,
          audio_duration: duration,
          content: null,
          is_read: false
        }])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        throw insertError;
      }

      console.log('✅ Audio message saved to DB:', insertData.id.substring(0, 8));
      onUploadSuccess(insertData, optimisticId);

    } catch (error) {
      console.error('❌ Upload error:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
      onUploadError(`temp-${Date.now()}`);
    } finally {
      setIsUploading(false);
      setRecordingDuration(0);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <TouchableOpacity
        onPress={startRecording}
        disabled={isUploading || isRecording}
        className="mr-1 w-9 h-9 items-center justify-center"
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Ionicons name="mic-outline" size={21} color="#6b7280" />
        )}
      </TouchableOpacity>

      {/* Recording Modal */}
      <Modal
        visible={showRecordingModal}
        transparent
        animationType="fade"
        onRequestClose={cancelRecording}
      >
        <View className="flex-1 bg-black/70 justify-center items-center">
          <View className="bg-white rounded-3xl p-8 items-center min-w-[280px]">
            {/* Animated Microphone Icon */}
            <Animated.View
              style={{
                transform: [{ scale: pulseAnim }]
              }}
              className="bg-red-500 rounded-full p-6 mb-6"
            >
              <Ionicons name="mic" size={48} color="white" />
            </Animated.View>

            {/* Recording Duration */}
            <Text className="text-2xl font-bold text-gray-800 mb-2">
              {formatDuration(recordingDuration)}
            </Text>
            <Text className="text-sm text-gray-500 mb-8">
              Recording...
            </Text>

            {/* Action Buttons */}
            <View className="flex-row space-x-4">
              <TouchableOpacity
                onPress={cancelRecording}
                className="bg-gray-200 rounded-full px-6 py-3 min-w-[100px] items-center"
              >
                <Text className="text-gray-800 font-semibold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={stopRecording}
                className="bg-red-500 rounded-full px-6 py-3 min-w-[100px] items-center"
              >
                <View className="flex-row items-center">
                  <Ionicons name="stop" size={18} color="white" style={{ marginRight: 6 }} />
                  <Text className="text-white font-semibold">Send</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
