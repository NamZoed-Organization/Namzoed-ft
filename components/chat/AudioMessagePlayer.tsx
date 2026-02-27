import { Ionicons } from "@expo/vector-icons";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import React, { useEffect, useRef, useState } from "react";
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
  const [player, setPlayer] = useState<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const statusSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (statusSubscriptionRef.current) {
        statusSubscriptionRef.current.remove();
        statusSubscriptionRef.current = null;
      }

      if (player) {
        player.remove();
      }
    };
  }, [player]);

  const handlePlaybackStatusUpdate = (status: AudioStatus, currentPlayer: AudioPlayer) => {
    if (!status.isLoaded) return;

    setCurrentPosition(status.currentTime);

    if (status.duration) {
      setAudioDuration((prevDuration) => (prevDuration === 0 ? status.duration : prevDuration));
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setCurrentPosition(0);
      currentPlayer.seekTo(0).catch(() => {
        // Ignore seek reset errors for completed playback.
      });
    }
  };

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        if (player) {
          player.pause();
          setIsPlaying(false);
        }
      } else {
        setIsLoading(true);

        if (player) {
          player.play();
          setIsPlaying(true);
        } else {
          await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
            shouldPlayInBackground: false,
          });

          const newPlayer = createAudioPlayer(
            { uri: audioUrl },
            { updateInterval: 200 }
          );
          statusSubscriptionRef.current = newPlayer.addListener(
            'playbackStatusUpdate',
            (status) => handlePlaybackStatusUpdate(status, newPlayer)
          );
          newPlayer.play();

          setPlayer(newPlayer);
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
