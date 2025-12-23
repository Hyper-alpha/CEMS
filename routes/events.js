const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles, optionalAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/events/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'event-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Helper middleware: normalize common date formats and coerce strings before validation runs
function sanitizeEventInput(req, res, next) {
    try {
        // Normalize DD-MM-YYYY to YYYY-MM-DD for eventDate and registrationDeadline (date part)
        const normDate = (val) => {
            if (!val) return val;
            if (val instanceof Date) return val.toISOString().split('T')[0];
            if (typeof val === 'string') {
                if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
                    const [d, m, y] = val.split('-');
                    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                }
                // already ISO-like
                return val;
            }
            return val;
        };

        // For registrationDeadline which may include time (datetime-local)
        const normDateTime = (val) => {
            if (!val) return val;
            if (val instanceof Date) return val.toISOString();
            if (typeof val === 'string') {
                if (/^\d{2}-\d{2}-\d{4}T/.test(val)) {
                    const [datePart, timePart] = val.split('T');
                    const [d, m, y] = datePart.split('-');
                    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${timePart}`;
                }
                return val;
            }
            return val;
        };

        if (req.body) {
            // Normalize date fields
            if (req.body.eventDate) req.body.eventDate = normDate(req.body.eventDate);
            if (req.body.event_date) req.body.event_date = normDate(req.body.event_date);
            if (req.body.registrationDeadline) req.body.registrationDeadline = normDateTime(req.body.registrationDeadline);
            if (req.body.registration_deadline) req.body.registration_deadline = normDateTime(req.body.registration_deadline);

            // Map camelCase <-> snake_case so validators (which may expect either) see values
            const mapPairs = {
                eventDate: 'event_date',
                startTime: 'start_time',
                endTime: 'end_time',
                venueId: 'venue_id',
                registrationDeadline: 'registration_deadline',
                capacity: 'capacity'
            };
            Object.keys(mapPairs).forEach(camel => {
                const snake = mapPairs[camel];
                if (req.body[camel] !== undefined && req.body[snake] === undefined) {
                    req.body[snake] = req.body[camel];
                }
                if (req.body[snake] !== undefined && req.body[camel] === undefined) {
                    req.body[camel] = req.body[snake];
                }
            });

            // Coerce numeric-ish fields to strings/ints acceptable to validators and DB
            if (req.body.capacity !== undefined && typeof req.body.capacity === 'string') {
                const n = parseInt(req.body.capacity, 10);
                if (!Number.isNaN(n)) req.body.capacity = String(n);
            }
            if (req.body.venue_id !== undefined && typeof req.body.venue_id === 'string') {
                const n = parseInt(req.body.venue_id, 10);
                if (!Number.isNaN(n)) req.body.venue_id = String(n);
            }

            // If any date fields were coerced to Date objects by previous middleware, stringify them for validators
            ['eventDate','event_date','registrationDeadline','registration_deadline'].forEach(k => {
                if (req.body[k] instanceof Date) {
                    try { req.body[k] = req.body[k].toISOString(); } catch (e) {}
                }
            });
        }
    } catch (e) {
        console.warn('sanitizeEventInput error:', e && e.message ? e.message : e);
    }
    next();
}

// Get all events (public)
router.get('/', optionalAuth, async (req, res) => {
    try {
        // Coerce pagination values to numbers and validate inputs to avoid invalid prepared-statement args
        const { page = 1, limit = 10, status = 'approved', search = '' } = req.query;
        const pageNum = Number.isFinite(Number(page)) ? parseInt(page, 10) : 1;
        const limitNum = Number.isFinite(Number(limit)) ? parseInt(limit, 10) : 10;
        const offset = Math.max(0, (pageNum - 1) * limitNum);

        // Explicit column selection (avoid SELECT e.* for clarity and compatibility)
        let query = `
            SELECT
                e.id,
                e.title,
                e.description,
                e.event_date,
                e.start_time,
                e.end_time,
                e.venue_id,
                v.name AS venue_name,
                v.location AS venue_location,
                v.capacity AS venue_capacity,
                e.organizer_id,
                u.first_name AS organizer_first_name,
                u.last_name AS organizer_last_name,
                COALESCE(reg_count.registered_count, 0) AS registered_count,
                e.banner_image,
                e.status
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN users u ON e.organizer_id = u.id
            LEFT JOIN (
                SELECT event_id, COUNT(*) AS registered_count
                FROM event_registrations
                GROUP BY event_id
            ) reg_count ON e.id = reg_count.event_id
            WHERE e.status = ? AND e.event_date >= CURDATE()
        `;
        
    const queryParams = [status];

        if (search) {
            query += ` AND (e.title LIKE ? OR e.description LIKE ?)`;
            queryParams.push(`%${search}%`, `%${search}%`);
        }

    // Append ORDER / LIMIT / OFFSET with numeric values directly (validated above)
    query += ` ORDER BY e.event_date ASC LIMIT ${limitNum} OFFSET ${offset}`;

    // Debug: log the final query and params to console and a file to help diagnose parameter issues
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    console.debug('[events] SQL:', normalizedQuery);
    console.debug('[events] params:', queryParams);
    try {
    const debugEntry = `\n=== ${new Date().toISOString()} ===\nSQL: ${normalizedQuery}\nParams: ${JSON.stringify(queryParams)}\nParamTypes: ${JSON.stringify(queryParams.map(p=>({value:p,type:typeof p})))}\n`;
        fs.appendFileSync('events-debug.log', debugEntry);
    } catch (e) {
        console.debug('Failed to write events-debug.log', e);
    }

    let events;
    try {
        const _res = await req.db.execute(query, queryParams);
        events = _res[0];
    } catch (dbErr) {
        console.error('DB execute error (events):', dbErr);
        try { fs.appendFileSync('events-debug.log', `DB ERROR (events) ${new Date().toISOString()}\n${dbErr.stack || dbErr}\n`); } catch (e) {}
        throw dbErr;
    }

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM events WHERE status = ? AND event_date >= CURDATE()`;
        const countParams = [status];

        if (search) {
            countQuery += ` AND (title LIKE ? OR description LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }

    let total = 0;
    try {
        const _countRes = await req.db.execute(countQuery, countParams);
        const countResult = _countRes[0];
        total = countResult[0].total;
    } catch (dbErr) {
        console.error('DB execute error (count):', dbErr);
        try { fs.appendFileSync('events-debug.log', `DB ERROR (count) ${new Date().toISOString()}\n${dbErr.stack || dbErr}\n`); } catch (e) {}
        throw dbErr;
    }

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
        console.error('Get events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events'
        });
    }
});

// Get single event details
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const eventId = req.params.id;
        // Fetch the event regardless of status first. We'll enforce visibility rules below.
        const [events] = await req.db.execute(`
            SELECT e.*, v.name as venue_name, v.location as venue_location, v.capacity as venue_capacity, v.facilities,
                   u.first_name as organizer_first_name, u.last_name as organizer_last_name, u.email as organizer_email,
                   COUNT(er.id) as registered_count
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN users u ON e.organizer_id = u.id
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [eventId]);

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const event = events[0];

        // Visibility rules:
        // - Public (no auth) may only see approved events
        // - Admins may see any event
        // - Organizers may see their own events regardless of status, but not others' non-approved events
        if (event.status !== 'approved') {
            if (!req.user) {
                return res.status(404).json({ success: false, message: 'Event not found' });
            }
            if (req.user.role !== 'admin' && event.organizer_id !== req.user.id) {
                return res.status(404).json({ success: false, message: 'Event not found' });
            }
        }

        // Check if user is registered (if authenticated)
        let isRegistered = false;
        if (req.user) {
            const [registrations] = await req.db.execute(
                'SELECT id FROM event_registrations WHERE event_id = ? AND student_id = ?',
                [eventId, req.user.id]
            );
            isRegistered = registrations.length > 0;
        }

        res.json({
            success: true,
            event: {
                ...event,
                isRegistered
            }
        });

    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event details'
        });
    }
});

