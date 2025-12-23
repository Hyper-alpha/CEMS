const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin role
router.use(authenticateToken, authorizeRoles('admin'));

// Get dashboard statistics
router.get('/dashboard-stats', async (req, res) => {
    try {
        // Get total counts
        const [totalUsers] = await req.db.execute('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
        const [totalEvents] = await req.db.execute('SELECT COUNT(*) as count FROM events');
        const [totalVenues] = await req.db.execute('SELECT COUNT(*) as count FROM venues WHERE is_active = TRUE');
        const [totalRegistrations] = await req.db.execute('SELECT COUNT(*) as count FROM event_registrations');

        // Get events by status
        const [eventsByStatus] = await req.db.execute(`
            SELECT status, COUNT(*) as count 
            FROM events 
            GROUP BY status
        `);

        // Get users by role
        const [usersByRole] = await req.db.execute(`
            SELECT role, COUNT(*) as count 
            FROM users 
            WHERE is_active = TRUE 
            GROUP BY role
        `);

        // Get recent events
        const [recentEvents] = await req.db.execute(`
            SELECT e.*, u.first_name as organizer_first_name, u.last_name as organizer_last_name,
                   v.name as venue_name, COUNT(er.id) as registered_count
            FROM events e
            LEFT JOIN users u ON e.organizer_id = u.id
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN event_registrations er ON e.id = er.event_id
            GROUP BY e.id
            ORDER BY e.created_at DESC
            LIMIT 10
        `);

        // Get pending approvals
        const [pendingEvents] = await req.db.execute(`
            SELECT e.*, u.first_name as organizer_first_name, u.last_name as organizer_last_name,
                   v.name as venue_name
            FROM events e
            LEFT JOIN users u ON e.organizer_id = u.id
            LEFT JOIN venues v ON e.venue_id = v.id
            WHERE e.status = 'pending'
            ORDER BY e.created_at ASC
        `);

        res.json({
            success: true,
            stats: {
                totalUsers: totalUsers[0].count,
                totalEvents: totalEvents[0].count,
                totalVenues: totalVenues[0].count,
                totalRegistrations: totalRegistrations[0].count,
                eventsByStatus,
                usersByRole,
                recentEvents,
                pendingEvents
            }
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics'
        });
    }
});

// Approve/reject event
router.put('/events/:id/status', [
    body('status').isIn(['approved', 'rejected']),
    body('adminNotes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const eventId = req.params.id;
        const { status, adminNotes } = req.body;

        // Check if event exists
        const [events] = await req.db.execute(
            'SELECT id, organizer_id, title FROM events WHERE id = ?',
            [eventId]
        );

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const event = events[0];

        // Update event status
        await req.db.execute(
            'UPDATE events SET status = ?, admin_notes = ? WHERE id = ?',
            [status, adminNotes || null, eventId]
        );

        // Create notification for organizer
        const message = status === 'approved' 
            ? `Your event "${event.title}" has been approved!`
            : `Your event "${event.title}" has been rejected. ${adminNotes ? 'Reason: ' + adminNotes : ''}`;

        await req.db.execute(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, 'Event Status Update', ?, ?)
        `, [event.organizer_id, message, status === 'approved' ? 'success' : 'error']);

        res.json({
            success: true,
            message: `Event ${status} successfully`
        });

    } catch (error) {
        console.error('Update event status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update event status'
        });
    }
});

// Get all events for admin
router.get('/events', async (req, res) => {
    try {
        // Coerce pagination params to integers to avoid prepared-statement LIMIT issues
        const pageNum = Number.parseInt(req.query.page, 10) || 1;
        const limitNum = Number.parseInt(req.query.limit, 10) || 20;
        const status = req.query.status;
        const search = req.query.search || '';
        const offset = (pageNum - 1) * limitNum;

        let query = `
            SELECT e.*, v.name as venue_name, v.location as venue_location,
                   u.first_name as organizer_first_name, u.last_name as organizer_last_name,
                   COUNT(er.id) as registered_count
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN users u ON e.organizer_id = u.id
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE 1=1
        `;
        
        const queryParams = [];

        if (status) {
            query += ` AND e.status = ?`;
            queryParams.push(status);
        }

        if (search) {
            query += ` AND (e.title LIKE ? OR e.description LIKE ?)`;
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        // Inline numeric LIMIT and OFFSET after validation
        query += ` GROUP BY e.id ORDER BY e.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

        const [events] = await req.db.execute(query, queryParams);
        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM events WHERE 1=1`;
        const countParams = [];

        if (status) {
            countQuery += ` AND status = ?`;
            countParams.push(status);
        }

        if (search) {
            countQuery += ` AND (title LIKE ? OR description LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm);
        }

        const [countResult] = await req.db.execute(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            events,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                totalEvents: total,
                hasNext: pageNum * limitNum < total,
                hasPrev: pageNum > 1
            }
        });

    } catch (error) {
        console.error('Get admin events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events'
        });
    }
});

