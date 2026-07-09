import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';

/**
 * Smooth expand/collapse container. The content stays mounted (so its height
 * is known before the first open) and the wrapper animates height + opacity.
 * Content expands in place — no layout jumps elsewhere on the page.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const [contentH, setContentH] = useState(0);
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 260,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false, // height cannot use the native driver
    }).start();
  }, [open, anim]);

  return (
    <Animated.View
      style={{
        overflow: 'hidden',
        opacity: anim,
        height: contentH === 0 ? undefined : anim.interpolate({ inputRange: [0, 1], outputRange: [0, contentH] }),
      }}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <View
        // Absolute while measuring/collapsed keeps the closed state at height 0
        // without unmounting children.
        style={contentH === 0 ? { position: 'absolute', left: 0, right: 0, opacity: 0 } : undefined}
        onLayout={(e) => {
          const h = Math.ceil(e.nativeEvent.layout.height);
          if (h > 0 && h !== contentH) setContentH(h);
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
