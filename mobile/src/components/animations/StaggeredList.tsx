import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export interface StaggeredListProps {
  children: React.ReactNode;
  staggerDelay?: number;
  style?: StyleProp<ViewStyle>;
}

export const StaggeredList: React.FC<StaggeredListProps> = ({
  children,
  staggerDelay = 60,
  style,
}) => {
  return (
    <View style={style}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;
        return (
          <Animated.View key={index} entering={FadeInDown.delay(index * staggerDelay).springify()}>
            {child}
          </Animated.View>
        );
      })}
    </View>
  );
};
