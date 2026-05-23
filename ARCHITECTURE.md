# Attendance Tracker - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser / Client                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │  Home Page       │  │ Admin Dashboard  │  │  Attendee  │ │
│  │  (Create Event)  │  │ (CSV Import &    │  │ Check-in   │ │
│  │                  │  │  View Records)   │  │  Page      │ │
│  └──────────────────┘  └──────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Layer                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────┐ │
│  │ /api/events  │ │/api/          │ │/api/         │ │/api/│ │
│  │              │ │participants   │ │attendance    │ │upload│ │
│  │ Create/Get   │ │               │ │              │ │      │ │
│  │ Events       │ │ Add/Get       │ │ Check-in &   │ │ CSV  │ │
│  │              │ │ Participants  │ │ Get Records  │ │Import│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  SQLite Database                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Events    │  │ Participants │  │ Attendance   │        │
│  ├─────────────┤  ├──────────────┤  ├──────────────┤        │
│  │ id          │  │ id           │  │ id           │        │
│  │ name        │  │ name         │  │ participant_ │        │
│  │ description │  │ email        │  │   id         │        │
│  │ created_at  │  │ event_id     │  │ event_id     │        │
│  │             │  │ created_at   │  │ check_in_    │        │
│  │             │  │              │  │   time       │        │
│  └─────────────┘  └──────────────┘  └──────────────┘        │
│                                                              │
│  File: attendance.db                                         │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
RootLayout
├── Navigation Bar (Home | Admin)
├── /page.tsx (Home Page)
│   └── Create Event Form
│   └── Display Event Link
│
├── /admin/page.tsx (Admin Dashboard)
│   ├── Event Selector
│   ├── CSV Upload Form
│   └── Attendance Records Table
│
└── /attendance/[eventId]/page.tsx (Check-in Page)
    ├── Participant Dropdown
    └── Check-in Button
```

## Data Flow Diagram

```
ORGANIZER FLOW:
┌─────────────────┐
│ Visit home page │
└────────┬────────┘
         │
         ↓
┌─────────────────────┐
│ Enter event name    │
│ Click "Create Event"│
└────────┬────────────┘
         │
         ↓
    API POST /api/events
         │
         ↓
  Store in database
         │
         ↓
┌──────────────────────────┐
│ Display event link       │
│ Copy link for sharing    │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│ Go to Admin Dashboard    │
│ Select Event             │
│ Upload CSV file          │
└────────┬─────────────────┘
         │
         ↓
    API POST /api/upload
         │
         ↓
  Parse CSV & Store participants
         │
         ↓
┌──────────────────────────┐
│ View attendance records  │
│ See check-ins in real    │
│ time                     │
└──────────────────────────┘


ATTENDEE FLOW:
┌──────────────────────────┐
│ Receive attendance link  │
│ from organizer           │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│ Click link               │
│ /attendance/[eventId]    │
└────────┬─────────────────┘
         │
         ↓
  API GET /api/participants?eventId=xyz
         │
         ↓
┌──────────────────────────┐
│ See list of names        │
│ Select your name         │
└────────┬─────────────────┘
         │
         ↓
  Click "Check In" button
         │
         ↓
    API POST /api/attendance
         │
         ↓
  Record check-in timestamp
         │
         ↓
┌──────────────────────────┐
│ ✓ Checked In!            │
│ Confirmation message     │
└──────────────────────────┘
```

## File Organization

```
attendance sheet/
│
├── 📄 Configuration Files
│   ├── package.json          # Dependencies & scripts
│   ├── tsconfig.json         # TypeScript config
│   ├── next.config.js        # Next.js config
│   ├── tailwind.config.ts    # Tailwind CSS config
│   ├── postcss.config.js     # PostCSS plugins
│   ├── .eslintrc.json        # ESLint rules
│   ├── .env.local            # Environment variables
│   ├── .gitignore            # Git ignore rules
│   └── tsconfig.node.json    # Node TypeScript config
│
├── 📚 Documentation
│   ├── README.md             # Full documentation
│   ├── SETUP.md              # Setup guide
│   ├── CHECKLIST.md          # Setup checklist
│   ├── ARCHITECTURE.md       # This file
│   └── sample-participants.csv # CSV example
│
├── 📁 Source Code (app/)
│   ├── layout.tsx            # Root layout (navigation, styles)
│   ├── page.tsx              # Home page (create events)
│   ├── globals.css           # Global styles
│   │
│   ├── 📁 admin/
│   │   └── page.tsx          # Admin dashboard
│   │
│   ├── 📁 attendance/
│   │   └── 📁 [eventId]/
│   │       └── page.tsx      # Attendee check-in page
│   │
│   └── 📁 api/
│       ├── 📁 events/
│       │   └── route.ts      # Event CRUD endpoints
│       ├── 📁 participants/
│       │   └── route.ts      # Participant endpoints
│       ├── 📁 attendance/
│       │   └── route.ts      # Attendance endpoints
│       └── 📁 upload/
│           └── route.ts      # CSV upload endpoint
│
└── 📁 lib/
    ├── db.ts                 # Database setup & initialization
    └── utils.ts              # Helper functions
```

## Technology Stack

```
Frontend
├── React 18.2.0           (UI framework)
├── Next.js 14.0+          (React framework)
├── TypeScript             (Type safety)
├── Tailwind CSS           (Styling)
└── Next.js App Router     (File-based routing)

Backend
├── Next.js API Routes     (Serverless backend)
├── Node.js (Runtime)      (JavaScript runtime)
└── TypeScript             (Type safety)

Database
├── SQLite 5.1.0           (File-based database)
└── No ORM                 (Direct SQL queries)

Developer Tools
├── ESLint                 (Code linting)
├── PostCSS                (CSS processing)
├── Autoprefixer           (CSS vendor prefixes)
└── npm                    (Package manager)
```

## Key Implementation Details

### Event Creation Flow
1. User submits event name
2. Frontend generates unique event ID
3. API creates event in database
4. Share link is generated: `/attendance/{eventId}`

### CSV Import Flow
1. User selects event and CSV file
2. Frontend sends file to API
3. API parses CSV line by line
4. Each row inserted into participants table
5. Users can now check in

### Check-in Flow
1. Attendee visits shared link
2. API fetches participants for event
3. User selects name from dropdown
4. API records check-in with timestamp
5. Prevents duplicate check-ins (same day)

### Admin View Flow
1. Admin selects event from dropdown
2. API fetches all check-ins for that event
3. Table shows participant names & timestamps
4. Real-time updates as people check in

## Security Considerations (For Future Enhancement)

- [ ] Add authentication for admin dashboard
- [ ] Validate all CSV uploads
- [ ] Add rate limiting to API endpoints
- [ ] Implement CSRF protection
- [ ] Add input sanitization
- [ ] Use environment-based API URLs
- [ ] Add API key authentication
- [ ] Enable HTTPS in production

---

**This architecture provides a solid foundation for attendance tracking with room for improvements and scalability.**
