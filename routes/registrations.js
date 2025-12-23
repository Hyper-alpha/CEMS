const express = require('express');
const QRCode = require('qrcode');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

const router = express.Router();

// Ensure upload directories exist
const QR_DIR = path.join(__dirname, '..', 'uploads', 'qr');
const PASS_DIR = path.join(__dirname, '..', 'uploads', 'passes');
[QR_DIR, PASS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper: send email if SMTP configured
async function sendPassEmail(to, subject, text, attachments = []) {
    if (!process.env.SMTP_HOST) return; // SMTP not configured

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@cems.local',
        to,
        subject,
        text,
        attachments
    });
}

function escapeHtml(unsafe) {
    if (!unsafe && unsafe !== 0) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Register for an event
router.post('/:eventId', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const studentId = req.user.id;

        // Check if event exists and is open for registration
        const [events] = await req.db.execute(`
            SELECT e.*, v.capacity as venue_capacity, COUNT(er.id) as registered_count
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.id = ? AND e.status IN ('approved', 'pending')
            GROUP BY e.id
        `, [eventId]);

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found or not available for registration'
            });
        }

        const event = events[0];

        // Check if registration deadline has passed
        if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed'
            });
        }

        // Check if event is full
        if (event.registered_count >= event.capacity) {
            return res.status(400).json({
                success: false,
                message: 'Event is full'
            });
        }

        // Check if already registered
        const [existingRegistrations] = await req.db.execute(
            'SELECT id FROM event_registrations WHERE event_id = ? AND student_id = ?',
            [eventId, studentId]
        );

        if (existingRegistrations.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You are already registered for this event'
            });
        }

        // Generate compact QR payload and data URL for display
        const qrPayload = JSON.stringify({
            eventId: Number(eventId),
            studentId: Number(studentId),
            registrationToken: `reg_${Date.now()}`
        });

        // Create a data URL (image) for client display but store only the compact payload in DB
        const qrDataUrl = await QRCode.toDataURL(qrPayload);

        // Register for event — store compact payload to avoid hitting column size limits
        const [result] = await req.db.execute(
            `INSERT INTO event_registrations (event_id, student_id, qr_code) VALUES (?, ?, ?)`,
            [eventId, studentId, qrPayload]
        );

        // Create notification
        await req.db.execute(
            `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Event Registration Confirmed', ?, 'success')`,
            [studentId, `You have successfully registered for "${event.title}"`]
        );

        // Enforce max registrations per student (if configured)
        try {
            const [settingRows] = await req.db.execute('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['max_registration_per_student']);
            if (settingRows && settingRows.length > 0) {
                const maxAllowed = parseInt(settingRows[0].setting_value, 10) || 0;
                if (maxAllowed > 0) {
                    const [countRows] = await req.db.execute('SELECT COUNT(*) as total FROM event_registrations WHERE student_id = ?', [studentId]);
                    const currentCount = countRows[0].total || 0;
                    if (currentCount > maxAllowed) {
                        // rollback registration we just inserted
                        await req.db.execute('DELETE FROM event_registrations WHERE id = ?', [result.insertId]);
                        return res.status(400).json({ success: false, message: `Registration limit reached (${maxAllowed})` });
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to enforce max registration setting:', e.message || e);
        }

        // Fetch user details for pass
        const [userRows] = await req.db.execute('SELECT id, first_name, last_name, email, student_id, department, phone FROM users WHERE id = ?', [studentId]);
        const user = userRows[0] || { id: studentId };

        // Save QR image to disk (PNG)
        const qrFilename = `qr_${uuidv4()}.png`;
        const qrFilePath = path.join(QR_DIR, qrFilename);
        // qrDataUrl is like 'data:image/png;base64,AAA...'
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(qrFilePath, base64Data, 'base64');

        // Generate simple HTML for PDF pass
        const passHtml = `
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Registration Pass</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .pass { max-width: 600px; border: 1px solid #ddd; padding: 20px; }
                    .header { display:flex; justify-content:space-between; align-items:center; }
                    .qr { width:140px; height:140px; }
                </style>
            </head>
            <body>
                <div class="pass">
                    <div class="header">
                        <div>
                            <h2>${escapeHtml(event.title)}</h2>
                            <p>${escapeHtml(event.event_date)} ${escapeHtml(event.start_time || '')} - ${escapeHtml(event.end_time || '')}</p>
                            <p>${escapeHtml(event.venue_name || '')}</p>
                        </div>
                        <div>
                            <img class="qr" src="${qrDataUrl}" />
                        </div>
                    </div>
                    <hr />
                    <div>
                        <h4>Attendee</h4>
                        <p>${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}</p>
                        <p>${escapeHtml(user.email || '')}</p>
                        <p>Student ID: ${escapeHtml(user.student_id || '')}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Generate PDF using Puppeteer
        const pdfFilename = `pass_${uuidv4()}.pdf`;
        const pdfFilePath = path.join(PASS_DIR, pdfFilename);
        try {
            const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(passHtml, { waitUntil: 'networkidle0' });
            await page.pdf({ path: pdfFilePath, format: 'A4', printBackground: true });
            await browser.close();
        } catch (pdfErr) {
            console.error('Failed to generate PDF pass:', pdfErr);
        }

        // Send email with attachments if configured
        try {
            if (user.email) {
                const attachments = [];
                if (fs.existsSync(qrFilePath)) attachments.push({ filename: qrFilename, path: qrFilePath });
                if (fs.existsSync(pdfFilePath)) attachments.push({ filename: pdfFilename, path: pdfFilePath });

                await sendPassEmail(user.email, `Registration Pass: ${event.title}`, `Attached is your registration pass for ${event.title}.`, attachments);
            }
        } catch (emailErr) {
            console.error('Failed to send registration email:', emailErr);
        }

        const registrationPass = {
            registrationId: result.insertId,
            event: {
                id: event.id,
                title: event.title,
                description: event.description,
                event_date: event.event_date,
                start_time: event.start_time,
                end_time: event.end_time,
                venue_name: event.venue_name || null
            },
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                student_id: user.student_id,
                department: user.department,
                phone: user.phone
            },
            qrImage: qrDataUrl,
            qrFileUrl: `/uploads/qr/${qrFilename}`,
            pdfFileUrl: fs.existsSync(pdfFilePath) ? `/uploads/passes/${pdfFilename}` : null
        };

        res.status(201).json({
            success: true,
            message: 'Successfully registered for the event',
            registrationPass
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register for event'
        });
    }
});

// Unregister from an event
router.delete('/:eventId', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const studentId = req.user.id;

        // Check if registration exists
        const [registrations] = await req.db.execute(
            'SELECT id FROM event_registrations WHERE event_id = ? AND student_id = ?',
            [eventId, studentId]
        );

        if (registrations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'You are not registered for this event'
            });
        }

        // Check if event has already started
        const [events] = await req.db.execute(
            'SELECT event_date, start_time FROM events WHERE id = ?',
            [eventId]
        );

        if (events.length > 0) {
            const event = events[0];
            const eventDateTime = new Date(`${event.event_date} ${event.start_time}`);
            
            if (new Date() >= eventDateTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot unregister from an event that has already started'
                });
            }
        }

        // Remove registration
        await req.db.execute(
            'DELETE FROM event_registrations WHERE event_id = ? AND student_id = ?',
            [eventId, studentId]
        );

        res.json({
            success: true,
            message: 'Successfully unregistered from the event'
        });

    } catch (error) {
        console.error('Unregistration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unregister from event'
        });
    }
});

// Get student's registrations
router.get('/my-registrations', authenticateToken, authorizeRoles('student'), async (req, res) => {
    try {
        const { status = 'all' } = req.query;
        // Validate and coerce pagination values to integers to avoid passing strings to prepared statements
        const page = Number.isFinite(Number(req.query.page)) ? Math.max(1, parseInt(req.query.page, 10)) : 1;
        const limit = Number.isFinite(Number(req.query.limit)) ? Math.max(1, parseInt(req.query.limit, 10)) : 10;
        const offset = Math.max(0, (page - 1) * limit);
        const studentId = req.user.id;

        let query = `
            SELECT er.*, e.title, e.description, e.event_date, e.start_time, e.end_time,
                   e.banner_image, v.name as venue_name, v.location as venue_location,
                   u.first_name as organizer_first_name, u.last_name as organizer_last_name
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN users u ON e.organizer_id = u.id
            WHERE er.student_id = ?
        `;

        const queryParams = [studentId];

        if (status === 'upcoming') {
            query += ` AND e.event_date >= CURDATE()`;
        } else if (status === 'past') {
            query += ` AND e.event_date < CURDATE()`;
        }

    // Inject numeric LIMIT/OFFSET directly (safe because we've validated them above)
    query += ` ORDER BY e.event_date DESC LIMIT ${limit} OFFSET ${offset}`;

    const [registrations] = await req.db.execute(query, queryParams);

        res.json({
            success: true,
            registrations
        });

    } catch (error) {
        console.error('Get registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registrations'
        });
    }
});

// Get or generate a registration pass (PDF + QR) for a student's registration
router.get('/:eventId/pass', authenticateToken, authorizeRoles('student'), async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const studentId = req.user.id;

        // Check registration exists
        const [registrations] = await req.db.execute(
            'SELECT id FROM event_registrations WHERE event_id = ? AND student_id = ?',
            [eventId, studentId]
        );

        if (registrations.length === 0) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        // Fetch event details
        const [events] = await req.db.execute(`
            SELECT e.*, v.name as venue_name
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            WHERE e.id = ?
        `, [eventId]);

        if (events.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = events[0];

        // Fetch user details
        const [userRows] = await req.db.execute('SELECT id, first_name, last_name, email, student_id, department, phone FROM users WHERE id = ?', [studentId]);
        const user = userRows[0] || { id: studentId };

        // Generate QR payload and data URL
        const qrPayload = JSON.stringify({ eventId: Number(eventId), studentId: Number(studentId), registrationToken: `reg_${Date.now()}` });
        const qrDataUrl = await QRCode.toDataURL(qrPayload);

        // Save QR image to disk
        const qrFilename = `qr_${uuidv4()}.png`;
        const qrFilePath = path.join(QR_DIR, qrFilename);
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(qrFilePath, base64Data, 'base64');

        // Generate HTML for PDF
        const passHtml = `
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Registration Pass</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .pass { max-width: 600px; border: 1px solid #ddd; padding: 20px; }
                    .header { display:flex; justify-content:space-between; align-items:center; }
                    .qr { width:140px; height:140px; }
                </style>
            </head>
            <body>
                <div class="pass">
                    <div class="header">
                        <div>
                            <h2>${escapeHtml(event.title)}</h2>
                            <p>${escapeHtml(event.event_date)} ${escapeHtml(event.start_time || '')} - ${escapeHtml(event.end_time || '')}</p>
                            <p>${escapeHtml(event.venue_name || '')}</p>
                        </div>
                        <div>
                            <img class="qr" src="${qrDataUrl}" />
                        </div>
                    </div>
                    <hr />
                    <div>
                        <h4>Attendee</h4>
                        <p>${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}</p>
                        <p>${escapeHtml(user.email || '')}</p>
                        <p>Student ID: ${escapeHtml(user.student_id || '')}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Generate PDF
        const pdfFilename = `pass_${uuidv4()}.pdf`;
        const pdfFilePath = path.join(PASS_DIR, pdfFilename);
        try {
            const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(passHtml, { waitUntil: 'networkidle0' });
            await page.pdf({ path: pdfFilePath, format: 'A4', printBackground: true });
            await browser.close();
        } catch (pdfErr) {
            console.error('Failed to generate PDF pass:', pdfErr);
        }

        const registrationPass = {
            event: {
                id: event.id,
                title: event.title,
                event_date: event.event_date,
                start_time: event.start_time,
                end_time: event.end_time,
                venue_name: event.venue_name || null
            },
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                student_id: user.student_id
            },
            qrImage: qrDataUrl,
            qrFileUrl: `/uploads/qr/${qrFilename}`,
            pdfFileUrl: fs.existsSync(pdfFilePath) ? `/uploads/passes/${pdfFilename}` : null
        };

        res.json({ success: true, registrationPass });

    } catch (err) {
        console.error('Get registration pass error:', err);
        res.status(500).json({ success: false, message: 'Failed to generate pass' });
    }
});

// Get event registrations (organizer/admin)
router.get('/event/:eventId', authenticateToken, authorizeRoles('organizer', 'admin'), async (req, res) => {
    try {
    const eventId = req.params.eventId;
    // Coerce pagination values to numbers and validate inputs to avoid invalid prepared-statement args
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Number.isFinite(Number(page)) ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = Number.isFinite(Number(limit)) ? Math.max(1, parseInt(limit, 10)) : 50;
    const offset = Math.max(0, (pageNum - 1) * limitNum);

        // Check if user has permission to view this event's registrations
        const [events] = await req.db.execute(
            'SELECT organizer_id FROM events WHERE id = ?',
            [eventId]
        );

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        if (req.user.role === 'organizer' && events[0].organizer_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only view registrations for your own events'
            });
        }

        // Ensure numeric types for DB bindings
        const eventIdNum = Number.isFinite(Number(eventId)) ? parseInt(eventId, 10) : eventId;
        // Interpolate validated numeric LIMIT/OFFSET directly to avoid prepared-statement type issues
        const debugQuery = `
            SELECT er.*, u.first_name, u.last_name, u.email, u.student_id, u.department, u.phone
            FROM event_registrations er
            JOIN users u ON er.student_id = u.id
            WHERE er.event_id = ?
            ORDER BY er.registration_date DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `;
        console.debug('[registrations] SQL params:', { eventId: eventIdNum, limitNum, offset });
        const [registrations] = await req.db.execute(debugQuery, [eventIdNum]);

        // Get total count
        const [countResult] = await req.db.execute(
            'SELECT COUNT(*) as total FROM event_registrations WHERE event_id = ?',
            [eventIdNum]
        );

        res.json({
            success: true,
            registrations,
            total: countResult[0].total
        });

    } catch (error) {
        console.error('Get event registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event registrations'
        });
    }
});

