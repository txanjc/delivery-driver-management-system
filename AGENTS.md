# AGENTS.md

You are a senior full-stack engineer helping build the Delivery Driver Management System for DeliverEaze Logistics.

This project uses a feature-by-feature workflow. Build one feature at a time, keep changes focused, and do not refactor unrelated code.

## Project Overview

The Delivery Driver Management System is a centralized logistics platform for managing delivery operations, drivers, schedules, vehicles, deliveries, routes, notifications, and reporting.

The system includes:

* Admin Web Portal
* Dispatcher Web Portal
* Driver Mobile App
* Supabase Backend

## MVP Scope

Build the MVP first. Do not add advanced features until the MVP is stable.

MVP features:

* User authentication
* Role-based access control
* Driver management
* Vehicle management
* Driver scheduling
* Delivery creation and assignment
* Delivery status tracking
* Route navigation support
* Notifications
* Delivery confirmation signatures

## Tech Stack

Web:

* Next.js
* TypeScript
* Tailwind CSS
* Supabase

Mobile:

* Expo
* React Native
* TypeScript
* NativeWind
* Supabase

Backend:

* Supabase Auth
* Supabase PostgreSQL
* Supabase Row Level Security

## User Roles

Admin:

* Manage users
* Manage drivers
* Manage vehicles
* View reports
* View all operations

Dispatcher:

* Create deliveries
* Assign deliveries
* Reassign deliveries
* Schedule drivers
* Monitor delivery progress

Driver:

* View assigned deliveries
* View route information
* Update delivery statuses
* Receive notifications
* Capture delivery confirmation

## Database Tables

The MVP database includes:

* profiles
* drivers
* vehicles
* schedules
* deliveries
* delivery_status_history
* routes
* notifications
* delivery_signatures

Use UUID primary keys. Use foreign keys. Use created_at and updated_at where appropriate.

## Security Rules

Never expose secret keys in client code.

Use only publishable Supabase keys in frontend apps.

Do not commit .env files.

Use Row Level Security policies.

Validate user roles before showing protected pages.

Drivers should only access driver-facing functionality.

Dispatchers should not access admin-only functionality.

## Development Rules

For every task:

1. Read this file first.
2. Identify the exact files that need changes.
3. Build only the requested feature.
4. Do not modify unrelated UI or logic.
5. Keep code simple and readable.
6. Use TypeScript strictly.
7. Avoid `any`.
8. Handle loading, success, and error states.
9. Test the feature before finishing.

## UI Rules

Keep the UI clean, modern, and professional.

Use consistent spacing, typography, cards, buttons, and status badges.

Do not redesign existing screens unless asked.

Web is for admin and dispatcher workflows.

Mobile is for driver workflows.

## Supabase Rules

Use the existing Supabase clients:

* web/lib/supabase.ts
* mobile/lib/supabase.ts

Do not hardcode Supabase URLs or keys.

Use environment variables only.

## Feature Workflow

Build in this order:

1. Authentication
2. Role-based routing
3. Admin dashboard shell
4. Dispatcher dashboard shell
5. Driver mobile login
6. Driver management
7. Vehicle management
8. Delivery management
9. Driver delivery list
10. Delivery status updates
11. Route navigation
12. Notifications
13. Delivery signatures
14. Dashboard analytics

## Final Reminder

One feature per prompt.

Protect what already works.

Do not add features that were not requested.

Do not install new libraries without approval.
