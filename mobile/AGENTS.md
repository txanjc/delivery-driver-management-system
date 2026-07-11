# DeliverEaze Driver Mobile App Agent Instructions

Treat this file as the master implementation specification for the DeliverEaze iOS driver application.

The goal is not to make the app merely iOS-themed. The goal is a polished, responsive, accessible React Native application that feels comparable to a first-party Apple app such as Apple Wallet, Apple Maps, Apple Fitness, or the App Store.

Do not attempt to build the entire application in one pass. Follow the required phases and stop for approval after each major section.

## Stack

The mobile application uses:
- React Native
- Expo SDK 54
- Expo Router
- TypeScript
- Supabase
- React Native Maps
- Expo Glass Effect
- `@expo/ui`

Use the exact Expo SDK 54 documentation for Expo-specific changes:
https://docs.expo.dev/versions/v54.0.0/

Do not use Expo SDK 56 documentation, APIs, assumptions, or package versions.

Do not upgrade Expo or replace the current stack unless explicitly requested.

## Scope And Repository Safety

Work only inside `mobile/`.

Do not modify:
- `web/`
- Supabase migrations
- database tables
- database functions
- RLS policies
- backend services outside the existing mobile integration
- shared web application code
- Vercel configuration

Do not add a database table or change the database schema without explicit approval.

Do not delete working files without first explaining why they are no longer needed.

Before changing code, inspect the relevant files under:
- `mobile/app/`
- `mobile/components/`
- `mobile/features/`
- `mobile/providers/`
- `mobile/hooks/`
- `mobile/lib/`
- `mobile/services/`
- `mobile/types/`
- `mobile/theme/`

Review the current implementation before creating new files. Reuse existing theme, utilities, services, hooks, and components when they already satisfy the requirement. Do not create a second competing design system.

## Preserve Working Functionality

Preserve all existing working functionality:
- Supabase authentication
- session restoration
- Driver-role validation
- driver-profile lookup
- protected routes
- Expo Router navigation
- bottom navigation
- Liquid Glass implementation
- delivery fetching
- schedule fetching
- alert fetching
- route handlers
- service functions
- shared types
- loading states
- empty states
- error handling
- logout
- existing Android behavior

The current problem is presentation architecture, not business logic. Do not rewrite working data-fetching or authentication code merely to change the interface.

When presentation components are rebuilt, reconnect them to existing data, hooks, handlers, and state. Do not introduce hardcoded fake operational records.

## Final iOS Navigation

The final Driver navigation is:
1. Dashboard
2. My Deliveries
3. Status
4. Schedule
5. Alerts

These five destinations must remain in the bottom tab bar. Profile must not appear as a sixth tab.

Profile must be accessible through a circular button in the upper-right area of each main screen. The profile button must display the driver's initials, have a minimum 44 x 44 point touch target, use Liquid Glass on supported iOS versions, use the existing Android-native equivalent on Android, navigate to the Driver Profile screen, remain readable over light and dark content, and not overlap the status bar or Dynamic Island.

Preserve tab state when switching tabs whenever the current Expo Router architecture supports it.

The tab bar should normally be hidden when the keyboard is displayed, a focused modal workflow is active, or a full-screen critical task requires undivided attention.

Do not replace the existing working bottom Liquid Glass tab bar unless there is a verified defect.

## iOS Design Direction

The iOS app should feel native, minimalist, calm, responsive, spacious without wasting space, content-focused, visually balanced, readable, accessible, and suitable for one-handed use.

Avoid web-dashboard layouts squeezed onto a phone, excessive cards, oversized icons, fixed-height containers that compress content, unnecessary borders, heavy shadows, glass effects on every surface, crowded rows, tiny typography, device-specific layouts, hardcoded iPhone model checks, horizontal scrolling, and essential text truncation.

Approved mockups are design references, not pixel-perfect specifications. Reproduce their hierarchy, proportions, spacing, typography rhythm, content relationships, and visual balance. Do not blindly copy fixed coordinates or sizes from a mockup.

