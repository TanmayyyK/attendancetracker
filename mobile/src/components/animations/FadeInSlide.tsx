import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
} from 'react-native-reanimated';

export interface FadeInSlideProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export const FadeInSlide: React.FC<FadeInSlideProps> = ({
  children,
  delay = 0,
  direction = 'up',
  duration = 400,
  style,
}) => {
  const getEnteringAnimation = () => {
    switch (direction) {
      case 'down':
        return FadeInUp.delay(delay).duration(duration).springify();
      case 'left':
        return FadeInRight.delay(delay).duration(duration).springify();
      case 'right':
        return FadeInLeft.delay(delay).duration(duration).springify();
      case 'up':
      default:
        return FadeInDown.delay(delay).duration(duration).springify();
    }
  };

  return (
    <Animated.View style={style} entering={getEnteringAnimation()}>
      {children}
    </Animated.View>
  );
};
