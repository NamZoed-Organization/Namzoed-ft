import { useVideoCache } from "@/contexts/VideoCacheContext";
import { useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from 'react';

export const useVideoPlayerManager = (videoUri: string, videoId: string, isVisible: boolean) => {
  const [videoLoading, setVideoLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const { registerPlayer, releasePlayer } = useVideoCache();
  
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    isMounted.current = true;
    
    if (player) {
      registerPlayer(videoId, player, videoUri);
      
      const statusSubscription = player.addListener('statusChange', (payload) => {
        if (isMounted.current && payload.status === 'readyToPlay') {
          setVideoLoading(false);
          setDuration(player.duration);
          setError(null);
        }
      });

      const errorSubscription = player.addListener('error', (payload) => {
        if (isMounted.current) {
          setError('Failed to load video');
          setVideoLoading(false);
        }
      });

      return () => {
        statusSubscription.remove();
        errorSubscription.remove();
        releasePlayer(videoId);
      };
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [player, videoId, videoUri, registerPlayer, releasePlayer]);

  useEffect(() => {
    if (!player) return;
    
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, player]);

  const retry = () => {
    setError(null);
    setVideoLoading(true);
    if (player) {
      player.play();
    }
  };

  return { player, videoLoading, duration, error, retry };
};

export const useFormatDuration = () => {
  return (seconds: number) => {
    if (!seconds || seconds === 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
};