## Responsive Layout System

Use `useWindowDimensions()`.

Do not detect or create layouts for specific iPhone models.

Use centralized width categories:
- Compact: width < 390
- Standard: width >= 390 and width < 430
- Large: width >= 430

Use 390-point width as the primary design baseline. Verify representative widths such as 375, 390, 402, 430, and 440.

Design narrow-screen first, then enhance spacing for wider screens. Height should normally be handled through native vertical scrolling. Do not shrink text, icons, cards, or controls merely to force the full Dashboard into one viewport.

Use content-driven height. Cards and sections must grow naturally when text wraps, Dynamic Type increases, an address is long, a driver name is long, localization text is longer, or content contains an error or warning.

Respect top safe area, status bar, Dynamic Island, bottom safe area, floating tab bar inset, home-indicator region, and keyboard insets. Do not hardcode safe-area values.

## Design System Foundation

Before rebuilding Dashboard presentation, create or complete:

`mobile/components/dashboard/dashboardDesignSpec.ts`

The design specification must contain or reference:
- Compact, Standard, and Large breakpoints
- responsive horizontal padding
- responsive section gaps
- content max-width behavior
- spacing scale
- typography roles
- line heights
- font weights
- `maxFontSizeMultiplier` values
- card corner radii
- button corner radii
- icon sizes
- avatar sizes
- minimum touch-target sizes
- semantic light-mode colors
- semantic dark-mode colors
- muted text colors
- divider colors
- card surface colors
- shadow values
- elevation rules
- safe-area spacing
- scroll-content bottom padding
- animation durations
- responsive helper functions

Use existing shared theme files when appropriate. The Dashboard specification should compose the shared theme instead of duplicating it.

Do not place random numeric values directly in screen JSX. Use semantic names such as `spacing.screenHorizontal`, `spacing.sectionGap`, `typography.body`, `typography.secondary`, `radii.card`, `sizes.touchTarget`, and `colors.textPrimary`.

## Typography

Use the native iOS system font through React Native unless the project already has an approved font strategy. Do not bundle or distribute Apple font files.

Use this semantic hierarchy as the starting point:
- large page title: 34pt bold
- compact page title: 17pt semibold
- primary body text: 17pt regular
- primary list-item title: 17pt
- primary buttons and form controls: approximately 17pt
- secondary text: 15pt regular muted
- tertiary text and captions: 13pt regular more muted
- tab labels: approximately 11pt

Do not use text smaller than the tab-label minimum for operational content.

Keep Dynamic Type enabled. Do not globally set `allowFontScaling={false}`. Define reasonable `maxFontSizeMultiplier` values by semantic role without blocking accessibility. Essential information must wrap instead of truncating.

Use `numberOfLines` only when truncation is intentional and a way to view the full value exists.

## Liquid Glass Rules

Liquid Glass belongs mainly to navigation and controls:
- bottom tab bar
- profile button
- fixed navigation actions
- floating page-level controls
- compact floating toolbars
- supported pull-down menus

Do not apply Liquid Glass to every content card, every list row, large reading surfaces, delivery information blocks, schedule information, long-form text, or standard form groups.

Use clean semantic backgrounds, restrained corner radii, subtle separators, and light elevation for content surfaces. Use the existing Expo Glass Effect implementation first and provide graceful fallbacks when native glass is unavailable.

Avoid stacking multiple translucent layers.

## Touch Targets And Interaction

Every interactive control must have at least a 44 x 44 point touch target.

Use native iOS behaviors where possible: edge-swipe back, swipe-down modal dismissal, clear close/cancel controls, contextual chevrons for navigation rows, checkmarks for single-selection lists, switches for binary settings, sheets for temporary workflows, and haptic feedback for meaningful confirmed actions when already supported.

Do not add decorative animations that delay operational tasks. Animations should be subtle, short, interruptible, and respect Reduce Motion.

## Dark Mode

Support light and dark appearance through semantic colors. Do not implement dark mode by simply inverting every color.

