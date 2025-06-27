import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PrismaticCelebrationProps {
  visible: boolean;
  onComplete?: () => void;
  intensity?: 'premium' | 'ultra' | 'legendary';
  theme?: 'gold' | 'prismatic' | 'neural';
}

// 🌈 Premium color palettes for 2025
const CELEBRATION_THEMES = {
  gold: {
    primary: '#FFD700',
    secondary: '#FFA500', 
    accent: '#FF6B35',
    glow: '#FFEB3B',
    background: 'rgba(255, 215, 0, 0.1)',
  },
  prismatic: {
    primary: '#FF6B9D',
    secondary: '#4ECDC4',
    accent: '#45B7D1', 
    glow: '#96CEB4',
    background: 'rgba(255, 107, 157, 0.08)',
  },
  neural: {
    primary: '#667EEA',
    secondary: '#764BA2',
    accent: '#F093FB',
    glow: '#F5576C',
    background: 'rgba(102, 126, 234, 0.05)',
  },
};

// 🎯 Energy burst component for radial waves
const EnergyWave: React.FC<{
  delay: number;
  theme: typeof CELEBRATION_THEMES.prismatic;
  onComplete?: () => void;
}> = ({ delay, theme, onComplete }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const startAnimation = () => {
      // Explosive scale burst
      scale.value = withSequence(
        withTiming(0.2, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(4, { duration: 1200, easing: Easing.out(Easing.cubic) })
      );
      
      // Opacity fade with premium timing
      opacity.value = withSequence(
        withTiming(0.8, { duration: 200, easing: Easing.out(Easing.quad) }),
        withDelay(400, withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) }))
      );
    };

    const timer = setTimeout(() => {
      startAnimation();
      if (onComplete) {
        setTimeout(() => runOnJS(onComplete)(), 1500);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.energyWave, { borderColor: theme.primary }, animatedStyle]} />
  );
};

// ✨ Prismatic light ray component
const PrismaticRay: React.FC<{
  angle: number;
  delay: number;
  theme: typeof CELEBRATION_THEMES.prismatic;
}> = ({ angle, delay, theme }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const startAnimation = () => {
      // Calculate ray endpoint
      const distance = Math.max(screenWidth, screenHeight) * 0.6;
      const endX = Math.cos(angle) * distance;
      const endY = Math.sin(angle) * distance;

      // Explosive ray burst
      translateX.value = withTiming(endX, { 
        duration: 1000, 
        easing: Easing.out(Easing.cubic) 
      });
      translateY.value = withTiming(endY, { 
        duration: 1000, 
        easing: Easing.out(Easing.cubic) 
      });

      // Premium fade sequence
      opacity.value = withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withDelay(400, withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) }))
      );

      // Scale animation
      scale.value = withSpring(1, { damping: 8, stiffness: 100 });
    };

    const timer = setTimeout(startAnimation, delay);
    return () => clearTimeout(timer);
  }, [angle, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${(angle * 180) / Math.PI}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View 
      style={[
        styles.prismaticRay, 
        { backgroundColor: theme.secondary },
        animatedStyle
      ]} 
    />
  );
};

// 🏆 Success badge with premium materialization
const SuccessBadge: React.FC<{
  theme: typeof CELEBRATION_THEMES.prismatic;
  onComplete?: () => void;
}> = ({ theme, onComplete }) => {
  const scale = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const startAnimation = () => {
      // Premium badge materialization
      scale.value = withSequence(
        withDelay(800, withSpring(1.2, { damping: 6, stiffness: 120 })),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) })
      );

      // 3D rotation effect
      rotateY.value = withSequence(
        withDelay(800, withTiming(360, { duration: 600, easing: Easing.out(Easing.back(1.2)) })),
        withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) })
      );

      // Fade in with glow
      opacity.value = withDelay(800, withTiming(1, { 
        duration: 400, 
        easing: Easing.out(Easing.quad) 
      }));
    };

    startAnimation();
    
    // Complete callback
    const timer = setTimeout(() => {
      if (onComplete) runOnJS(onComplete)();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotateY: `${rotateY.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.successBadge, animatedStyle]}>
      <View style={[styles.badgeInner, { backgroundColor: theme.primary }]}>
        <View style={[styles.badgeGlow, { backgroundColor: theme.glow }]} />
      </View>
    </Animated.View>
  );
};

// 🎆 Main Prismatic Celebration Component
export const PrismaticCelebration: React.FC<PrismaticCelebrationProps> = ({
  visible,
  onComplete,
  intensity = 'premium',
  theme = 'prismatic',
}) => {
  const completedAnimations = useRef(0);
  const totalAnimations = useRef(0);
  const backgroundOpacity = useSharedValue(0);

  const selectedTheme = CELEBRATION_THEMES[theme];

  // Calculate animation counts based on intensity
  const config = {
    premium: { waves: 3, rays: 8, duration: 2500 },
    ultra: { waves: 4, rays: 12, duration: 3000 },
    legendary: { waves: 5, rays: 16, duration: 3500 },
  }[intensity];

  totalAnimations.current = config.waves + config.rays + 1; // +1 for badge

  const handleAnimationComplete = () => {
    completedAnimations.current += 1;
    
    // Complete when 80% of animations are done
    if (completedAnimations.current >= totalAnimations.current * 0.8) {
      onComplete?.();
    }
  };

  useEffect(() => {
    if (!visible) {
      backgroundOpacity.value = withTiming(0, { duration: 300 });
      completedAnimations.current = 0;
      return;
    }

    // Premium background glow
    backgroundOpacity.value = withSequence(
      withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
      withDelay(config.duration - 500, withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) }))
    );

    // Auto-complete failsafe
    const autoCompleteTimer = setTimeout(() => {
      onComplete?.();
    }, config.duration);

    return () => clearTimeout(autoCompleteTimer);
  }, [visible, intensity]);

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: selectedTheme.background,
    opacity: backgroundOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFillObject, backgroundStyle]} />
      
      {/* Energy Waves */}
      {Array.from({ length: config.waves }, (_, i) => (
        <EnergyWave
          key={`wave-${i}`}
          delay={i * 200}
          theme={selectedTheme}
          onComplete={handleAnimationComplete}
        />
      ))}
      
      {/* Prismatic Rays */}
      {Array.from({ length: config.rays }, (_, i) => (
        <PrismaticRay
          key={`ray-${i}`}
          angle={(Math.PI * 2 * i) / config.rays}
          delay={100 + i * 50}
          theme={selectedTheme}
        />
      ))}
      
      {/* Success Badge */}
      <SuccessBadge 
        theme={selectedTheme} 
        onComplete={handleAnimationComplete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  energyWave: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  prismaticRay: {
    position: 'absolute',
    width: 4,
    height: 80,
    borderRadius: 2,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  successBadge: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  badgeGlow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.8,
  },
});

export default PrismaticCelebration; 