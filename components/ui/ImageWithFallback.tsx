import { useNetworkConnectionKey } from '@/contexts/NetworkContext';
import { Image, type ImageContentFit, type ImageProps } from 'expo-image';
import React, { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

interface ImageWithFallbackProps extends Omit<ImageProps, 'style'> {
  /** Legacy RN Image prop — forwarded to expo-image's contentFit. */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  className?: string;
  style?: StyleProp<ViewStyle>;
}

// expo-image does not honor NativeWind className, and expects explicit
// dimensions in its style prop. We wrap it in a View that takes the className
// / style, and give the inner Image { width: '100%', height: '100%' } so it
// fills the wrapper. When the source is missing or fails to load, we render
// a plain gray placeholder inside the wrapper.
const RESIZE_MODE_TO_CONTENT_FIT: Record<
  NonNullable<ImageWithFallbackProps['resizeMode']>,
  ImageContentFit
> = { cover: 'cover', contain: 'contain', stretch: 'fill', center: 'none' };

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  source,
  className,
  style,
  resizeMode,
  contentFit,
  ...imageProps
}) => {
  const [hasError, setHasError] = useState(false);
  const connectionKey = useNetworkConnectionKey();

  React.useEffect(() => {
    if (connectionKey > 0) {
      setHasError(false);
    }
  }, [connectionKey]);

  const hasEmptyUri =
    source && typeof source === 'object' && 'uri' in source && !source.uri;
  const showPlaceholder = hasError || hasEmptyUri || !source;
  // RN's `resizeMode` vocabulary is not expo-image's `contentFit` vocabulary:
  // `stretch` is `fill` and `center` is `none`. Translating them is the whole
  // point of accepting the legacy prop — forwarding them unchanged handed
  // expo-image two values it does not understand, and it fell back to its own
  // default rather than doing what the caller asked.
  const fit: ImageContentFit =
    contentFit ?? (resizeMode ? RESIZE_MODE_TO_CONTENT_FIT[resizeMode] : 'cover');

  return (
    <View className={className} style={style}>
      {showPlaceholder ? (
        <View style={{ width: '100%', height: '100%', backgroundColor: '#e5e7eb' }} />
      ) : (
        <Image
          {...imageProps}
          source={source}
          onError={() => setHasError(true)}
          style={{ width: '100%', height: '100%' }}
          contentFit={fit}
          cachePolicy="memory-disk"
        />
      )}
    </View>
  );
};

export default ImageWithFallback;