Maintain depth relationships between app background, grouped background, card surface, elevated surface, dividers, primary text, secondary text, tertiary text, and accent colors.

Do not hardcode black text or white backgrounds inside reusable components.

## Accessibility

The app must support Dynamic Type, VoiceOver labels, accessibility roles, accessibility hints where necessary, sufficient contrast, readable status indicators, minimum touch targets, reduced motion, logical focus order, keyboard avoidance, safe modal dismissal, accessible loading states, accessible empty states, and accessible error messages.

Do not communicate status using color alone. Interactive icons without visible text must have `accessibilityLabel` values.

## Dashboard Reset

The existing Dashboard presentation is structurally flawed.

Remove only the existing Dashboard presentation layer:
- Delivery Summary JSX
- Active Delivery JSX
- Schedule Overview JSX
- Recent Alerts JSX
- obsolete Dashboard-only layout styles

Preserve Dashboard data hooks, Dashboard queries, loading behavior, empty-state logic, error-state logic, navigation handlers, route handlers, authentication, services, and types.

Temporarily render only:

`Driver Dashboard`

Do not begin rebuilding sections until the design specification is established and reviewed.

## Dashboard Implementation Phases

Build the Dashboard one section at a time and stop for review after each phase:
1. Header
2. Delivery Summary
3. Active Delivery
4. Schedule Overview
5. Recent Alerts

Previously approved sections must not be casually redesigned while working on a later section. Change an approved section only when a regression is found, accessibility requires a correction, or the user explicitly requests a change.

## Dashboard Header

The Header contains greeting, driver name, driver role, and a profile button with initials.

The header must respect the top safe area, remain readable with Dynamic Type, avoid collision with the profile button, allow the driver name to wrap, avoid excessive height, use restrained hierarchy, and feel native rather than like a web-page heading.

Do not force the greeting, name, role, and profile button into a rigid row that breaks on narrow screens.

## Delivery Summary

The Delivery Summary contains Assigned Deliveries, Pending Deliveries, Completed Deliveries, and a Today selector.

Each metric contains a circular icon treatment, count, and readable label. Labels must not truncate, horizontal scrolling is not allowed, icons must not dominate, counts must remain clear, and Dynamic Type must not cause overlap.

Use a responsive, content-driven layout that may use columns, adjusted gaps, wrapping, or stacking as needed.

## Active Delivery

The Active Delivery section contains Delivery ID, Customer, Address, ETA, Route preview, Progress indicator, View Details, and Open Route.

Operational information must be more prominent than decoration. The map must not dominate the card. Address and customer details must remain readable. Buttons must meet 44-point touch targets and may stack on compact widths.

Do not start location tracking or write GPS coordinates from Dashboard presentation code.

## Schedule Overview

The Schedule Overview contains Today's Shift, Assigned Vehicle, Shift status, and View Schedule action.

Use existing schedule data. Do not invent vehicle assignments. Distinguish scheduled, active, completed, cancelled, conflict, and unavailable states without using color alone.

## Recent Alerts

Recent Alerts displays the latest driver notifications using a native list-oriented pattern.

Each alert should support primary message, supporting text, time/date, read/unread state, optional icon, and navigation when applicable. Use chevrons only when a row navigates.

Provide loading, empty, error, and View All Alerts states when appropriate.

## Other Driver Areas

My Deliveries should use list-based mobile patterns, clear statuses, customer/address/time context, and navigation to Delivery Details. Do not display every database field in the list.

Status should reflect approved operational status rules only. Inspect existing types, services, fields, and authorization before adding mutations.

Schedule shows only the authenticated Driver's schedule, including today, upcoming shifts, vehicle, time, status, details, and empty states.

Alerts contains full notification history with unread/read distinction, timestamps, optional grouped dates, related navigation, and loading/empty/error states. Push notification registration is a separate phase.

Profile opens from the upper-right profile button and may contain identity, role, contact information, assigned vehicle when available, availability/status summary, app settings, and sign out. Logout must clear the session, return to Login, and prevent back navigation into protected Driver screens.

