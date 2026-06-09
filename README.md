# Attendance Tracker

A web application for tracking event attendance. Organizers can create events, import participant lists via CSV, and share unique links with attendees. Participants can easily check in, and admins have a dashboard to manage everything.

## Features

✅ Create events with unique shareable links
✅ Import participant details via CSV upload
✅ Attendees check in with their names
✅ Admin dashboard with attendance records
✅ Real-time attendance tracking
✅ Responsive design with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14+ with TypeScript
- **Database**: SQLite
- **Styling**: Tailwind CSS
- **Frontend**: React with Next.js App Router

## Project Structure

```
attendance sheet/
├── app/
│   ├── api/
│   │   ├── events/route.ts         # Event creation and retrieval
│   │   ├── participants/route.ts   # Participant management
│   │   ├── attendance/route.ts     # Check-in and records
│   │   └── upload/route.ts         # CSV import
│   ├── attendance/[eventId]/page.tsx  # Attendee check-in page
│   ├── admin/page.tsx              # Admin dashboard
│   ├── page.tsx                    # Home page (create events)
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── lib/
│   ├── db.ts                       # Database setup
│   └── utils.ts                    # Utility functions
├── public/                         # Static files
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set environment variables (create `.env.local`):
```
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will start on `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

## Usage Guide

### For Event Organizers

1. **Create an Event**:
   - Go to the home page (`/`)
   - Enter the event name
   - Click "Create Event"
   - Copy the generated attendance link

2. **Import Participants**:
   - Go to Admin Dashboard (`/admin`)
   - Select the event from the dropdown
   - Upload a CSV file with participant details
   - CSV format: `name,email`

3. **Share with Attendees**:
   - Share the attendance link with participants
   - Example: `http://localhost:3000/attendance/abc123def456`

4. **Monitor Attendance**:
   - View real-time check-ins in the Admin Dashboard
   - See attendance records with timestamps

### For Attendees

1. **Check In**:
   - Click on the shared attendance link
   - Select your name from the dropdown
   - Click "Check In"
   - Confirmation message appears

## CSV Import Format

Create a CSV file with the following format:

```
name,email
John Doe,john@example.com
Jane Smith,jane@example.com
Robert Johnson,robert@example.com
```

The `email` column is optional. You can also use just:

```
name
John Doe
Jane Smith
Robert Johnson
```

A sample file is provided as `sample-participants.csv`

## Database

The application uses SQLite with three main tables:

### Events Table
- `id`: Unique event identifier
- `name`: Event name
- `description`: Event description (optional)
- `created_at`: Creation timestamp

### Participants Table
- `id`: Participant ID
- `name`: Participant name
- `email`: Participant email
- `event_id`: Associated event ID
- `created_at`: Creation timestamp

### Attendance Table
- `id`: Record ID
- `participant_id`: Reference to participant
- `event_id`: Associated event ID
- `check_in_time`: Check-in timestamp

## Future Improvements

You can extend this application with:

- 🔐 Authentication and authorization
- 📊 Advanced analytics and reports
- 📧 Email notifications
- 🔖 QR code generation for check-in
- 📱 Mobile-optimized check-in experience
- 🎨 Customizable branding
- 🌍 Multiple language support
- 📥 Export attendance reports
- 🔔 Real-time notifications
- 🎯 Event categories and filtering

## API Endpoints

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create new event

### Participants
- `GET /api/participants?eventId={id}` - Get participants for event
- `POST /api/participants` - Add participant

### Attendance
- `GET /api/attendance?eventId={id}` - Get attendance records
- `POST /api/attendance` - Mark attendance

### Upload
- `POST /api/upload` - Import participants from CSV

## Troubleshooting

### Database not initializing
- Delete the `attendance.db` file
- Restart the development server

### CSV upload fails
- Ensure CSV has headers: `name,email`
- Check file is valid UTF-8
- Verify event is selected

### Event link doesn't work
- Check that the event ID is correct
- Ensure participants are imported for that event
- Verify the BASE_URL in `.env.local` is correct

## License

MIT

---

**Need Help?** Check the sample CSV file or review the example workflow in the home page instructions.
