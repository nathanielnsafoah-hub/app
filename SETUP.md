# Attendance Tracker - Setup & Getting Started

## What's Been Created

This is a complete attendance tracking system base with the following features:

### 📁 Project Structure
- **Frontend**: Next.js App Router with React components
- **Backend**: API routes for event, participant, and attendance management
- **Database**: SQLite for persistent data storage
- **Styling**: Tailwind CSS for responsive UI

### 🎯 Core Features

1. **Home Page** (`/`)
   - Create new events
   - Generate unique attendance links
   - Instructions for users

2. **Attendee Check-in** (`/attendance/[eventId]`)
   - Displays list of participants
   - Simple one-click check-in process
   - Confirmation message

3. **Admin Dashboard** (`/admin`)
   - View all events
   - Import participants via CSV
   - View real-time attendance records

### 📊 Database Tables

1. **events** - Store event information
2. **participants** - Store participant details
3. **attendance** - Track check-in records

### 🔗 API Endpoints

- `POST/GET /api/events` - Manage events
- `POST/GET /api/participants` - Manage participants
- `POST/GET /api/attendance` - Track attendance
- `POST /api/upload` - CSV import

## ⚠️ Before You Run

### Prerequisites
- Node.js 18+ (install from nodejs.org)
- npm (comes with Node.js)

### First-Time Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   - The `.env.local` file is already created
   - Default: `NEXT_PUBLIC_BASE_URL=http://localhost:3000`
   - Update if needed for production

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   - Navigate to `http://localhost:3000`

## 🚀 Quick Workflow

1. **Create an Event**
   - Home page → Enter event name → Create Event
   - Copy the generated attendance link

2. **Add Participants**
   - Admin Dashboard → Select event
   - Upload CSV with participant names
   - See `sample-participants.csv` for format

3. **Share Link**
   - Send attendance link to participants
   - They check in with their names

4. **Monitor**
   - View attendance records in Admin Dashboard
   - See real-time check-ins and timestamps

## 📝 CSV Format

Required format for importing participants:

```csv
name,email
John Doe,john@example.com
Jane Smith,jane@example.com
```

Email is optional. See `sample-participants.csv` for examples.

## 🔧 Configuration Files

- `next.config.js` - Next.js configuration
- `tsconfig.json` - TypeScript settings
- `tailwind.config.ts` - Tailwind CSS customization
- `postcss.config.js` - PostCSS plugins
- `.eslintrc.json` - Code linting rules
- `.env.local` - Environment variables
- `.gitignore` - Git ignore rules

## 📦 Dependencies

### Main Dependencies
- `next@14.0.0+` - React framework
- `react@18.2.0+` - UI library
- `sqlite3@5.1.0+` - Database
- `typescript@5.0.0+` - Type checking
- `tailwindcss@3.0.0+` - Styling

### Dev Dependencies
- `eslint` - Code linting
- `autoprefixer` - CSS prefix handling

## 🎨 Customization Ideas

After the base is set up, you can:

- Add user authentication
- Create QR codes for check-in
- Generate attendance reports/exports
- Add email notifications
- Customize branding/colors
- Add analytics dashboard
- Implement time tracking
- Add event categories
- Create admin user management
- Add dark mode

## 📂 File Locations Reference

```
/Users/air2/Documents/attendance sheet/
├── app/
│   ├── api/
│   │   ├── attendance/
│   │   ├── events/
│   │   ├── participants/
│   │   └── upload/
│   ├── attendance/[eventId]/
│   ├── admin/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── db.ts
│   └── utils.ts
├── .env.local
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── README.md
```

## 🐛 Troubleshooting

### Node modules error
```bash
rm -rf node_modules package-lock.json
npm install
```

### Port already in use
```bash
npm run dev -- -p 3001
```

### Database issues
```bash
rm attendance.db
npm run dev
```

## 📞 Support

- Check README.md for detailed documentation
- Review API endpoints in `app/api/`
- Check component files for implementation details

---

**Next Steps**: Run `npm install` followed by `npm run dev` to start developing!