Maps and routes must render safely without starting tracking automatically. Location permission must be requested only when a user action requires it. Do not implement background tracking, GPS writes, or tracking database tables without explicit approval.

Proof of Delivery is a later focused workflow. Do not implement uploads, storage buckets, or database fields without confirming the backend design.

## Loading, Empty, Error, And Offline States

Every data-driven screen must support initial loading, refresh loading, empty data, recoverable error, expired session, unauthorized role, unavailable network, and stale data where applicable.

Loading states should preserve screen structure and avoid major layout shifts. Do not replace the entire screen with a blank or black flash. Headers and stable navigation should remain visible during refreshes when possible.

Do not use fake values as loading placeholders. Error messages should explain what failed and whether the user can retry, sign in again, or wait for temporary recovery.

## Component Architecture

Do not place the entire Dashboard in one oversized file.

Use focused components such as `DashboardHeader`, `DeliverySummaryCard`, `DeliveryMetric`, `ActiveDeliveryCard`, `DeliveryProgress`, `ScheduleOverviewCard`, `RecentAlertsSection`, and `AlertRow`.

Use typed props. Keep data retrieval in existing hooks or screen-level orchestration. Keep presentation components mostly declarative. Avoid duplicating business logic inside visual components.

Use platform-specific files only when a genuinely platform-specific implementation is needed. Do not scatter `Platform.OS` checks throughout every component.

## Performance

Avoid unnecessary re-renders. Use `FlatList` for long lists, stable keys, justified memoization, efficient map rendering, limited blur layers, appropriately sized images, and lazy loading where useful.

Do not prematurely optimize simple components or add large animation libraries without approval.

## Required Implementation Process

For each phase:
1. Inspect the current files.
2. State which files will be changed.
3. Make the smallest coherent change.
4. Preserve existing behavior.
5. Run validation.
6. Report files changed.
7. Report validation results.
8. Provide screenshots or a clear visual verification target.
9. Stop for approval before beginning the next phase.

Do not make unrelated cleanup changes during a focused UI phase.

## Validation

After every implementation phase, run from `mobile/`:

```bash
npm install
npx expo-doctor
npx tsc --noEmit
npx expo export --platform web
```

Run `npm install` only when dependencies changed or installation is required.

Also inspect:

```bash
git status --short
git diff --stat
git diff --name-only
git diff -- mobile
```

Confirm no `web/` files changed, no Supabase migration was added, no environment secrets were committed, no unexpected dependency was added, no working route was deleted, Android was not broken, TypeScript has no errors, Expo Doctor passes, and web export passes.

When testing visually, verify Compact, Standard, and Large widths; light and dark mode; increased text size; long driver name; long customer name; long address; empty data; loading data; error data; and physical iPhone behavior.

## Definition Of Done

A screen or section is not complete until no essential text truncates, no text overlaps, no control is clipped, no horizontal scrolling exists, Dynamic Type does not break the layout, touch targets are at least 44 x 44 points, safe areas are respected, the tab bar does not cover content, cards grow with content, Compact/Standard/Large widths work, light and dark modes are readable, loading/empty/error states work, accessibility labels are present, existing business logic remains intact, Expo Doctor passes, TypeScript passes, web export passes, `web/` remains unchanged, no database changes were introduced, and the current phase has been reviewed and approved.

## Current Phase

Phase 0 only:
1. Audit `mobile/` and report the current architecture.
2. Replace outdated `mobile/AGENTS.md` instructions with this project-specific specification.
3. Confirm Expo SDK 54 everywhere.
4. Identify the current Dashboard screen and dependencies.
5. Reset only Dashboard presentation to `Driver Dashboard`.
6. Preserve all data hooks, services, handlers, states, auth, and navigation.
7. Create or complete `dashboardDesignSpec.ts`.
8. Run required validation.
9. Report exact files changed.
10. Stop and wait for approval before implementing Dashboard Header.

Do not continue into Delivery Summary, Active Delivery, Schedule Overview, or Recent Alerts during Phase 0.
