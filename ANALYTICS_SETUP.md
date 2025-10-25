# Google Analytics 4 Setup Guide

This guide will walk you through setting up Google Analytics 4 (GA4) for the NFL Player Compare app.

## Step 1: Create Google Analytics Account

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Start measuring** (or **Admin** if you already have an account)
3. Create a new **Account** (or use an existing one)
   - Account name: "NFL Player Compare" (or your preference)
   - Check data sharing settings as desired
   - Click **Next**

## Step 2: Create Property

1. Property name: "NFL Player Compare"
2. Reporting time zone: Select your timezone
3. Currency: Select your currency
4. Click **Next**

## Step 3: Configure Business Details

1. Select your industry category (e.g., "Sports & Fitness" or "Other")
2. Select business size
3. Select how you intend to use Google Analytics
4. Click **Create**
5. Accept the Terms of Service

## Step 4: Set Up Data Stream

1. Select platform: **Web**
2. Enter your website details:
   - Website URL: Your production URL (e.g., `https://your-app.onrender.com`)
   - Stream name: "NFL Player Compare - Production"
3. Click **Create stream**

## Step 5: Get Measurement ID

1. After creating the stream, you'll see the **Web stream details** page
2. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)
3. Keep this page open for the next step

## Step 6: Add Measurement ID to Your App

### For Local Development:

1. Open `/ff_react/.env.local`
2. Add your Measurement ID:
   ```bash
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
3. Save the file
4. Restart your dev server: `npm run dev`

### For Production (Render):

1. Go to your Render dashboard
2. Select your **Static Site** (frontend)
3. Go to **Environment** tab
4. Add environment variable:
   - Key: `VITE_GA_MEASUREMENT_ID`
   - Value: `G-XXXXXXXXXX` (your actual ID)
5. Click **Save Changes**
6. Render will automatically redeploy

## Step 7: Verify Analytics is Working

### Method 1: Real-time Reports (Recommended)

1. Go to Google Analytics
2. Navigate to **Reports** > **Realtime**
3. Open your website in a new tab
4. Accept cookies in the consent banner
5. Interact with the site (select players, change scoring format)
6. You should see activity in the Realtime report within 30 seconds

### Method 2: Browser Console

1. Open your app in Chrome/Firefox
2. Open Developer Tools (F12)
3. Go to **Console** tab
4. You should see: `Google Analytics initialized`
5. Interact with the site and check for analytics events in the **Network** tab (filter by "google-analytics")

### Method 3: GA4 DebugView

1. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/) Chrome extension
2. Enable the extension
3. Go to Google Analytics > **Admin** > **DebugView**
4. Open your app in a new tab
5. You should see events appear in DebugView in real-time

## Step 8: Configure Enhanced Measurement (Optional)

1. In your **Web stream details** page
2. Scroll to **Enhanced measurement**
3. Click the gear icon to configure:
   - ✅ Page views (already tracked)
   - ✅ Scrolls
   - ✅ Outbound clicks
   - ✅ Site search
   - ❌ Video engagement (not applicable)
   - ✅ File downloads
4. Click **Save**

## What Analytics Are Tracked?

### Automatic Events:
- **Page views**: Every time the app loads
- **User location**: Country, region, city
- **Device info**: Desktop/mobile, browser, OS
- **Session duration**: Time spent on site
- **Traffic sources**: How users found your site

### Custom Events:
1. **Player Selection**
   - Category: "Player Selection"
   - Action: "select_A" or "select_B"
   - Label: Player name and position

2. **Player Comparison**
   - Category: "Player Comparison"
   - Action: "compare"
   - Parameters: player_a, player_b, scoring_format

3. **Scoring Format Change**
   - Category: "Scoring Format"
   - Action: "change"
   - Label: "old_format → new_format"

## Viewing Reports

### Key Reports to Check:

1. **Realtime** - See current users
2. **Acquisition** - How users find your site
3. **Engagement** - Most viewed pages, events
4. **Demographics** - User age, gender, location
5. **Technology** - Browser, OS, device breakdown

### Custom Reports for Your App:

1. **Most Compared Players**:
   - Go to **Events** > **player_comparison**
   - View parameters: player_a, player_b

2. **Scoring Format Preference**:
   - Go to **Events** > **scoring_format_change**
   - See which formats are most popular

3. **User Engagement Flow**:
   - **Engagement** > **Pages and screens**
   - See how users navigate your app

## Privacy & Cookie Consent

The app includes a cookie consent banner that:
- Appears on first visit
- Stores user preference in localStorage
- Only tracks analytics if user accepts
- Respects user privacy if declined

Users can change their preference by clearing localStorage or browser cookies.

## Troubleshooting

### "Google Analytics measurement ID not found"
- Make sure `VITE_GA_MEASUREMENT_ID` is set in environment variables
- Restart dev server after adding env var
- For production, redeploy after adding env var in Render

### No data in Realtime reports
- Check browser console for errors
- Verify you accepted the cookie consent banner
- Ensure you're not using an ad blocker (disable for testing)
- Check that Measurement ID is correct (format: G-XXXXXXXXXX)

### Events not appearing
- Wait 30-60 seconds (Realtime has slight delay)
- Check browser console for JavaScript errors
- Verify consent was granted (check localStorage: `analytics-consent` = "true")

## Best Practices

1. **Don't track in development**: Leave `VITE_GA_MEASUREMENT_ID` empty in `.env.local` to avoid polluting production data
2. **Separate dev/prod streams**: Create two data streams (one for dev, one for prod) to keep data separate
3. **Regular monitoring**: Check analytics weekly to understand user behavior
4. **Privacy first**: Always respect user consent preferences
5. **Custom events**: Add new custom events for features you want to track

## Additional Resources

- [GA4 Documentation](https://support.google.com/analytics/answer/9306384)
- [GA4 Event Tracking](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [react-ga4 Library](https://github.com/PriceRunner/react-ga4)
- [GDPR Compliance](https://support.google.com/analytics/answer/9019185)

## Support

If you have issues setting up analytics, check:
1. Browser console for errors
2. Google Analytics DebugView
3. Network tab for blocked requests
4. Ad blockers or privacy extensions

For more help, consult the GA4 documentation or open an issue on the GitHub repository.
