import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
// import { BlurView } from 'expo-blur'; // Optional - requires expo-blur package
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Feather } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown,
  BounceIn,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CreatorAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateRecipe?: () => void;
  username?: string;
}

export const CreatorAccountModal: React.FC<CreatorAccountModalProps> = ({
  visible,
  onClose,
  onCreateRecipe,
  username = 'Creator',
}) => {
  const handleCreateRecipe = () => {
    onClose();
    onCreateRecipe?.();
  };

  const handleBackdropPress = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      
      {/* Backdrop with Semi-Transparent Effect */}
      <Animated.View 
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}>
        
        {/* Backdrop Touchable */}
        <TouchableOpacity 
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        
        {/* Modal Content */}
        <Animated.View
          entering={SlideInDown.duration(400).springify()}
          exiting={SlideOutDown.duration(300)}
          style={styles.modalContainer}>
          
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Header with Creator Badge */}
          <View style={styles.header}>
            <Animated.View 
              entering={BounceIn.delay(200).duration(600)}
              style={styles.creatorBadge}>
              <Icon name="star" size={32} color="#FFD700" />
              <Text style={styles.creatorText}>CREATOR</Text>
            </Animated.View>
            
            <Text style={styles.title}>Welcome, {username}!</Text>
            <Text style={styles.subtitle}>
              You have unlimited access to all KitchAI features
            </Text>
          </View>

          {/* Features Grid */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <FeatureCard 
                icon="videocam" 
                title="Unlimited Videos" 
                description="Share endless recipes"
                delay={300}
              />
              <FeatureCard 
                icon="auto-awesome" 
                title="AI Recipe Generator" 
                description="Unlimited AI creations"
                delay={400}
              />
            </View>
            
            <View style={styles.featureRow}>
              <FeatureCard 
                icon="camera-alt" 
                title="Pantry Scanner" 
                description="Unlimited scans"
                delay={500}
              />
              <FeatureCard 
                icon="monetization-on" 
                title="Monetization" 
                description="Earn from your content"
                delay={600}
              />
            </View>
          </View>

          {/* Call to Action */}
          <Animated.View 
            entering={SlideInDown.delay(700).duration(500)}
            style={styles.ctaContainer}>
            <Text style={styles.ctaTitle}>Ready to Share Your Culinary Magic?</Text>
            <Text style={styles.ctaSubtitle}>
              Post your food recipe videos and start building your audience
            </Text>
            
            <TouchableOpacity 
              style={styles.createButton}
              onPress={handleCreateRecipe}
              activeOpacity={0.8}>
              <View style={styles.createButtonContent}>
                <Feather name="video" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Recipe Video</Text>
                <Icon name="arrow-forward" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Secondary Action */}
            <TouchableOpacity 
              style={styles.learnMoreButton}
              onPress={() => {
                // Could navigate to creator resources
                onClose();
              }}
              activeOpacity={0.7}>
              <Text style={styles.learnMoreText}>Learn about Creator Benefits</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// Feature Card Component
const FeatureCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  delay: number;
}> = ({ icon, title, description, delay }) => (
  <Animated.View 
    entering={FadeIn.delay(delay).duration(400)}
    style={styles.featureCard}>
    <View style={styles.featureIconContainer}>
      <Icon name={icon} size={24} color="#10b981" />
    </View>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDescription}>{description}</Text>
  </Animated.View>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 80, // Much more bottom padding to prevent button cutoff
    paddingHorizontal: 24,
    maxHeight: screenHeight * 0.90, // Slightly taller modal
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff9e6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    marginBottom: 16,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  creatorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#b45309',
    marginLeft: 8,
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    marginBottom: 40, // Increased margin for better spacing
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  ctaContainer: {
    alignItems: 'center',
    paddingBottom: 30, // Increased bottom padding to ensure button visibility
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  createButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 24, // Increased bottom margin for better visibility
    width: '100%',
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  learnMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  learnMoreText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default CreatorAccountModal; 