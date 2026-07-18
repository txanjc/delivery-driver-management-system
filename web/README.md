This is the DeliverEaze Logistics Next.js web application.

## Outlook SMTP email notifications

Operational emails are sent only from server-side route handlers through Outlook SMTP with STARTTLS. Add these values to `web/.env.local` for local development and to Vercel Environment Variables for Preview and Production. Do not commit `.env.local` or any password.

```dotenv
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=delivereazelogistics@outlook.com
SMTP_PASSWORD=
SMTP_FROM_EMAIL=delivereazelogistics@outlook.com
SMTP_FROM_NAME=DeliverEaze Logistics
APP_URL=https://delivery-driver-management-system.vercel.app
NEXT_PUBLIC_APP_URL=https://delivery-driver-management-system.vercel.app
DRIVER_APP_URL=delivereaze://
```

The sender is `DeliverEaze Logistics <delivereazelogistics@outlook.com>`. `SMTP_PASSWORD` is required at runtime but must remain only in local environment files and Vercel; it is never exposed to browser code.

In development, an authenticated Administrator can send a single transport-validated test message with `POST /api/development/smtp-test` and `{ "recipient": "recipient@example.com" }`. This route is unavailable in production. Template-only previews remain available at `/api/development/email-preview`.

For temporary production troubleshooting, an authenticated Administrator can use `POST /api/admin/email-diagnostics` with `{ "recipient": "recipient@example.com", "send": true }`. It rate-limits requests, reports only SMTP variable presence and sanitized verification results, checks the notification email columns, and can send a clearly labelled diagnostic message. It never returns credentials.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
