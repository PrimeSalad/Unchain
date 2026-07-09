import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

const COLORS = ['#8A5FBF', '#E8697A', '#E3B34C', '#5A9B6B', '#4A6FA5', '#3E9C9C'];

interface Particle {
  angle: number;
  dist: number;
  size: number;
  color: string;
  spin: number;
  delay: number;
  duration: number;
  round: boolean;
}

/**
 * A gentle celebratory burst from the centre of its parent. Pure RN Animated,
 * pointer-events none, unmount-safe. Calm by design: soft colours, small
 * counts, no screen-filling chaos.
 */
export function ConfettiBurst({ count = 26, play }: { count?: number; play: boolean }) {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        angle: (i / count) * Math.PI * 2 + Math.random() * 0.5,
        dist: 90 + Math.random() * 130,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        spin: (Math.random() - 0.5) * 720,
        delay: Math.random() * 120,
        duration: 1100 + Math.random() * 600,
        round: Math.random() < 0.5,
      })),
    [count],
  );

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      {play && particles.map((p, i) => <Piece key={i} p={p} />)}
    </View>
  );
}

function Piece({ p }: { p: Particle }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: p.duration,
      delay: p.delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim, p]);

  const dx = Math.cos(p.angle) * p.dist;
  const dy = Math.sin(p.angle) * p.dist;

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  // Rise a little, then settle past the radial target — reads as a soft arc.
  const translateY = anim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, dy * 0.45 - 40, dy + 60],
  });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1, 0.9] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: p.size,
        height: p.round ? p.size : p.size * 1.7,
        borderRadius: p.round ? p.size / 2 : 2,
        backgroundColor: p.color,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate }, { scale }],
      }}
    />
  );
}
