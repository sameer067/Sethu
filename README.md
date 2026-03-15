# Stock & Billing Management

A mobile-first, PWA-capable web app for business stock and billing. Built with Next.js, Tailwind CSS, shadcn/ui, MongoDB, and NextAuth.

## Features

- **Auth**: Phone + password login. Only pre-registered users (added by you in the database) can sign in. No self-registration.
- **Item catalogue** (Settings): Add, edit, and soft-delete products (name + unit).
- **Inventory**: Stock In form and Stock Ledger with current stock levels and item filter.
- **New Sale**: 4-step flow — Customer (search/create), Items (line items + grand total), Payment (Cash/UPI with validation), Confirm (PDF bill download).
- **Customers**: Searchable list (total spend, purchase count); detail view with full purchase history.
- **Dashboard**: Date range filter (Today, Week, Month, All, Custom), stat cards, daily revenue bar chart, Cash vs UPI pie chart, per-item breakdown table (sortable, filterable).
- **PWA**: Web manifest and service worker so the app can be installed on the home screen.

## Setup

1. **Node**: Use Node 18+.

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **MongoDB**
   - Create a cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (or use a local MongoDB).
   - Create a database (e.g. `sethu`) and get the connection string (URI).

4. **Environment**
   - Copy `.env.local.example` to `.env.local`.
   - Set `MONGODB_URI` (required).
   - Set `NEXTAUTH_SECRET` (run `openssl rand -base64 32` to generate one).
   - Set `NEXTAUTH_URL` to `http://localhost:3000` for local dev; use your production URL (e.g. `https://your-app.vercel.app`) when deploying.

5. **Create the first user** (no one can log in until you add a user)
   ```bash
   PHONE=9876543210 PASSWORD=yourpassword node scripts/seed-user.js
   ```
   Only users that exist in the `users` collection can log in. Add more users by running the script with different `PHONE` and `PASSWORD`, or insert documents into the `users` collection (with a `passwordHash` from bcrypt).

6. **PWA icons** (optional)
   ```bash
   node scripts/generate-pwa-icons.js
   ```
   Replace `public/icon-192.png` and `public/icon-512.png` with your own for production.

7. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Log in with the phone and password you created.

## Deploy on Vercel

1. Push your code to GitHub and import the project in Vercel.
2. In Vercel project **Settings → Environment Variables**, add:
   - `MONGODB_URI`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` = `https://your-app.vercel.app` (your Vercel URL)
3. Deploy. Ensure you have run the seed script or added users to MongoDB so someone can log in.

## Tech stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui (Radix)
- MongoDB (official driver), NextAuth (Credentials + JWT)
- Recharts (dashboard), @react-pdf/renderer (bills), React Hook Form + Zod, date-fns

## Database (MongoDB)

Collections: `users`, `app_config`, `items`, `stock_entries`, `customers`, `sales`, `sale_items`. All user-scoped documents include a `userId` (ObjectId). The app creates collections and indexes as needed when you use it. Create at least one user via `scripts/seed-user.js` before logging in.

### Reset database (fresh start)

To drop the entire database and start over (e.g. after schema changes):

```bash
npm run db:reset
```

This removes all data (users, items, sales, etc.). Then create a user again:

```bash
PHONE=9876543210 PASSWORD=yourpassword node scripts/seed-user.js
```

## Currency and dates

- All amounts are shown in Indian Rupees (₹).
- Dates are displayed as DD/MM/YYYY.
