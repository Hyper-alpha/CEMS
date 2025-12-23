# College Event Management System (CEMS)

A comprehensive web-based platform for managing college events with role-based access control, built with Node.js, Express, and MySQL.

![CEMS](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Database Setup](#-database-setup)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [User Roles](#-user-roles)
- [Default Credentials](#-default-credentials)
- [Security Features](#-security-features)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### For Students
- 📅 Browse and search upcoming events
- ✅ Register for events with QR code generation
- 📊 View registration history and attendance
- ⭐ Provide event feedback and ratings
- 🎓 Download participation certificates
- 🔔 Receive real-time notifications

### For Organizers
- 📝 Create and manage events
- 👥 Track event registrations and attendance
- 📸 Upload event banners
- 💰 Manage event budgets
- 🙋 Assign and manage volunteers
- 📊 Create polls and surveys
- 📈 View event analytics

### For Administrators
- ✔️ Approve or reject event proposals
- 👤 Manage users and roles
- 🏢 Manage venues and facilities
- 📊 View system-wide analytics
- 🚫 Cancel or reschedule events
- ⚙️ Configure system settings
- 📧 Send bulk notifications

## 🛠️ Tech Stack

**Backend:**
- Node.js
- Express.js
- MySQL (with mysql2)
- JWT Authentication
- bcryptjs (Password Hashing)

**Frontend:**
- HTML5
- CSS3 (Vanilla CSS)
- JavaScript (ES6+)
- Font Awesome Icons

**Key Libraries:**
- `multer` - File upload handling
- `helmet` - Security headers
- `express-validator` - Input validation
- `express-rate-limit` - Rate limiting
- `qrcode` - QR code generation
- `puppeteer` - PDF generation
- `nodemailer` - Email notifications

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher)
- **MySQL** (v5.7 or higher)
- **Git** (optional, for cloning)

## 🚀 Installation

1. **Clone the repository** (or download the ZIP file)
   ```bash
   git clone <repository-url>
   cd new\ CEMS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   Or manually create a `.env` file in the root directory (see [Configuration](#-configuration))

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=cems_database

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=development

# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

### Important Notes:
- Replace `your_mysql_password` with your actual MySQL root password
- Generate a strong `JWT_SECRET` (you can use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password

## 💾 Database Setup

1. **Start MySQL server**
   ```bash
   # Windows
   net start MySQL80
   
   # macOS/Linux
   sudo systemctl start mysql
   ```

2. **Create database and tables**
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   
   Or manually:
   ```bash
   mysql -u root -p
   ```
   ```sql
   source database/schema.sql;
   ```

3. **Verify database creation**
   ```sql
   USE cems_database;
   SHOW TABLES;
   ```

The schema includes:
- 11 tables with proper relationships
- 3 default users (admin, organizer, student)
- 5 sample venues
- 3 sample events
- System settings

## 🏃 Running the Application

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at: **http://localhost:3000**

## 📁 Project Structure

```
new CEMS/
├── database/
│   └── schema.sql              # Database schema and seed data
├── middleware/
│   └── auth.js                 # Authentication middleware
├── routes/
│   ├── admin.js                # Admin routes
│   ├── auth.js                 # Authentication routes
│   ├── events.js               # Event management routes
│   ├── notifications.js        # Notification routes
│   ├── registrations.js        # Registration routes
│   ├── users.js                # User management routes
│   └── venues.js               # Venue routes
├── public/
│   ├── css/
│   │   ├── auth.css           # Authentication page styles
│   │   ├── dashboard.css      # Dashboard styles
│   │   └── style.css          # Global styles
│   ├── js/
│   │   ├── admin-dashboard.js
│   │   ├── api.js             # API helper functions
│   │   ├── auth.js            # Authentication logic
│   │   ├── dashboard.js
│   │   ├── index.js           # Landing page logic
│   │   ├── organizer-dashboard.js
│   │   ├── profile.js
│   │   ├── settings.js
│   │   ├── student-dashboard.js
│   │   └── theme.js           # Theme toggle
│   ├── index.html             # Landing page
│   ├── login.html
│   ├── register.html
│   ├── student-dashboard.html
│   ├── organizer-dashboard.html
│   ├── admin-dashboard.html
│   ├── profile.html
│   └── settings.html
├── scripts/
│   ├── debug-events.js        # Debug utilities
│   └── shift-events.js        # Event date utilities
├── uploads/                    # User uploaded files
├── .env                        # Environment variables
├── server.js                   # Express server entry point
├── package.json
└── README.md
```

## 📡 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | User login | No |
| GET | `/api/auth/profile` | Get user profile | Yes |
| PUT | `/api/auth/profile` | Update profile | Yes |
| PUT | `/api/auth/change-password` | Change password | Yes |
| GET | `/api/auth/verify` | Verify JWT token | Yes |

### Event Endpoints

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/events` | Get all events | No | - |
| GET | `/api/events/:id` | Get event details | No | - |
| POST | `/api/events` | Create event | Yes | Organizer/Admin |
| PUT | `/api/events/:id` | Update event | Yes | Organizer/Admin |
| DELETE | `/api/events/:id` | Delete event | Yes | Organizer/Admin |
| GET | `/api/events/:id/registrations` | Get registrations | Yes | Organizer/Admin |

### Registration Endpoints

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/api/registrations/:eventId` | Register for event | Yes | Student |
| DELETE | `/api/registrations/:eventId` | Unregister | Yes | Student |
| GET | `/api/registrations/my-registrations` | Get user registrations | Yes | Student |
| POST | `/api/registrations/:id/feedback` | Submit feedback | Yes | Student |
| POST | `/api/registrations/verify-attendance` | Mark attendance | Yes | Organizer |

### Admin Endpoints

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/admin/dashboard-stats` | Get statistics | Yes | Admin |
| PUT | `/api/admin/events/:id/status` | Approve/reject event | Yes | Admin |
| GET | `/api/admin/events` | Get all events | Yes | Admin |
| PUT | `/api/admin/events/:id/cancel` | Cancel event | Yes | Admin |
| GET | `/api/admin/users` | Get all users | Yes | Admin |
| PUT | `/api/admin/users/:id/role` | Update user role | Yes | Admin |

### Venue Endpoints

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/venues` | Get all venues | No | - |
| POST | `/api/venues` | Create venue | Yes | Admin |
| PUT | `/api/venues/:id` | Update venue | Yes | Admin |
| DELETE | `/api/venues/:id` | Delete venue | Yes | Admin |

### Notification Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/notifications` | Get user notifications | Yes |
| PUT | `/api/notifications/:id/read` | Mark as read | Yes |
| DELETE | `/api/notifications/:id` | Delete notification | Yes |

## 👥 User Roles

### Student
- Browse and search events
- Register/unregister for events
- View registration history
- Submit event feedback
- Download certificates

### Organizer
- All student permissions
- Create and manage events
- View event registrations
- Manage volunteers
- Track budgets
- Create polls

### Admin
- All organizer permissions
- Approve/reject events
- Manage all users
- Manage venues
- Cancel any event
- View system analytics
- Configure settings

## 🔑 Default Credentials

After running the database schema, you can login with these default accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@eventor.test | password |
| Organizer | organizer@eventor.test | password |
| Student | student@eventor.test | password |

> ⚠️ **Important:** Change these passwords immediately in production!

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt with salt rounds
- **Helmet.js** - Security headers (XSS, CSP, etc.)
- **Rate Limiting** - 100 requests per 15 minutes per IP
- **CORS Protection** - Configured cross-origin policies
- **Input Validation** - express-validator on all inputs
- **SQL Injection Prevention** - Parameterized queries
- **File Upload Validation** - Type and size restrictions
- **Role-Based Access Control** - Granular permissions

## 🧪 Testing

To test the application:

1. **Start the server**
   ```bash
   npm run dev
   ```

2. **Access the application**
   - Landing Page: http://localhost:3000
   - Login: http://localhost:3000/login
   - Register: http://localhost:3000/register

3. **Test with default users** (see [Default Credentials](#-default-credentials))

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check if MySQL is running
mysql -u root -p

# Verify database exists
SHOW DATABASES;
USE cems_database;
```

### Port Already in Use
```bash
# Change PORT in .env file
PORT=3001
```

### File Upload Issues
```bash
# Ensure uploads directory exists and has write permissions
mkdir uploads
chmod 755 uploads
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Authors

**CEMS Team**

## 🙏 Acknowledgments

- Font Awesome for icons
- Express.js community
- MySQL community
- All contributors

## 📞 Support

For support, email info@cems.edu or create an issue in the repository.

---

**Made with ❤️ by CEMS Team**
