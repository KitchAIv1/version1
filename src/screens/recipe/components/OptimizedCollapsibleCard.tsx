import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Feather } from '@expo/vector-icons';

const BRAND_PRIMARY = '#10B981';

interface OptimizedCollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  icon?: string;
}

export const OptimizedCollapsibleCard = React.memo<OptimizedCollapsibleCardProps>(({
  title,
  children,
  defaultCollapsed = false,
  icon,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const animatedHeight = useMemo(() => new Animated.Value(defaultCollapsed ? 0 : 1), [defaultCollapsed]);

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed, animatedHeight]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const headerStyle = useMemo(() => [
    styles.cardHeader,
    !isCollapsed && styles.activeCardHeader,
  ], [isCollapsed]);

  const titleStyle = useMemo(() => [
    styles.cardTitle,
    !isCollapsed && styles.activeCardTitle,
  ], [isCollapsed]);

  const iconColor = isCollapsed ? '#666' : BRAND_PRIMARY;
  const expandIconName = isCollapsed ? 'expand-more' : 'expand-less';

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        onPress={toggleCollapsed}
        style={headerStyle}
        activeOpacity={0.7}>
        <View style={styles.headerContent}>
          {icon && (
            <Feather
              name={icon as any}
              size={18}
              color={iconColor}
              style={styles.headerIcon}
            />
          )}
          <Text style={titleStyle}>{title}</Text>
        </View>
        <Icon
          name={expandIconName}
          size={24}
          color={iconColor}
        />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.animatedContent,
          {
            maxHeight: animatedHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1000],
            }),
            opacity: animatedHeight,
          },
        ]}>
        <View style={styles.cardContent}>{children}</View>
      </Animated.View>
    </View>
  );
});

OptimizedCollapsibleCard.displayName = 'OptimizedCollapsibleCard';

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 4,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  activeCardHeader: {
    backgroundColor: '#f9fafb',
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  activeCardTitle: {
    color: BRAND_PRIMARY,
  },
  animatedContent: {
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
});

export default OptimizedCollapsibleCard; 