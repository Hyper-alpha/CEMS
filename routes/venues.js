const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all venues (public)
router.get('/', async (req, res) => {
    try {
        const [venues] = await req.db.execute(
            'SELECT * FROM venues WHERE is_active = TRUE ORDER BY name'
        );

        res.json({
            success: true,
            venues
        });

    } catch (error) {
        console.error('Get venues error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch venues'
        });
    }
});

// Get single venue
router.get('/:id', async (req, res) => {
    try {
        const venueId = req.params.id;

        const [venues] = await req.db.execute(
            'SELECT * FROM venues WHERE id = ? AND is_active = TRUE',
            [venueId]
        );

        if (venues.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venue not found'
            });
        }

        res.json({
            success: true,
            venue: venues[0]
        });

    } catch (error) {
        console.error('Get venue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch venue'
        });
    }
});

// Create venue (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), [
    body('name').trim().isLength({ min: 2, max: 255 }),
    body('location').trim().isLength({ min: 5, max: 255 }),
    body('capacity').isInt({ min: 1 }),
    body('facilities').optional().trim()
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

        const { name, location, capacity, facilities } = req.body;

        // Check if venue with same name already exists
        const [existingVenues] = await req.db.execute(
            'SELECT id FROM venues WHERE name = ? AND is_active = TRUE',
            [name]
        );

        if (existingVenues.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Venue with this name already exists'
            });
        }

        const [result] = await req.db.execute(
            'INSERT INTO venues (name, location, capacity, facilities) VALUES (?, ?, ?, ?)',
            [name, location, capacity, facilities || null]
        );

        res.status(201).json({
            success: true,
            message: 'Venue created successfully',
            venueId: result.insertId
        });

    } catch (error) {
        console.error('Create venue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create venue'
        });
    }
});

// Update venue (admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin'), [
    body('name').optional().trim().isLength({ min: 2, max: 255 }),
    body('location').optional().trim().isLength({ min: 5, max: 255 }),
    body('capacity').optional().isInt({ min: 1 }),
    body('facilities').optional().trim(),
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

        const venueId = req.params.id;
        const { name, location, capacity, facilities, isActive } = req.body;

        // Check if venue exists
        const [venues] = await req.db.execute(
            'SELECT id FROM venues WHERE id = ?',
            [venueId]
        );

        if (venues.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venue not found'
            });
        }

        const updateFields = [];
        const updateValues = [];

        if (name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(name);
        }
        if (location !== undefined) {
            updateFields.push('location = ?');
            updateValues.push(location);
        }
        if (capacity !== undefined) {
            updateFields.push('capacity = ?');
            updateValues.push(capacity);
        }
        if (facilities !== undefined) {
            updateFields.push('facilities = ?');
            updateValues.push(facilities);
        }
        if (isActive !== undefined) {
            updateFields.push('is_active = ?');
            updateValues.push(isActive);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateValues.push(venueId);

        await req.db.execute(
            `UPDATE venues SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        res.json({
            success: true,
            message: 'Venue updated successfully'
        });

    } catch (error) {
        console.error('Update venue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update venue'
        });
    }
});

// Delete venue (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const venueId = req.params.id;

        // Check if venue exists
        const [venues] = await req.db.execute(
            'SELECT id FROM venues WHERE id = ?',
            [venueId]
        );

        if (venues.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venue not found'
            });
        }

        // Check if venue is being used in any events
        const [events] = await req.db.execute(
            'SELECT COUNT(*) as count FROM events WHERE venue_id = ? AND status IN ("approved", "pending")',
            [venueId]
        );

        if (events[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete venue that is being used in active events'
            });
        }

        await req.db.execute('DELETE FROM venues WHERE id = ?', [venueId]);

        res.json({
            success: true,
            message: 'Venue deleted successfully'
        });

    } catch (error) {
        console.error('Delete venue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete venue'
        });
    }
});

// Get venue availability for a date
router.get('/:id/availability', async (req, res) => {
    try {
        const venueId = req.params.id;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required'
            });
        }

        // Get venue details
        const [venues] = await req.db.execute(
            'SELECT * FROM venues WHERE id = ? AND is_active = TRUE',
            [venueId]
        );

        if (venues.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venue not found'
            });
        }

        // Get events on that date
        const [events] = await req.db.execute(`
            SELECT title, start_time, end_time, status
            FROM events 
            WHERE venue_id = ? AND event_date = ? AND status IN ('approved', 'pending')
            ORDER BY start_time
        `, [venueId, date]);

        res.json({
            success: true,
            venue: venues[0],
            date,
            events
        });

    } catch (error) {
        console.error('Get venue availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch venue availability'
        });
    }
});

module.exports = router;

