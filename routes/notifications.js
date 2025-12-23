const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        let query = `
            SELECT id, title, message, type, is_read, created_at
            FROM notifications
            WHERE user_id = ?
        `;

        const queryParams = [userId];

        if (unreadOnly === 'true') {
            query += ` AND is_read = FALSE`;
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const [notifications] = await req.db.execute(query, queryParams);

        // Get unread count
        const [unreadCount] = await req.db.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        res.json({
            success: true,
            notifications,
            unreadCount: unreadCount[0].count
        });

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        const [result] = await req.db.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read'
        });
    }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        await req.db.execute(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read'
        });
    }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        const [result] = await req.db.execute(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });

    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification'
        });
    }
});

// Delete all notifications
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        await req.db.execute(
            'DELETE FROM notifications WHERE user_id = ?',
            [userId]
        );

        res.json({
            success: true,
            message: 'All notifications deleted successfully'
        });

    } catch (error) {
        console.error('Delete all notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete all notifications'
        });
    }
});

module.exports = router;