// Get single event details (admin) - returns event regardless of status
router.get('/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;

        const [events] = await req.db.execute(`
            SELECT e.id, e.title, e.description, e.event_date, e.start_time, e.end_time,
                   e.venue_id, v.name as venue_name, v.location as venue_location, v.capacity as venue_capacity,
                   e.organizer_id, u.first_name as organizer_first_name, u.last_name as organizer_last_name, u.email as organizer_email,
                   COUNT(er.id) as registered_count, e.banner_image, e.status, e.admin_notes
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN users u ON e.organizer_id = u.id
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [eventId]);

        if (events.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        res.json({ success: true, event: events[0] });

    } catch (error) {
        console.error('Get admin event error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch event details' });
    }
});

// Cancel/reschedule event
router.put('/events/:id/cancel', [
    body('reason').trim().isLength({ min: 10 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const eventId = req.params.id;
        const { reason } = req.body;

        // Check if event exists
        const [events] = await req.db.execute(
            'SELECT id, organizer_id, title FROM events WHERE id = ?',
            [eventId]
        );

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const event = events[0];

        // Update event status
        await req.db.execute(
            'UPDATE events SET status = "cancelled", admin_notes = ? WHERE id = ?',
            [reason, eventId]
        );

        // Create notifications for all registered students
        await req.db.execute(`
            INSERT INTO notifications (user_id, title, message, type)
            SELECT er.student_id, 'Event Cancelled', ?, 'warning'
            FROM event_registrations er
            WHERE er.event_id = ?
        `, [`Event "${event.title}" has been cancelled. Reason: ${reason}`, eventId]);

        // Create notification for organizer
        await req.db.execute(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, 'Event Cancelled', ?, 'warning')
        `, [event.organizer_id, `Your event "${event.title}" has been cancelled. Reason: ${reason}`]);

        res.json({
            success: true,
            message: 'Event cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel event'
        });
    }
});

// Get system analytics
router.get('/analytics', async (req, res) => {
    try {
        const { period = '30' } = req.query; // days

        // Event participation trends
        const [participationTrends] = await req.db.execute(`
            SELECT DATE(e.event_date) as date, COUNT(er.id) as registrations
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.event_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(e.event_date)
            ORDER BY date
        `, [period]);

        // Department-wise participation
        const [departmentStats] = await req.db.execute(`
            SELECT u.department, COUNT(er.id) as registrations
            FROM event_registrations er
            JOIN users u ON er.student_id = u.id
            WHERE u.department IS NOT NULL
            GROUP BY u.department
            ORDER BY registrations DESC
        `);

        // Event feedback analytics
        const [feedbackStats] = await req.db.execute(`
            SELECT 
                AVG(feedback_rating) as avg_rating,
                COUNT(feedback_rating) as total_feedback,
                SUM(CASE WHEN feedback_rating >= 4 THEN 1 ELSE 0 END) as positive_feedback
            FROM event_registrations 
            WHERE feedback_rating IS NOT NULL
        `);

        // Popular venues
        const [venueStats] = await req.db.execute(`
            SELECT v.name, COUNT(e.id) as event_count, SUM(e.capacity) as total_capacity
            FROM venues v
            LEFT JOIN events e ON v.id = e.venue_id
            WHERE v.is_active = TRUE
            GROUP BY v.id, v.name
            ORDER BY event_count DESC
        `);

        res.json({
            success: true,
            analytics: {
                participationTrends,
                departmentStats,
                feedbackStats: feedbackStats[0],
                venueStats
            }
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics'
        });
    }
});

// Get system settings
router.get('/settings', async (req, res) => {
    try {
        const [settings] = await req.db.execute(
            'SELECT setting_key, setting_value, description FROM system_settings ORDER BY setting_key'
        );

        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.setting_key] = {
                value: setting.setting_value,
                description: setting.description
            };
        });

        res.json({
            success: true,
            settings: settingsObj
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings'
        });
    }
});

// Update system settings
router.put('/settings', [
    body('settings').isObject()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { settings } = req.body;

        for (const [key, value] of Object.entries(settings)) {
            await req.db.execute(
                'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
                [value, key]
            );
        }

        res.json({
            success: true,
            message: 'Settings updated successfully'
        });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings'
        });
    }
});

// Send announcement
router.post('/announcements', [
    body('title').trim().isLength({ min: 5, max: 255 }),
    body('message').trim().isLength({ min: 10 }),
    body('targetRole').optional().isIn(['student', 'organizer', 'all'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { title, message, targetRole = 'all' } = req.body;

        let query = 'SELECT id FROM users WHERE is_active = TRUE';
        const queryParams = [];

        if (targetRole !== 'all') {
            query += ' AND role = ?';
            queryParams.push(targetRole);
        }

        const [users] = await req.db.execute(query, queryParams);

        // Create notifications for all target users
        if (users.length > 0) {
            const notificationValues = users.map(user => 
                [user.id, title, message, 'info']
            );

            await req.db.execute(`
                INSERT INTO notifications (user_id, title, message, type)
                VALUES ${notificationValues.map(() => '(?, ?, ?, ?)').join(', ')}
            `, notificationValues.flat());
        }

        res.json({
            success: true,
            message: `Announcement sent to ${users.length} users`
        });

    } catch (error) {
        console.error('Send announcement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send announcement'
        });
    }
});

module.exports = router;

