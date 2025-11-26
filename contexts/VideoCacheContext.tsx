import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { VideoPlayer } from 'expo-video';

interface VideoCache {
  player: VideoPlayer;
  uri: string;
  lastAccessed: number;
}

interface VideoCacheContextType {
  registerPlayer: (videoId: string, player: VideoPlayer, uri: string) => void;
  releasePlayer: (videoId: string) => void;
  clearCache: () => void;
  getCachedPlayer: (videoId: string) => VideoPlayer | null;
}

const VideoCacheContext = createContext<VideoCacheContextType | undefined>(undefined);

const MAX_CACHED_PLAYERS = 3; // Reduced from 5 - more aggressive limit to prevent memory issues

export const VideoCacheProvider = ({ children }: { children: React.ReactNode }) => {
  // Store video players by videoId
  const videoCache = useRef<Map<string, VideoCache>>(new Map());
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup old players when cache grows too large - IMMEDIATE cleanup (LRU eviction)
  const cleanupOldPlayers = useCallback(() => {
    const cache = videoCache.current;

    if (cache.size <= MAX_CACHED_PLAYERS) return;

    // Sort by last accessed time and remove oldest (LRU = Least Recently Used)
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    // Remove oldest entries until we're under the limit
    const toRemove = entries.slice(0, entries.length - MAX_CACHED_PLAYERS);

    console.log(`[VideoCacheContext] LRU eviction: removing ${toRemove.length} old players`);

    toRemove.forEach(([videoId, cached]) => {
      try {
        if (cached.player) {
          cached.player.pause();
          // Release native resources
          cached.player.replace(null);
        }
        cache.delete(videoId);
      } catch (error) {
        console.warn('Error cleaning up player:', error);
      }
    });

    console.log(`[VideoCacheContext] Cache size after cleanup: ${cache.size}`);
  }, []);

  const getCachedPlayer = useCallback((videoId: string): VideoPlayer | null => {
    const cached = videoCache.current.get(videoId);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.player;
    }
    return null;
  }, []);

  const releasePlayer = useCallback((videoId: string) => {
    const cached = videoCache.current.get(videoId);
    if (cached) {
      try {
        cached.player.pause();
        cached.player.replace(null);
      } catch (error) {
        console.warn('Error releasing player:', error);
      }
      videoCache.current.delete(videoId);
    }
  }, []);

  const clearCache = useCallback(() => {
    // Properly cleanup all players
    videoCache.current.forEach((cached) => {
      try {
        if (cached.player) {
          cached.player.pause();
          cached.player.replace(null);
        }
      } catch (error) {
        console.warn('Error clearing player:', error);
      }
    });
    videoCache.current.clear();
  }, []);

  // Cache player registration (called from components)
  const registerPlayer = useCallback((videoId: string, player: VideoPlayer, uri: string) => {
    // Remove old player with same videoId if exists
    const existing = videoCache.current.get(videoId);
    if (existing && existing.player !== player) {
      try {
        existing.player.pause();
        existing.player.replace(null);
      } catch (error) {
        console.warn('Error replacing existing player:', error);
      }
    }

    videoCache.current.set(videoId, {
      player,
      uri,
      lastAccessed: Date.now(),
    });

    // IMMEDIATE cleanup check - run synchronously if we've exceeded the limit
    if (videoCache.current.size > MAX_CACHED_PLAYERS) {
      console.log(`[VideoCacheContext] Exceeded limit (${videoCache.current.size}), triggering immediate cleanup`);
      cleanupOldPlayers();
    } else {
      // Schedule a delayed cleanup check as a safety net
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      cleanupTimerRef.current = setTimeout(cleanupOldPlayers, 500);
    }
  }, [cleanupOldPlayers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      clearCache();
    };
  }, [clearCache]);

  return (
    <VideoCacheContext.Provider
      value={{
        registerPlayer,
        releasePlayer,
        clearCache,
        getCachedPlayer,
      }}
    >
      {children}
    </VideoCacheContext.Provider>
  );
};

export const useVideoCache = () => {
  const context = useContext(VideoCacheContext);
  if (!context) {
    throw new Error('useVideoCache must be used within a VideoCacheProvider');
  }
  return context;
};
