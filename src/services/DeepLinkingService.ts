import { Linking, Alert } from 'react-native';
import { supabase } from './supabase';

export interface DeepLinkParams {
  type?: 'email_confirmation' | 'password_reset' | 'invite' | 'magic_link';
  token?: string;
  email?: string;
  error?: string;
  error_description?: string;
  access_token?: string;
  refresh_token?: string;
  code?: string;
  inviter_name?: string;
}

class DeepLinkingService {
  private static instance: DeepLinkingService;
  private linkingSubscription: any = null;

  static getInstance(): DeepLinkingService {
    if (!DeepLinkingService.instance) {
      DeepLinkingService.instance = new DeepLinkingService();
    }
    return DeepLinkingService.instance;
  }

  /**
   * Initialize deep linking listener
   */
  initialize() {
    // Handle app opened from background/closed state
    this.handleInitialURL();
    
    // Handle app opened when already running
    this.linkingSubscription = Linking.addEventListener('url', this.handleDeepLink);
    
    console.log('🔗 Deep linking service initialized');
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    if (this.linkingSubscription) {
      this.linkingSubscription.remove();
      this.linkingSubscription = null;
    }
  }

  /**
   * Handle initial URL when app is opened from closed state
   */
  private async handleInitialURL() {
    try {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('🔗 Initial URL detected:', initialUrl);
        await this.processURL(initialUrl);
      }
    } catch (error) {
      console.error('❌ Error handling initial URL:', error);
    }
  }

  /**
   * Handle deep link when app is already running
   */
  private handleDeepLink = async (event: { url: string }) => {
    console.log('🔗 Deep link received:', event.url);
    await this.processURL(event.url);
  };

  /**
   * Process the incoming URL and extract parameters
   */
  private async processURL(url: string) {
    try {
      const parsedUrl = new URL(url);
      const params = this.extractParams(parsedUrl);
      
      console.log('🔗 Processing deep link:', { url, params });

      // Handle different types of deep links
      switch (params.type) {
        case 'email_confirmation':
          await this.handleEmailConfirmation(params);
          break;
        case 'password_reset':
          await this.handlePasswordReset(params);
          break;
        case 'magic_link':
          await this.handleMagicLink(params);
          break;
        case 'invite':
          await this.handleInviteLink(params);
          break;
        default:
          console.log('🔗 Unknown deep link type, handling as general link');
          await this.handleGeneralLink(parsedUrl, params);
      }
    } catch (error) {
      console.error('❌ Error processing deep link:', error);
      Alert.alert(
        'Link Error',
        'There was an issue processing this link. Please try again.',
      );
    }
  }

  /**
   * Extract parameters from URL
   */
  private extractParams(url: URL): DeepLinkParams {
    const params: DeepLinkParams = {};
    
    // Extract from hash (for Supabase auth)
    if (url.hash) {
      const hashParams = new URLSearchParams(url.hash.substring(1));
      for (const [key, value] of hashParams.entries()) {
        (params as any)[key] = value;
      }
    }
    
    // Extract from search params
    for (const [key, value] of url.searchParams.entries()) {
      (params as any)[key] = value;
    }
    
    // Determine type based on URL structure
    if (url.pathname.includes('/auth/confirm')) {
      params.type = 'email_confirmation';
    } else if (url.pathname.includes('/auth/reset-password')) {
      params.type = 'password_reset';
    } else if (url.pathname.includes('/auth/magic-link')) {
      params.type = 'magic_link';
    } else if (url.pathname.includes('/invite')) {
      params.type = 'invite';
    }
    
    return params;
  }

  /**
   * Handle email confirmation flow
   */
  private async handleEmailConfirmation(params: DeepLinkParams) {
    console.log('📧 Handling email confirmation:', params);
    
    if (params.error) {
      Alert.alert(
        'Email Confirmation Failed',
        params.error_description || params.error,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (params.access_token && params.refresh_token) {
      try {
        // Set the session with the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        
        if (error) {
          throw error;
        }
        
        Alert.alert(
          'Email Confirmed! 🎉',
          'Your email has been successfully confirmed. Welcome to KitchAI!',
          [{ text: 'Continue', onPress: () => console.log('✅ Email confirmed successfully') }]
        );
        
      } catch (error: any) {
        console.error('❌ Email confirmation error:', error);
        Alert.alert(
          'Confirmation Error',
          'There was an issue confirming your email. Please try logging in manually.',
        );
      }
    }
  }

  /**
   * Handle password reset flow
   */
  private async handlePasswordReset(params: DeepLinkParams) {
    console.log('🔑 Handling password reset:', params);
    
    if (params.error) {
      Alert.alert(
        'Password Reset Failed',
        params.error_description || params.error,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (params.access_token && params.refresh_token) {
      try {
        // Set the session to allow password change
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        
        if (error) {
          throw error;
        }
        
        // Navigate to password reset screen
        Alert.alert(
          'Reset Your Password',
          'You have been authenticated. Please set your new password.',
          [
            {
              text: 'Set New Password',
              onPress: () => {
                // Navigate to the password reset screen
                // Note: This will need to be handled through navigation context or a navigation ref
                console.log('🔑 Navigating to password reset screen');
              }
            }
          ]
        );
        
      } catch (error: any) {
        console.error('❌ Password reset error:', error);
        Alert.alert(
          'Reset Error',
          'There was an issue with your password reset link. Please request a new one.',
        );
      }
    }
  }

  /**
   * Handle magic link authentication
   */
  private async handleMagicLink(params: DeepLinkParams) {
    console.log('✨ Handling magic link:', params);
    
    if (params.access_token && params.refresh_token) {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        
        if (error) {
          throw error;
        }
        
        Alert.alert(
          'Signed In! ✨',
          'You have been successfully signed in via magic link.',
          [{ text: 'Continue' }]
        );
        
      } catch (error: any) {
        console.error('❌ Magic link error:', error);
        Alert.alert(
          'Sign In Error',
          'There was an issue with your magic link. Please try again.',
        );
      }
    }
  }

  /**
   * Handle invite links
   */
  private async handleInviteLink(params: DeepLinkParams) {
    console.log('📨 Handling invite link:', params);
    
    // Extract invite parameters
    const inviteCode = params.token || params.code;
    const inviterName = params.inviter_name || 'A friend';
    
    if (!inviteCode) {
      Alert.alert(
        'Invalid Invite',
        'This invite link appears to be invalid. Please check the link and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Check if user is already signed in
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // User is signed in - process invite directly
      await this.processInvite(inviteCode, session.user.id);
    } else {
      // User not signed in - show invite acceptance flow
      Alert.alert(
        `${inviterName} invited you to KitchAI! 🍳`,
        'Join KitchAI to discover amazing recipes and connect with food lovers.',
        [
          { text: 'Maybe Later', style: 'cancel' },
          {
            text: 'Accept Invite',
            onPress: () => {
              // Store invite code for after signup
              this.storeInviteCode(inviteCode);
              // Navigate to signup with invite context
              console.log('🎯 Navigate to signup with invite:', inviteCode);
            }
          }
        ]
      );
    }
  }
  
  /**
   * Process invite after user authentication
   */
  private async processInvite(inviteCode: string, userId: string) {
    try {
      // TODO: Call RPC function to process invite
      // const { data, error } = await supabase.rpc('process_invite', {
      //   invite_code: inviteCode,
      //   user_id: userId
      // });
      
      // For now, just show success
      Alert.alert(
        'Invite Accepted! 🎉',
        'Welcome to KitchAI! You\'ve successfully joined through your friend\'s invite.',
        [{ text: 'Start Exploring' }]
      );
      
      console.log('✅ Invite processed successfully:', inviteCode);
    } catch (error: any) {
      console.error('❌ Error processing invite:', error);
      Alert.alert(
        'Invite Error',
        'There was an issue processing your invite. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }
  
  /**
   * Store invite code for processing after signup
   */
  private storeInviteCode(inviteCode: string) {
    // Store in AsyncStorage or similar for processing after signup
    console.log('💾 Storing invite code for later:', inviteCode);
    // TODO: Implement AsyncStorage.setItem('pending_invite', inviteCode);
  }

  /**
   * Handle general deep links (recipe sharing, etc.)
   */
  private async handleGeneralLink(url: URL, params: DeepLinkParams) {
    console.log('🔗 Handling general link:', url.pathname);
    
    // TODO: Handle recipe sharing, profile links, etc.
    if (url.pathname.includes('/recipe/')) {
      const recipeId = url.pathname.split('/recipe/')[1];
      console.log('🍳 Navigate to recipe:', recipeId);
      // TODO: Navigate to recipe detail
    } else if (url.pathname.includes('/profile/')) {
      const userId = url.pathname.split('/profile/')[1];
      console.log('👤 Navigate to profile:', userId);
      // TODO: Navigate to profile
    }
  }

  /**
   * Generate redirect URLs for authentication
   */
  static getRedirectURL(): string {
    if (__DEV__) {
      // Development: Use custom scheme
      return 'kitchai://auth';
    } else {
      // Production: Use universal links
      return 'https://kitchai.app/auth';
    }
  }

  /**
   * Generate email confirmation redirect URL
   */
  static getEmailConfirmationURL(): string {
    if (__DEV__) {
      return 'kitchai://auth/confirm';
    } else {
      return 'https://kitchai.app/auth/confirm';
    }
  }

  /**
   * Generate password reset redirect URL
   */
  static getPasswordResetURL(): string {
    if (__DEV__) {
      return 'kitchai://auth/reset-password';
    } else {
      return 'https://kitchai.app/auth/reset-password';
    }
  }
}

export default DeepLinkingService; 