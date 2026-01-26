import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Text,
    TouchableOpacity,
    View
} from "react-native";

interface AudioMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  isCurrentUser: boolean;
  isOptimistic?: boolean;
}

export default function AudioMessagePlayer({
  audioUrl,
  duration = 0,
  isCurrentUser,
  isOptimistic = false
}: AudioMessagePlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);

  useEffect(() => {
    return () => {
      // Cleanup sound on unmount
      if (sound) {
        console.log('🔇 Unloading sound on unmount');
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        // Pause
        if (sound) {
          await sound.pauseAsync();
          setIsPlaying(false);
        }
      } else {
        // Play
        setIsLoading(true);

        if (sound) {
          // Resume existing sound
          await sound.playAsync();
          setIsPlaying(true);
        } else {
          // Load and play new sound
          console.log('🔊 Loading audio from:', audioUrl);
          
          // Configure audio mode
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });

          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true },
            onPlaybackStatusUpdate
          );

          setSound(newSound);
          setIsPlaying(true);
        }

        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Audio playback error:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis / 1000); // Convert to seconds
      
      if (status.durationMillis && audioDuration === 0) {
        setAudioDuration(status.durationMillis / 1000);
      }

      if (status.didJustFinish) {
        setIsPlaying(false);
        setCurrentPosition(0);
        // Reset to beginning
        if (sound) {
          sound.setPositionAsync(0);
        }
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentPosition / audioDuration) * 100 : 0;

  return (
    <View
      className={`flex-row items-center px-3 py-3 rounded-2xl ${
        isCurrentUser ? 'bg-primary' : 'bg-gray-200'
      } ${isOptimistic ? 'opacity-70' : ''}`}
      style={{ minWidth: 200, maxWidth: 280 }}
    >
      {/* Play/Pause Button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        disabled={isLoading || isOptimistic}
        className={`w-10 h-10 rounded-full items-center justify-center ${
          isCurrentUser ? 'bg-white/30' : 'bg-gray-300'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isCurrentUser ? 'white' : '#666'} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={isCurrentUser ? 'white' : '#333'}
          />
        )}
      </TouchableOpacity>

      {/* Waveform Visualization (Progress Bar) */}
      <View className="flex-1 ml-3">
        {/* Progress Bar */}
        <View className={`h-1 rounded-full overflow-hidden ${
          isCurrentUser ? 'bg-white/30' : 'bg-gray-300'
        }`}>
          <View
            className={`h-full rounded-full ${
              isCurrentUser ? 'bg-white' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </View>

        {/* Duration */}
        <View className="flex-row justify-between mt-1">
          <Text className={`text-xs ${isCurrentUser ? 'text-white/80' : 'text-gray-600'}`}>
            {formatTime(isPlaying ? currentPosition : 0)}
          </Text>
          <Text className={`text-xs ${isCurrentUser ? 'text-white/80' : 'text-gray-600'}`}>
            {formatTime(audioDuration)}
          </Text>
        </View>
      </View>

      {/* Microphone Icon */}
      <View className="ml-2">
        <Ionicons
          name="mic"
          size={18}
          color={isCurrentUser ? 'white' : '#666'}
        />
      </View>

      {isOptimistic && (
        <View className="ml-2">
          <ActivityIndicator size="small" color={isCurrentUser ? 'white' : '#666'} />
        </View>
      )}
    </View>
  );
}
