# 🧠 Brainlot - AI-Powered Learning Platform

Transform your study materials into interactive quizzes with AI. Upload PDFs and images to generate MCQs and learn with engaging TikTok-style swipeable flashcards.

[![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.com/)
[![Expo](https://img.shields.io/badge/Expo-SDK_52-000020?logo=expo)](https://expo.dev/)

## ✨ Features

- 📄 **PDF Upload**: Generate MCQs from PDF study materials
- 🖼️ **Image Upload**: Create quizzes from images and screenshots
- 🎯 **Swipeable Quiz Interface**: Instagram Reels-style learning experience
- 📊 **Progress Tracking**: Real-time scoring and performance metrics
- 💳 **Subscription Plans**: Free (10 uploads) and Pro (unlimited) tiers
- 🔐 **Secure Authentication**: Email, Google Sign-In, and Apple Sign-In
- 🌙 **Theme Support**: Light and dark mode

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI
- Supabase account
- Google Gemini API key

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/quiz-reels.git
cd quiz-reels/frontend
npm install
```

### 2. Environment Setup
Create `frontend/.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# EXPO_PUBLIC_REVENUECAT_API_KEY=your-rc-key (optional)
```

See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for detailed instructions.

### 3. Database Setup
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Open SQL Editor
4. Run `/backend/supabase/migrations/create_subscription_tables.sql`

### 4. Deploy Edge Function
```bash
cd backend
supabase functions deploy generate-mcqs
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
```

### 5. Run the App
```bash
cd frontend
npm start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan QR code with Expo Go.

## 📚 Documentation

- **[PRE_LAUNCH_SUMMARY.md](./PRE_LAUNCH_SUMMARY.md)** - Complete launch readiness overview
- **[LAUNCH_READINESS_CHECKLIST.md](./LAUNCH_READINESS_CHECKLIST.md)** - Detailed pre-launch checklist
- **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** - Environment variables guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - App Store & Play Store deployment
- **[REVENUECAT_SETUP_GUIDE.md](./REVENUECAT_SETUP_GUIDE.md)** - In-app purchases setup
- **[PRIVACY_POLICY_TEMPLATE.md](./PRIVACY_POLICY_TEMPLATE.md)** - Privacy policy template

## 🏗️ Tech Stack

### Frontend
- **React Native** (Expo SDK 52) - Cross-platform mobile framework
- **TypeScript** - Type-safe development
- **React Navigation** - Navigation library
- **Expo Modules** - Camera, Document Picker, Haptics, etc.

### Backend
- **Supabase** - Authentication, database, and storage
- **PostgreSQL** - Relational database with RLS
- **Deno Edge Functions** - Serverless API endpoints
- **Google Gemini AI** - MCQ generation from documents

### Additional Services
- **RevenueCat** (Optional) - In-app subscription management
- **Expo Application Services (EAS)** - Build and deployment

## 📱 App Structure

```
quiz-reels/
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React Context providers (Auth, Subscription, Theme)
│   │   ├── screens/        # App screens (Auth, Feed, Upload, etc.)
│   │   └── lib/            # Utilities (Supabase client, logger, error handling)
│   ├── assets/             # Images and icons
│   ├── app.json            # Expo configuration
│   └── package.json        # Dependencies
├── backend/
│   └── supabase/
│       ├── functions/      # Edge Functions (generate-mcqs)
│       └── migrations/     # Database migrations
└── README.md
```

## 🔐 Security Features

- ✅ Row Level Security (RLS) enabled on all database tables
- ✅ JWT token verification in Edge Functions
- ✅ Environment variable validation
- ✅ No hardcoded API keys
- ✅ Production-safe logging (dev-only console output)
- ✅ Secure authentication with OAuth 2.0

## 📊 Database Schema

### `user_subscriptions`
- Tracks user subscription plans (free/pro)
- Stores RevenueCat customer IDs
- Manages subscription status and expiration

### `user_usage_stats`
- Monitors upload counts per user
- Enforces upload limits (10 for free, unlimited for pro)
- Tracks last upload timestamps

See `/backend/supabase/migrations/create_subscription_tables.sql` for full schema.

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm test

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

### Manual Testing Checklist
- [ ] User registration and login
- [ ] Google Sign-In and Apple Sign-In
- [ ] PDF upload and MCQ generation
- [ ] Image upload and MCQ generation
- [ ] Quiz interaction and scoring
- [ ] Free plan upload limits (10 uploads)
- [ ] Subscription screen functionality

## 🚀 Deployment

### Build for Production
```bash
cd frontend
eas init
eas build --platform all --profile production
```

### Submit to Stores
```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

## 📈 Roadmap

- [x] Core quiz generation functionality
- [x] User authentication (Email, Google, Apple)
- [x] Upload limits and usage tracking
- [x] Subscription infrastructure (mock)
- [ ] Real in-app purchases (RevenueCat)
- [ ] Spaced repetition algorithm
- [ ] Study statistics dashboard
- [ ] Social sharing and leaderboards
- [ ] Offline mode
- [ ] Multi-language support

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) - Backend infrastructure
- [Expo](https://expo.dev/) - React Native framework
- [Google Gemini](https://ai.google.dev/) - AI-powered MCQ generation
- [RevenueCat](https://www.revenuecat.com/) - Subscription management

## 📞 Support

- **Email**: [your-support-email@example.com]
- **Issues**: [GitHub Issues](https://github.com/yourusername/quiz-reels/issues)
- **Documentation**: See `/docs` folder for detailed guides

## 🎯 Current Status

**Production Ready**: ✅ 95% Complete

**Remaining Tasks**:
- [ ] Create and host privacy policy
- [ ] Set up EAS project (`eas init`)
- [ ] Deploy Edge Function to Supabase
- [ ] Add `.env` file with credentials
- [ ] Apply database migrations

See [PRE_LAUNCH_SUMMARY.md](./PRE_LAUNCH_SUMMARY.md) for complete launch checklist.

---

Made with ❤️ by [Your Name]

**Star ⭐ this repo if you find it helpful!**

