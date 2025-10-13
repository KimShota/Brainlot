# Edu-Shorts - MCQ Learning App 📚

Edu-Shorts is a learning app that automatically generates MCQs (Multiple Choice Questions) from PDFs and images.

## Main Features

- 📄 **PDF Upload**: Automatically generate MCQs from PDF files
- 🖼️ **Image Upload**: Generate questions from image files
- 🎯 **Swipe Learning**: Fun learning with TikTok-style UI
- 💳 **Subscription**: Free and Pro plans available

### Plan Details

#### Free Plan
- Price: Free
- Upload limit: Up to 10 uploads
- MCQ generation: 300 total (30 × 10 uploads)

#### Pro Plan
- Price: ¥600/month ($5/month)
- Upload limit: Unlimited
- MCQ generation: Unlimited
- Ad-free
- Cancel anytime

## Setup

### 1. Install Dependencies

   ```bash
   npm install
   ```

### 2. Environment Variables

Create a `.env` file and set the following variables:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_REVENUECAT_API_KEY=your_revenuecat_api_key
```

### 3. Supabase Setup

1. Create a Supabase project
2. Run `/backend/supabase/migrations/create_subscription_tables.sql` to create tables

### 4. Payment Feature Setup

#### If you have Apple Developer Program enrollment
See `SETUP_PAYMENT.md` for details.

#### If you don't have Apple Developer Program enrollment (Development Mode)
See `DEVELOPMENT_MODE_GUIDE.md` for details.

**Development Mode allows:**
- ✅ UI/UX testing
- ✅ Upload limit functionality
- ✅ Subscription state management
- ❌ Actual payments (requires Apple Developer Program)

### 5. Start the App

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
