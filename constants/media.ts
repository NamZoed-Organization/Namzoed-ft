export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];

export const IMAGE_GRID_CONFIG = {
  single: { className: "w-full h-64" },
  double: { className: "flex-1 h-48" },
  triple: { first: "w-full h-48", others: "flex-1 h-32" }
} as const;

export const VIDEO_PREVIEW_STYLES = {
  container: {
    position: 'relative' as const,
    width: '100%',
    height: 300,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden' as const
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative' as const
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 10
  },
  videoPlayer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  },
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.1)'
  },
  playButton: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 50,
    padding: 15
  },
  durationBadge: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    borderRadius: 4
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold' as const
  },
  errorContainer: {
    backgroundColor: '#f8f9fa',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 8
  },
  errorText: {
    color: '#6c757d',
    fontSize: 14,
    marginBottom: 8
  },
  retryText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600' as const
  }
};