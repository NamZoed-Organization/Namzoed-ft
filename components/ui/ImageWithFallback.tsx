import { useNetworkConnectionKey } from '@/contexts/NetworkContext';
import { Image, type ImageProps } from 'expo-image';
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
  const fit = contentFit ?? resizeMode ?? 'cover';

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
