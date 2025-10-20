import React, { createContext, useContext, useState, useCallback } from 'react';

interface VideoPlaybackContextType {
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  isPlaying: (id: string) => boolean;
  play: (id: string) => void;
  pause: (id: string) => void;
}

const VideoPlaybackContext = createContext<VideoPlaybackContextType | undefined>(undefined);

export const VideoPlaybackProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

  const isPlaying = useCallback((id: string) => {
    return currentlyPlayingId === id;
  }, [currentlyPlayingId]);

  const play = useCallback((id: string) => {
    setCurrentlyPlayingId(id);
  }, []);

  const pause = useCallback((id: string) => {
    if (currentlyPlayingId === id) {
      setCurrentlyPlayingId(null);
    }
  }, [currentlyPlayingId]);

  return (
    <VideoPlaybackContext.Provider value={{ currentlyPlayingId, setCurrentlyPlayingId, isPlaying, play, pause }}>
      {children}
    </VideoPlaybackContext.Provider>
  );
};

export const useVideoPlayback = () => {
  const context = useContext(VideoPlaybackContext);
  if (!context) {
    throw new Error('useVideoPlayback must be used within a VideoPlaybackProvider');
  }
  return context;
};