// Mark attendance (organizer/admin)
router.put('/:registrationId/attendance', authenticateToken, authorizeRoles('organizer', 'admin'), async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { status } = req.body; // 'attended' or 'absent'

        if (!['attended', 'absent'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid attendance status'
            });
        }

        // Check if registration exists and user has permission
        const [registrations] = await req.db.execute(`
            SELECT er.*, e.organizer_id
            FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            WHERE er.id = ?
        `, [registrationId]);

        if (registrations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        if (req.user.role === 'organizer' && registrations[0].organizer_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only mark attendance for your own events'
            });
        }

        await req.db.execute(
            'UPDATE event_registrations SET status = ? WHERE id = ?',
            [status, registrationId]
        );

        res.json({
            success: true,
            message: `Attendance marked as ${status}`
        });

    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark attendance'
        });
    }
});

// Submit feedback
router.post('/:eventId/feedback', authenticateToken, authorizeRoles('student'), async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const { rating, feedback } = req.body;
        const studentId = req.user.id;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Check if user is registered and attended the event
        const [registrations] = await req.db.execute(
            'SELECT id, status FROM event_registrations WHERE event_id = ? AND student_id = ?',
            [eventId, studentId]
        );

        if (registrations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'You are not registered for this event'
            });
        }

        if (registrations[0].status !== 'attended') {
            return res.status(400).json({
                success: false,
                message: 'You can only submit feedback for events you attended'
            });
        }

        // Check if feedback already submitted
        const [existingFeedback] = await req.db.execute(
            'SELECT id FROM event_registrations WHERE event_id = ? AND student_id = ? AND feedback_rating IS NOT NULL',
            [eventId, studentId]
        );

        if (existingFeedback.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Feedback already submitted for this event'
            });
        }

        await req.db.execute(
            'UPDATE event_registrations SET feedback_rating = ?, feedback_text = ?, feedback_date = NOW() WHERE event_id = ? AND student_id = ?',
            [rating, feedback || null, eventId, studentId]
        );

        res.json({
            success: true,
            message: 'Feedback submitted successfully'
        });

    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit feedback'
        });
    }
});

module.exports = router;