// Create new event (organizers and admins only)
router.post('/', authenticateToken, authorizeRoles('organizer', 'admin'), upload.single('banner'), sanitizeEventInput, [
    body('title').trim().isLength({ min: 5, max: 255 }),
    body('description').trim().isLength({ min: 20 }),
    // Accept either ISO (YYYY-MM-DD) or common European format (DD-MM-YYYY) by normalizing first
    body('eventDate').optional().customSanitizer(value => {
        if (!value) return value;
        // If value already looks like ISO (YYYY-MM-DD or with time), return as-is
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value;
        // If value is like DD-MM-YYYY, convert to YYYY-MM-DD
        if (typeof value === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(value)) {
            const [d, m, y] = value.split('-');
            return `${y}-${m}-${d}`;
        }
        return value;
    }).isISO8601().custom(value => {
        // Ensure the date string corresponds to a real calendar date (YYYY-MM-DD)
        if (value instanceof Date) return true;
        const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return true; // let isISO8601 handle format; if no YYYY-MM-DD prefix, skip this check
        const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
        const dt = new Date(y, mo - 1, d);
        return dt && dt.getFullYear() === y && (dt.getMonth() + 1) === mo && dt.getDate() === d;
    }).toDate(),
    body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('venueId').isInt(),
    body('capacity').isInt({ min: 1 }),
    body('registrationDeadline').optional().customSanitizer(value => {
        if (!value) return value;
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
        if (typeof value === 'string' && /^\d{2}-\d{2}-\d{4}T/.test(value)) {
            // handle dd-mm-yyyyTHH:MM (rare)
            const [datePart, timePart] = value.split('T');
            const [d, m, y] = datePart.split('-');
            return `${y}-${m}-${d}T${timePart}`;
        }
        return value;
    }).optional().isISO8601().custom(value => {
        // For datetime-local strings ensure date portion is valid
        if (value instanceof Date) return true;
        const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return true;
        const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
        const dt = new Date(y, mo - 1, d);
        return dt && dt.getFullYear() === y && (dt.getMonth() + 1) === mo && dt.getDate() === d;
    }).toDate()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            try { console.debug('[events][update] validation errors:', errors.array()); } catch (e) {}
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const {
            title,
            description,
            eventDate,
            startTime,
            endTime,
            venueId,
            capacity,
            registrationDeadline
        } = req.body;

        // Check if venue exists and has enough capacity
        const [venues] = await req.db.execute(
            'SELECT capacity FROM venues WHERE id = ? AND is_active = TRUE',
            [venueId]
        );

        if (venues.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid venue selected'
            });
        }

        if (capacity > venues[0].capacity) {
            return res.status(400).json({
                success: false,
                message: `Event capacity cannot exceed venue capacity (${venues[0].capacity})`
            });
        }

        // Check for time conflicts
        const [conflicts] = await req.db.execute(`
            SELECT id, title FROM events 
            WHERE venue_id = ? AND event_date = ? AND status IN ('approved', 'pending')
            AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))
        `, [venueId, eventDate, startTime, startTime, endTime, endTime]);

        if (conflicts.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Time conflict with existing event: ${conflicts[0].title}`
            });
        }

        const bannerImage = req.file ? req.file.filename : null;
        const status = req.user.role === 'admin' ? 'approved' : 'pending';

        const [result] = await req.db.execute(`
            INSERT INTO events (title, description, event_date, start_time, end_time, venue_id, organizer_id, capacity, registration_deadline, banner_image, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [title, description, eventDate, startTime, endTime, venueId, req.user.id, capacity, registrationDeadline, bannerImage, status]);

        // Create notification for admin if organizer created event
        if (req.user.role === 'organizer') {
            await req.db.execute(`
                INSERT INTO notifications (user_id, title, message, type)
                SELECT id, 'New Event Pending Approval', ?, 'info'
                FROM users WHERE role = 'admin'
            `, [`Event "${title}" is waiting for approval`]);
        }

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            eventId: result.insertId,
            status
        });

    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create event'
        });
    }
});

