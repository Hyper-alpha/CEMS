const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
    const { role = '', search = '' } = req.query;
        // Validate and coerce pagination params to integers to avoid passing strings to prepared statements
        const page = Number.isFinite(Number(req.query.page)) ? Math.max(1, parseInt(req.query.page, 10)) : 1;
        const limit = Number.isFinite(Number(req.query.limit)) ? Math.max(1, parseInt(req.query.limit, 10)) : 20;
        const offset = Math.max(0, (page - 1) * limit);

    // Sorting - allow only a fixed set of sortable columns to avoid SQL injection
    const allowedSortColumns = new Set(['first_name', 'last_name', 'email', 'role', 'department', 'created_at']);
    let sortBy = req.query.sort_by || 'created_at';
    let sortDir = (req.query.sort_dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    if (!allowedSortColumns.has(sortBy)) sortBy = 'created_at';

    // Column filters (server-side) - optional
    const emailFilter = req.query.email || '';
    const departmentFilter = req.query.department || '';
    const studentIdFilter = req.query.student_id || '';

        let query = `
            SELECT id, email, first_name, last_name, role, student_id, department, phone, is_active, created_at
            FROM users
            WHERE 1=1
        `;
        
        const queryParams = [];

        // Always exclude admin users from the results to avoid returning admin rows to the listing
        query += ` AND role != 'admin'`;

        if (role) {
            // If a role filter is provided (student/organizer), apply it. We still prevent 'admin' from being returned.
            query += ` AND role = ?`;
            queryParams.push(role);
        }

        // Column-level filters
        if (emailFilter) {
            query += ` AND email LIKE ?`;
            queryParams.push(`%${emailFilter}%`);
        }
        if (departmentFilter) {
            query += ` AND department LIKE ?`;
            queryParams.push(`%${departmentFilter}%`);
        }
        if (studentIdFilter) {
            query += ` AND student_id LIKE ?`;
            queryParams.push(`%${studentIdFilter}%`);
        }

        if (search) {
            query += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR student_id LIKE ?)`;
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

    // Inject numeric LIMIT/OFFSET directly after validation to avoid prepared-statement issues
    // Use validated sortBy and sortDir for ordering (sortBy is from an allow-list)
    query += ` ORDER BY ${sortBy} ${sortDir} LIMIT ${limit} OFFSET ${offset}`;

    const [users] = await req.db.execute(query, queryParams);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM users WHERE 1=1`;
        const countParams = [];

        // Apply same admin exclusion for total count
        countQuery += ` AND role != 'admin'`;

        if (role) {
            countQuery += ` AND role = ?`;
            countParams.push(role);
        }

        // Apply same column filters
        if (emailFilter) {
            countQuery += ` AND email LIKE ?`;
            countParams.push(`%${emailFilter}%`);
        }
        if (departmentFilter) {
            countQuery += ` AND department LIKE ?`;
            countParams.push(`%${departmentFilter}%`);
        }
        if (studentIdFilter) {
            countQuery += ` AND student_id LIKE ?`;
            countParams.push(`%${studentIdFilter}%`);
        }

        if (search) {
            countQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR student_id LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const [countResult] = await req.db.execute(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;

        // Check permissions
        if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const [users] = await req.db.execute(
            'SELECT id, email, first_name, last_name, role, student_id, department, phone, profile_image, is_active, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: users[0]
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});

// Update user (admin only or self)
router.put('/:id', authenticateToken, [
    body('firstName').optional().trim().isLength({ min: 2 }),
    body('lastName').optional().trim().isLength({ min: 2 }),
    body('phone').optional().isMobilePhone(),
    body('department').optional().trim(),
    body('isActive').optional().isBoolean()
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

        const userId = req.params.id;

        // Check permissions
        if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check if user exists
        const [users] = await req.db.execute(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { firstName, lastName, phone, department, isActive } = req.body;
        const updateFields = [];
        const updateValues = [];

        if (firstName) {
            updateFields.push('first_name = ?');
            updateValues.push(firstName);
        }
        if (lastName) {
            updateFields.push('last_name = ?');
            updateValues.push(lastName);
        }
        if (phone) {
            updateFields.push('phone = ?');
            updateValues.push(phone);
        }
        if (department) {
            updateFields.push('department = ?');
            updateValues.push(department);
        }
        if (isActive !== undefined && req.user.role === 'admin') {
            updateFields.push('is_active = ?');
            updateValues.push(isActive);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateValues.push(userId);

        await req.db.execute(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        res.json({
            success: true,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user'
        });
    }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (req.user.id === parseInt(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        // Check if user exists
        const [users] = await req.db.execute(
            'SELECT id, role FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has any events or registrations
        const [events] = await req.db.execute(
            'SELECT COUNT(*) as count FROM events WHERE organizer_id = ?',
            [userId]
        );

        const [registrations] = await req.db.execute(
            'SELECT COUNT(*) as count FROM event_registrations WHERE student_id = ?',
            [userId]
        );

        if (events[0].count > 0 || registrations[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete user with existing events or registrations. Deactivate instead.'
            });
        }

        await req.db.execute('DELETE FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user'
        });
    }
});

// Get user statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;

        // Check permissions
        if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const [user] = await req.db.execute(
            'SELECT role FROM users WHERE id = ?',
            [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userRole = user[0].role;
        let stats = {};

        if (userRole === 'student') {
            // Student statistics
            const [registrations] = await req.db.execute(`
                SELECT 
                    COUNT(*) as total_registrations,
                    SUM(CASE WHEN er.status = 'attended' THEN 1 ELSE 0 END) as attended_events,
                    SUM(CASE WHEN e.event_date < CURDATE() THEN 1 ELSE 0 END) as past_events,
                    SUM(CASE WHEN e.event_date >= CURDATE() THEN 1 ELSE 0 END) as upcoming_events
                FROM event_registrations er
                JOIN events e ON er.event_id = e.id
                WHERE er.student_id = ?
            `, [userId]);

            const [feedback] = await req.db.execute(
                'SELECT AVG(feedback_rating) as avg_rating FROM event_registrations WHERE student_id = ? AND feedback_rating IS NOT NULL',
                [userId]
            );

            stats = {
                ...registrations[0],
                average_rating: feedback[0].avg_rating || 0
            };

        } else if (userRole === 'organizer') {
            // Organizer statistics
            const [events] = await req.db.execute(`
                SELECT 
                    COUNT(*) as total_events,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_events,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_events,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_events
                FROM events 
                WHERE organizer_id = ?
            `, [userId]);

            const [participants] = await req.db.execute(`
                SELECT COUNT(DISTINCT er.student_id) as total_participants
                FROM events e
                JOIN event_registrations er ON e.id = er.event_id
                WHERE e.organizer_id = ?
            `, [userId]);

            const [feedback] = await req.db.execute(`
                SELECT AVG(er.feedback_rating) as avg_rating
                FROM events e
                JOIN event_registrations er ON e.id = er.event_id
                WHERE e.organizer_id = ? AND er.feedback_rating IS NOT NULL
            `, [userId]);

            stats = {
                ...events[0],
                ...participants[0],
                average_rating: feedback[0].avg_rating || 0
            };
        }

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user statistics'
        });
    }
});

// Change user role (admin only)
router.put('/:id/role', authenticateToken, authorizeRoles('admin'), [
    body('role').isIn(['student', 'organizer', 'admin'])
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

        const userId = req.params.id;
        const { role } = req.body;

        // Prevent admin from changing their own role
        if (req.user.id === parseInt(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role'
            });
        }

        // Check if user exists
        const [users] = await req.db.execute(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await req.db.execute(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, userId]
        );

        res.json({
            success: true,
            message: 'User role updated successfully'
        });

    } catch (error) {
        console.error('Change user role error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change user role'
        });
    }
});

module.exports = router;

