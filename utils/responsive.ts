import { useWindowDimensions } from "react-native";

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const getResponsiveMetrics = (width: number, height: number) => {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  const scale = (size: number) => (shortSide / BASE_WIDTH) * size;
  const verticalScale = (size: number) => (longSide / BASE_HEIGHT) * size;
  const moderateScale = (size: number, factor = 0.5) =>
    size + (scale(size) - size) * factor;

  const wp = (percent: number) => (width * percent) / 100;
  const hp = (percent: number) => (height * percent) / 100;

  return {
    width,
    height,
    shortSide,
    longSide,
    scale,
    verticalScale,
    moderateScale,
    wp,
    hp,
    isSmallDevice: shortSide < 360,
    isTablet: shortSide >= 768,
  };
};

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const metrics = getResponsiveMetrics(width, height);

  return {
    ...metrics,
    s: metrics.scale,
    vs: metrics.verticalScale,
    ms: metrics.moderateScale,
  };
};
