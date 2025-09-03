import React, { useState } from 'react';
import { Image, ImageProps } from 'react-native';

interface ImageWithFallbackProps extends ImageProps {
  fallbackSource?: any;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  source,
  fallbackSource = require('@/assets/images/all.png'),
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // Use fallback if there's an error or if source is not valid
  const imageSource = hasError ? fallbackSource : source;

  return (
    <Image
      {...props}
      source={imageSource}
      onError={handleError}
      onLoad={handleLoad}
      onLoadEnd={handleLoad}
    />
  );
};

export default ImageWithFallback;