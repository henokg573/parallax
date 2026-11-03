# Local Development with XAMPP

## Requirements

- XAMPP with MySQL/MariaDB
- Node.js 22.12.0 or later (Next.js requires Node 20.9.0 or later)
- pnpm 10

## Start

1. Open the XAMPP Control Panel and start **MySQL**. Apache is not required by this Next.js app.
2. In phpMyAdmin, create a database named `parallax` using `utf8mb4_unicode_ci`. Alternatively, import `database/schema.sql`, which creates the database and all tables.
3. Copy `.env.example` to `.env` and set your XAMPP MySQL username/password. The default XAMPP account is often `root` with an empty password; use the values configured on your machine.
4. Replace `SESSION_SECRET` with a unique random value of at least 32 characters.
5. From PowerShell in the project directory, run:

	```powershell
	pnpm install
	pnpm db:init
	pnpm db:admin
	pnpm dev
	```

`db:init` creates the `parallax` database and tables if they do not already exist, and safely adds new nullable columns as the app schema evolves. `db:admin` prompts for the first super-admin account; passwords are stored as scrypt hashes. Open `http://localhost:3000`, then sign in at `/admin/login`.

The home page, registration forms, protected receipt viewer, payment review, and staff check-in use MariaDB. Receipts are kept under `var/uploads/payment-receipts`; public media is under `public/uploads/media`. Admins can upload JPEG, PNG, WebP, GIF, MP4, WebM, and MOV media. Content videos are limited to 100 MB. The admin registration page displays a QR after payment approval, even when email is not configured; `/admin/scan` uses the device camera to check in verified tickets. Existing hosted content is not copied automatically.

Do not expose XAMPP or its default database credentials to the internet. Use a dedicated database user and strong password if this app is deployed beyond your local machine.