// Update event (organizer who created it or admin)
router.put('/:id', authenticateToken, authorizeRoles('organizer', 'admin'), upload.single('banner'), sanitizeEventInput, async (req, res) => {
    try {
        // Debug: log incoming update body and file to help diagnose client/server mismatches
    try { console.log('[events][update] req.body:', req.body, 'req.file:', req.file); } catch (e) {}

        // CamelCase -> snake_case mapping will be handled by the permissive normalization logic below

        // If any dates were sent as Date objects (some middleware may coerce), convert back to ISO strings
        const dateFields = ['event_date','eventDate','registration_deadline','registrationDeadline'];
        dateFields.forEach(df => {
            if (req.body[df] instanceof Date) {
                try { req.body[df] = req.body[df].toISOString(); } catch (e) {}
            }
        });

        // Perform lightweight permissive normalization/coercion for update fields.
        // This avoids rejecting updates due to client-side naming/format differences.
        let eventId = req.params.id;

        // Map camelCase -> snake_case if present
        const camelToSnake = {
            eventDate: 'event_date',
            startTime: 'start_time',
            endTime: 'end_time',
            venueId: 'venue_id',
            registrationDeadline: 'registration_deadline'
        };
        Object.keys(camelToSnake).forEach(k => {
            if (req.body[k] !== undefined && req.body[camelToSnake[k]] === undefined) {
                req.body[camelToSnake[k]] = req.body[k];
            }
        });

        // Normalize date strings (accept DD-MM-YYYY or YYYY-MM-DD)
        const normalizeDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val.toISOString().split('T')[0];
            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.split('T')[0];
            if (typeof val === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(val)) {
                const [d, m, y] = val.split('-');
                return `${y}-${m}-${d}`;
            }
            return null;
        };

        if (req.body.event_date) {
            const nd = normalizeDate(req.body.event_date);
            if (!nd) return res.status(400).json({ success: false, message: 'Invalid event_date' });
            req.body.event_date = nd;
        }
        if (req.body.registration_deadline) {
            // keep as-is if includes time; if DD-MM-YYYYT... normalize date portion
            if (typeof req.body.registration_deadline === 'string' && /^\d{2}-\d{2}-\d{4}T/.test(req.body.registration_deadline)) {
                const [datePart, timePart] = req.body.registration_deadline.split('T');
                const [d, m, y] = datePart.split('-');
                req.body.registration_deadline = `${y}-${m}-${d}T${timePart}`;
            }
        }

        // Normalize times: accept HH:MM or HH:MM:SS and normalize to HH:MM:SS for DB
        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
        const normalizeTimeToHHMMSS = (t) => {
            if (!t) return null;
            const s = String(t);
            if (!timeRegex.test(s)) return null;
            // If already HH:MM:SS, return as-is; if HH:MM, append :00
            if (/^[0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(s)) return s;
            if (/^[0-9]{2}:[0-9]{2}$/.test(s)) return `${s}:00`;
            return s;
        };

        if (req.body.start_time) {
            const nt = normalizeTimeToHHMMSS(req.body.start_time);
            if (!nt) return res.status(400).json({ success: false, message: 'Invalid start_time' });
            req.body.start_time = nt;
        }
        if (req.body.end_time) {
            const nt2 = normalizeTimeToHHMMSS(req.body.end_time);
            if (!nt2) return res.status(400).json({ success: false, message: 'Invalid end_time' });
            req.body.end_time = nt2;
        }

        // Coerce numeric fields
        if (req.body.venue_id !== undefined) {
            const v = parseInt(req.body.venue_id, 10);
            if (Number.isNaN(v)) return res.status(400).json({ success: false, message: 'Invalid venue_id' });
            req.body.venue_id = v;
        }
        if (req.body.capacity !== undefined) {
            const c = parseInt(req.body.capacity, 10);
            if (Number.isNaN(c) || c < 1) return res.status(400).json({ success: false, message: 'Invalid capacity' });
            req.body.capacity = c;
        }

        // Check if event exists and user has permission
        const [events] = await req.db.execute(
            'SELECT organizer_id, status FROM events WHERE id = ?',
            [eventId]
        );

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const event = events[0];

        // Check permissions
        if (req.user.role === 'organizer' && event.organizer_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own events'
            });
        }

        // Don't allow editing completed or cancelled events
        if (['completed', 'cancelled'].includes(event.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit completed or cancelled events'
            });
        }

        const updateFields = [];
        const updateValues = [];

        // Build dynamic update query
        const allowedFields = ['title', 'description', 'event_date', 'start_time', 'end_time', 'venue_id', 'capacity', 'registration_deadline'];
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(req.body[field]);
            }
        });

        if (req.file) {
            updateFields.push('banner_image = ?');
            updateValues.push(req.file.filename);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        // If organizer is updating, set status back to pending
        if (req.user.role === 'organizer') {
            updateFields.push('status = ?');
            updateValues.push('pending');
        }

        updateValues.push(eventId);

        // Debug: log the final UPDATE query and values (use console.log so it appears in terminal)
        let debugUpdate;
        try {
            debugUpdate = `UPDATE events SET ${updateFields.join(', ')} WHERE id = ?`;
            console.log('[events][update] SQL:', debugUpdate);
            console.log('[events][update] values:', updateValues);
        } catch (e) { console.warn('Failed to build debugUpdate', e); }

        let updateRes;
        try {
            const _res = await req.db.execute(
                `UPDATE events SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
            updateRes = _res[0];
            console.log('[events][update] updateRes:', updateRes);
        } catch (dbErr) {
            console.error('[events][update] DB execute error:', dbErr);
            try { fs.appendFileSync('events-debug.log', `DB ERROR (update) ${new Date().toISOString()}\n${dbErr.stack || dbErr}\n`); } catch (e) {}
            throw dbErr;
        }

        // Fetch the updated event to return to client (join venue/user info)
        const [updatedRows] = await req.db.execute(`
            SELECT e.*, v.name as venue_name, v.location as venue_location, v.capacity as venue_capacity,
                   u.first_name as organizer_first_name, u.last_name as organizer_last_name, u.email as organizer_email
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN users u ON e.organizer_id = u.id
            WHERE e.id = ?
            GROUP BY e.id
        `, [eventId]);

        const updatedEvent = (updatedRows && updatedRows[0]) ? updatedRows[0] : null;
        console.log('[events][update] updatedEvent:', updatedEvent);

        res.json({
            success: true,
            message: 'Event updated successfully',
            event: updatedEvent
        });

    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update event'
        });
    }
});

// Delete event (organizer who created it or admin)
router.delete('/:id', authenticateToken, authorizeRoles('organizer', 'admin'), async (req, res) => {
    try {
        const eventId = req.params.id;

        // Check if event exists and user has permission
        const [events] = await req.db.execute(
            'SELECT organizer_id, status FROM events WHERE id = ?',
            [eventId]
        );

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const event = events[0];

        // Check permissions
        if (req.user.role === 'organizer' && event.organizer_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own events'
            });
        }

        // Check if there are registrations
        const [registrations] = await req.db.execute(
            'SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ?',
            [eventId]
        );

        if (registrations[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete event with existing registrations. Cancel the event instead.'
            });
        }

        await req.db.execute('DELETE FROM events WHERE id = ?', [eventId]);

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });

    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete event'
        });
    }
});

// Get events by organizer
router.get('/organizer/my-events', authenticateToken, authorizeRoles('organizer', 'admin'), async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const pageNum = Number.isFinite(Number(page)) ? parseInt(page, 10) : 1;
        const limitNum = Number.isFinite(Number(limit)) ? parseInt(limit, 10) : 10;
        const offset = Math.max(0, (pageNum - 1) * limitNum);

        let query = `
            SELECT e.*, v.name as venue_name, v.location as venue_location,
                   COUNT(er.id) as registered_count
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.organizer_id = ?
        `;
        
        const queryParams = [req.user.id];

        if (status) {
            query += ` AND e.status = ?`;
            queryParams.push(status);
        }

        query += ` GROUP BY e.id ORDER BY e.event_date DESC LIMIT ${limitNum} OFFSET ${offset}`;

        const [events] = await req.db.execute(query, queryParams);

        res.json({
            success: true,
            events
        });

    } catch (error) {
        console.error('Get organizer events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events'
        });
    }
});

module.exports = router;

