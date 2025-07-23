# KitchAI v2

🍳 **Empowers users with AI-driven recipe discovery and pantry management**

KitchAI v2 is a React Native application that leverages artificial intelligence to revolutionize how users discover recipes, manage their pantry, and plan meals. The app features AI-powered pantry scanning, personalized recipe recommendations, and social cooking features.

## Table of Contents
- [Key Features](#-key-features)
- [Technical Stack](#️-technical-stack)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Development](#️-development)
- [Architecture Highlights](#️-architecture-highlights)
- [Project Status](#-project-status)
- [Contributing](#-contributing)
- [Audit Resources](#-audit-resources)
- [License](#-license)
- [Support & Troubleshooting](#-support--troubleshooting)

## ✨ Key Features

- 🤖 **AI-Powered Pantry Scanning**: Use your camera to automatically identify and catalog pantry items
- 🎯 **Smart Recipe Recommendations**: Get personalized recipe suggestions based on your available ingredients
- 📱 **Social Cooking Platform**: Share recipes, follow other cooks, and discover trending dishes
- 📊 **Meal Planning**: Plan your weekly meals with intelligent ingredient aggregation
- 🛒 **Smart Grocery Lists**: Generate shopping lists from your meal plans
- 🎥 **Video Recipe Integration**: Upload and share cooking videos with your recipes
- 💎 **Freemium Model**: Basic features free, premium features for enhanced experience

## 🏗️ Technical Stack

- **Frontend**: React Native 0.79.4 with TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI Integration**: OpenAI GPT-4o for image recognition and recipe generation
- **Navigation**: React Navigation v7
- **State Management**: React Query + Context API
- **UI Framework**: React Native Paper + NativeWind (Tailwind CSS)
- **Development**: Expo 53.0.13 development platform

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development) or Android Studio (for Android development)

### Installation

```bash
# Clone the repository
git clone https://github.com/chieftitan88/kitchai-v2.git
cd kitchai-v2

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Environment Setup

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Configure your environment variables:
   - `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON`: Your Supabase anon key
   - `OPENAI_API_KEY`: OpenAI API key for AI features

3. Validate environment setup:
   ```bash
   # Validate environment configuration
   node -e "console.log(process.env.EXPO_PUBLIC_SUPABASE_URL ? '✅ Supabase URL configured' : '❌ Missing Supabase URL')"
   ```

4. Run the app:
   ```bash
   # iOS
   npx expo run:ios

   # Android
   npx expo run:android
   ```

**Note**: Check package.json for latest dependency versions if you encounter version conflicts.

## 📚 Documentation

Comprehensive documentation is organized in the `/docs` directory:

### 🎯 Quick Links
- **[📖 Complete Documentation Index](docs/README.md)** - Full documentation navigation
- **[🏗️ System Architecture](docs/system/PROJECT_DOCUMENTATION.md)** - Technical architecture overview
- **[🚀 Deployment Guide](docs/KITCHAI_DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[🧪 Testing Guide](docs/production/PRODUCTION_TEST_RESULTS.md)** - Testing procedures and results

### 📁 Documentation Categories
- **[🚀 Deployment](docs/deployment/)** - Deployment procedures and checklists
- **[🔧 Backend](docs/backend/)** - Backend architecture and migration guides
- **[🏭 Production](docs/production/)** - Production setup and RPC documentation
- **[📋 Compliance](docs/compliance/)** - App Store compliance and legal requirements
- **[✨ Features](docs/features/)** - Feature-specific implementation guides
- **[🖥️ System](docs/system/)** - System architecture and project documentation

## 🛠️ Development

### Project Structure

```
kitchai-v2/
├── src/                    # Source code
│   ├── components/         # Reusable UI components
│   ├── screens/           # Screen components
│   ├── hooks/             # Custom React hooks
│   ├── providers/         # Context providers
│   ├── services/          # External service integrations
│   ├── utils/             # Utility functions
│   └── navigation/        # Navigation configuration
├── docs/                  # Documentation (organized by category)
├── supabase/             # Database migrations and functions
├── assets/               # Static assets
└── scripts/              # Build and deployment scripts
```

### Key Technologies

- **TypeScript**: Strict type checking enabled for production-grade code quality
- **React Query**: Powerful data fetching and caching
- **Supabase**: Real-time database with Row Level Security
- **OpenAI Integration**: AI-powered pantry scanning and recipe generation
- **Expo**: Managed React Native development and deployment

### Development Scripts

```bash
# Development
npm start                 # Start Expo development server
npm run android          # Run on Android
npm run ios              # Run on iOS

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format code with Prettier
npm run security-check   # Run security validation
npm run pre-audit        # Combined security and TypeScript checks

# TypeScript
npx tsc --noEmit         # Type checking without compilation
```

## 🏛️ Architecture Highlights

KitchAI v2 demonstrates enterprise-grade architecture with comprehensive security and performance optimizations. For detailed technical architecture, see [Complete System Documentation](docs/system/PROJECT_DOCUMENTATION.md).

### AI-Driven Features
- **Pantry Scanning**: Camera-based ingredient recognition using OpenAI Vision API
- **Recipe Generation**: AI-powered recipe suggestions based on available ingredients
- **Smart Matching**: Intelligent ingredient matching with fuzzy logic

### Performance Optimizations
- **Image Compression**: Optimized image processing for faster uploads
- **Lazy Loading**: Component-level code splitting and lazy loading
- **Caching Strategy**: Multi-layer caching with React Query and Supabase
- **Real-time Updates**: WebSocket-based real-time data synchronization

### Security & Privacy
- **Row Level Security**: Database-level access control
- **Data Sanitization**: Automated sensitive data redaction in logs
- **GDPR/CCPA Compliance**: Privacy-first data handling
- **OAuth Integration**: Secure authentication with multiple providers

## 📊 Project Status

- ✅ **Phase 1 Complete**: Core functionality and TypeScript migration
- 🧪 **Beta Testing**: Preparing for TestFlight deployment
- 🎯 **Production Ready**: 85% deployment readiness achieved
- 📈 **Performance**: TikTok-level video optimization implemented

## 🤝 Contributing

### Development Workflow
1. **Fork the repository** at https://github.com/chieftitan88/kitchai-v2
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow TypeScript and linting guidelines
4. **Test your changes**: Ensure all tests pass and aim for 80%+ coverage with Jest + React Native Testing Library
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Standards
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Airbnb configuration with React Native extensions
- **Prettier**: Consistent code formatting
- **Testing**: Jest + React Native Testing Library (target 80%+ coverage)
- **Code Review**: Follow security validation checklist

## 🔍 Audit Resources

Documentation for external audits and compliance verification:

- [Security Implementation Report](docs/system/SECURITY_IMPLEMENTATION_REPORT.md) - Comprehensive security measures
- [Deployment Readiness Audit](docs/deployment/DEPLOYMENT_READINESS_AUDIT_2025.md) - Production readiness assessment
- [Apple App Store Compliance](docs/compliance/APPLE_APP_STORE_COMPLIANCE_DOCUMENTATION.md) - App Store submission requirements
- [Backend Documentation](docs/system/PROJECT_DOCUMENTATION.md) - Complete technical architecture
- **Last Updated**: January 28, 2025

## 📄 License

Proprietary software, All Rights Reserved under KitchAI Custom License v1.0.

## 🆘 Support & Troubleshooting

### Common Issues
- **Build Errors**: Check TypeScript compilation with `npx tsc --noEmit`
- **Environment Issues**: Verify all environment variables are set correctly using validation command above
- **iOS Build Issues**: Clean Xcode build folder and rebuild
- **Android Issues**: Clean Gradle cache and rebuild

### Getting Help
- **Documentation**: Check `/docs` directory for comprehensive guides
- **Issues**: Create GitHub issues for bug reports at https://github.com/chieftitan88/kitchai-v2/issues
- **Development**: Refer to component documentation in `/docs/components`

### Contact
For development questions or collaboration inquiries, please use the GitHub issues system for tracking and transparency.

---

**KitchAI v2** - *Revolutionizing cooking with AI-powered intelligence*  
*Built with ❤️ and cutting-edge technology* 