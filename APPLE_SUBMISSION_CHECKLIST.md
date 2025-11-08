# 🍎 Apple App Store Submission Checklist

## ✅ Pre-Submission Code Review

### 1. Subscription Context (`SubscriptionContext.tsx`)
- ✅ RevenueCat SDK properly initialized
- ✅ User linking implemented (`Purchases.logIn(user.id)`)
- ✅ Purchase flow with error handling
- ✅ Restore purchases functionality
- ✅ Cancelled subscription detection (`willRenew` check)
- ✅ Expiration date handling
- ✅ Supabase sync with proper error handling
- ✅ App state change listener for subscription updates
- ✅ Debug logging (only in development mode)

### 2. Database Schema
- ✅ `user_subscriptions` table exists
- ✅ `revenue_cat_subscription_id` column exists
- ✅ All required columns present
- ✅ RLS policies configured
- ✅ Constraints properly set

### 3. Build Configuration
- ✅ Build number incremented (currently: 4)
- ✅ Version number set
- ✅ Bundle identifier correct
- ✅ App icons configured
- ✅ Privacy permissions configured

## 🔍 Testing Checklist

### Before Submission, Test:

1. **Purchase Flow**
   - [ ] User can view subscription options
   - [ ] Purchase completes successfully
   - [ ] `plan_type` updates to `pro` in Supabase
   - [ ] UI shows "unlimited" after purchase
   - [ ] Purchase receipt is stored correctly

2. **Restore Purchases**
   - [ ] "Restore Purchases" button works
   - [ ] Existing subscription is restored
   - [ ] Supabase syncs correctly after restore

3. **Subscription Cancellation**
   - [ ] User can cancel via iOS Settings
   - [ ] App detects cancellation (`willRenew: false`)
   - [ ] Status updates to `cancelled` in Supabase
   - [ ] User retains access until expiration date
   - [ ] After expiration, `plan_type` changes to `free`

4. **App State Changes**
   - [ ] App background → foreground updates subscription status
   - [ ] Cancelled subscriptions are detected on app resume

5. **Error Handling**
   - [ ] Network errors are handled gracefully
   - [ ] Purchase errors show user-friendly messages
   - [ ] Sync errors are logged and reported

## 📋 Database Verification

Run the SQL queries in `backend/supabase/migrations/verify_table_structure.sql` to verify:

1. ✅ All columns exist (especially `revenue_cat_subscription_id`)
2. ✅ RLS policies are active
3. ✅ Constraints are properly set
4. ✅ Triggers are working

## 🚨 Critical Items to Verify

### Must Have:
- [ ] `revenue_cat_subscription_id` column exists in `user_subscriptions` table
- [ ] RevenueCat API key is set in production environment variables
- [ ] RevenueCat products are configured in dashboard
- [ ] Entitlement identifier is `pro` (or matches your code)
- [ ] Test purchases work in sandbox environment
- [ ] No console errors in production build

### Important:
- [ ] Privacy policy URL is accessible
- [ ] Terms of Use URL is accessible
- [ ] Subscription pricing is correct
- [ ] Subscription description is clear
- [ ] Auto-renewal is properly communicated

## 📝 App Store Connect Requirements

### Subscription Information:
- [ ] Subscription group created
- [ ] Subscription product created with correct ID
- [ ] Pricing configured
- [ ] Localization completed (if applicable)
- [ ] Subscription description written
- [ ] Screenshots provided (if required)

### App Information:
- [ ] App description updated
- [ ] Keywords optimized
- [ ] Privacy policy URL added
- [ ] Support URL added
- [ ] Marketing URL (optional)

## 🔐 Security & Privacy

- [ ] No hardcoded API keys
- [ ] Environment variables properly configured
- [ ] RLS policies prevent unauthorized access
- [ ] User data is properly secured
- [ ] Privacy policy covers subscription data

## 📱 Production Build

Before submitting:

```bash
# 1. Clean build
cd frontend
rm -rf node_modules
npm install

# 2. Build for production
eas build --platform ios --profile production

# 3. Test the production build thoroughly
```

## ✅ Final Checks

- [ ] All tests pass
- [ ] No linter errors
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] RevenueCat dashboard configured
- [ ] App Store Connect information complete
- [ ] TestFlight build tested (if using)

## 🎯 Submission Notes

1. **RevenueCat Configuration**: Ensure your RevenueCat dashboard has:
   - Products created
   - Entitlements configured (identifier: `pro`)
   - Store credentials linked (App Store Connect)

2. **Supabase**: Ensure:
   - All migrations are applied
   - `revenue_cat_subscription_id` column exists
   - RLS policies are active

3. **Testing**: Test thoroughly in sandbox before submission

## 📞 Support

If issues arise:
- Check RevenueCat dashboard for subscription status
- Check Supabase logs for sync errors
- Review app console logs (in development mode)
- Verify API keys are correct

---

**Good luck with your submission! 🚀**

