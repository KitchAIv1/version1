# KitchAI Onboarding: Free AI Usage Feature

## Overview

This document details the new feature to be integrated into the KitchAI onboarding flow: the inclusion of limited free AI pantry scans and recipe generations for freemium users. This component is designed to highlight the app's core value early in the user experience and create an upgrade incentive by showcasing real AI benefits while establishing usage boundaries.

---

## Purpose

* Provide users with a **trial experience** of KitchAI’s powerful AI features
* Drive user engagement by immediately delivering value
* Create a **clear freemium-to-premium path** by making limitations visible and reasonable

---

## Feature Limits

| Feature               | Freemium Limit | Upgrade Message                         |
| --------------------- | -------------- | --------------------------------------- |
| Pantry Scanning       | 3 Scans        | "Upgrade to unlock unlimited scans"     |
| AI Recipe Generations | 10 Generations | "Upgrade to generate unlimited recipes" |

These limits are tracked on a **per-account basis** (user ID) and reset only when user upgrades to premium.

---

## Integration into Onboarding Flow

### 🔹 For Regular Users (Home Cooks)

**Onboarding Step:** Features Summary (after role selection)

**UI Elements to Highlight:**

* ✅ "Scan your pantry — get 3 free scans"
* 🍳 "Generate meals with AI — 10 recipe generations included"
* 🛒 "Add missing items to your grocery list"
* 📅 "Plan your meals for the week"

**Final CTA:** "Start Cooking with AI"

> Tooltip: "Upgrade for unlimited pantry scans and AI recipes."

### 🔸 For Creators

**Placement (Optional):**

* If creators are allowed to use AI tools as well, show:

  > "Use AI to create 10 recipes — free with your creator account"

If not, skip this screen and redirect them straight into video creation tools.

---

## Backend Requirements

* **Tables:**

  * `user_limits`

    * `user_id: uuid`
    * `pantry_scans_used: integer`
    * `recipes_generated: integer`
    * `is_premium: boolean`

* **Hooks/API Endpoints:**

  * Before triggering scan or recipe generation:

    * Check against limits
    * Return status and upgrade prompt if limits reached
  * On upgrade:

    * Set `is_premium = true`
    * Reset usage counters (optional)

---

## UX/Copywriting Guidelines

### Error or Limit Message (Freemium Limit Reached):

* "You've used all 3 pantry scans. Upgrade to continue exploring what’s in your kitchen!"
* "You’ve reached your 10 recipe limit. Unlock full meal creation with KitchAI Premium."

### Visual Indicators:

* Progress bar or number tracker: "3 of 3 pantry scans used"
* Lock icon with "Upgrade" badge after limit is hit

---

## Analytics & Tracking

Track:

* Pantry scans used
* Recipes generated
* Conversions from limit prompt to upgrade
* Drop-offs on onboarding vs. activation

---

## Future Enhancements (Post MVP)

* Add ability to earn more scans/generations via referral or engagement
* Unlock features based on milestones (e.g., uploading your first recipe)
* A/B test whether pantry scan or meal generation drives more activation

---

## Summary

This onboarding component emphasizes AI value from day one, creating early wins while building tension around limitations. It supports monetization by encouraging upgrades when users run into natural friction. This balances user satisfaction with business growth objectives.
