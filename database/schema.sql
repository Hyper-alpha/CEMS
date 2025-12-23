-- College Event Management System Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS cems_database;
USE cems_database;

-- Users table (Students, Organizers, Admins)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('student', 'organizer', 'admin') NOT NULL DEFAULT 'student',
    student_id VARCHAR(50) UNIQUE,
    department VARCHAR(100),
    phone VARCHAR(20),
    profile_image VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Venues table
CREATE TABLE venues (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    capacity INT NOT NULL,
    facilities TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue_id INT,
    organizer_id INT NOT NULL,
    capacity INT NOT NULL,
    registration_deadline DATETIME,
    banner_image VARCHAR(255),
    status ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled', 'completed') DEFAULT 'draft',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venues(id),
    FOREIGN KEY (organizer_id) REFERENCES users(id)
);

-- Event registrations
CREATE TABLE event_registrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    student_id INT NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('registered', 'attended', 'absent') DEFAULT 'registered',
    qr_code TEXT,
    feedback_rating INT CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_text TEXT,
    feedback_date TIMESTAMP NULL,
    UNIQUE KEY unique_registration (event_id, student_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Event volunteers
CREATE TABLE event_volunteers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    volunteer_id INT NOT NULL,
    task_assigned TEXT,
    status ENUM('assigned', 'in_progress', 'completed') DEFAULT 'assigned',
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_date TIMESTAMP NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Event budgets
CREATE TABLE event_budgets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    estimated_amount DECIMAL(10,2) NOT NULL,
    actual_amount DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Event polls/voting
CREATE TABLE event_polls (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    question TEXT NOT NULL,
    poll_type ENUM('single_choice', 'multiple_choice', 'rating') NOT NULL,
    options JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Poll responses
CREATE TABLE poll_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    poll_id INT NOT NULL,
    student_id INT NOT NULL,
    response JSON NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_poll_response (poll_id, student_id),
    FOREIGN KEY (poll_id) REFERENCES event_polls(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Certificates
CREATE TABLE certificates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    student_id INT NOT NULL,
    certificate_type VARCHAR(100) NOT NULL,
    certificate_data JSON,
    qr_code TEXT,
    issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    issued_by INT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by) REFERENCES users(id)
);

-- System settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default admin user
INSERT INTO users (email, password, first_name, last_name, role, is_active) 
VALUES ('admin@eventor.test', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', TRUE);

-- Insert default organizer user
INSERT INTO users (email, password, first_name, last_name, role, is_active) 
VALUES ('organizer@eventor.test', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Event', 'Organizer', 'organizer', TRUE);

-- Insert default student user
INSERT INTO users (email, password, first_name, last_name, role, student_id, department, is_active) 
VALUES ('student@eventor.test', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Test', 'Student', 'student', 'STU001', 'Computer Science', TRUE);

-- Insert sample venues
INSERT INTO venues (name, location, capacity, facilities) VALUES
('Main Auditorium', 'Building A, Ground Floor', 500, 'Projector, Sound System, Air Conditioning'),
('Conference Hall', 'Building B, 2nd Floor', 100, 'Projector, Whiteboard, Air Conditioning'),
('Open Air Theater', 'Central Campus', 1000, 'Sound System, Stage'),
('Computer Lab 1', 'Building C, 1st Floor', 50, 'Computers, Projector'),
('Seminar Hall', 'Building A, 3rd Floor', 80, 'Projector, Sound System');

-- Insert sample events
INSERT INTO events (title, description, event_date, start_time, end_time, venue_id, organizer_id, capacity, status) VALUES
('Tech Fest 2024', 'Annual technology festival showcasing innovations and competitions', '2024-03-15', '09:00:00', '17:00:00', 1, 2, 500, 'approved'),
('Cultural Night', 'Traditional and modern cultural performances', '2024-03-20', '18:00:00', '22:00:00', 3, 2, 800, 'approved'),
('Career Fair', 'Meet with top companies and explore career opportunities', '2024-03-25', '10:00:00', '16:00:00', 1, 2, 300, 'approved');

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('site_name', 'College Event Management System', 'Name of the application'),
('max_registration_per_student', '10', 'Maximum number of events a student can register for'),
('registration_deadline_hours', '24', 'Hours before event when registration closes'),
('email_notifications', 'true', 'Enable email notifications'),
('theme_default', 'light', 'Default theme for the application');

