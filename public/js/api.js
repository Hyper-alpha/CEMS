// API Utility Class
class API {
    constructor() {
        this.baseURL = window.location.origin;
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options,
        };

        try {
            const response = await fetch(url, config);
            // Try to parse JSON, but fall back gracefully
            let dataText = null;
            try {
                dataText = await response.text();
            } catch (e) {
                // ignore
            }

            let data = null;
            try {
                data = dataText ? JSON.parse(dataText) : null;
            } catch (e) {
                data = { message: dataText };
            }

            if (!response.ok) {
                const err = new Error(data?.message || `Request failed with status ${response.status}`);
                err.status = response.status;
                err.response = data;
                throw err;
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async register(userData) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async getProfile() {
        return this.request('/api/auth/profile');
    }

    async updateProfile(profileData) {
        return this.request('/api/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData),
        });
    }

    async changePassword(currentPassword, newPassword) {
        return this.request('/api/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    }

    // Events endpoints
    async getEvents(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/api/events${queryString ? `?${queryString}` : ''}`);
    }

    async getEvent(eventId) {
        return this.request(`/api/events/${eventId}`);
    }

    // Admin: fetch single event regardless of status
    async getAdminEvent(eventId) {
        return this.request(`/api/admin/events/${eventId}`);
    }

    async createEvent(eventData) {
        return this.request('/api/events', {
            method: 'POST',
            body: JSON.stringify(eventData),
        });
    }

    async updateEvent(eventId, eventData) {
        return this.request(`/api/events/${eventId}`, {
            method: 'PUT',
            body: JSON.stringify(eventData),
        });
    }

    async deleteEvent(eventId) {
        return this.request(`/api/events/${eventId}`, {
            method: 'DELETE',
        });
    }

    async getMyEvents(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/api/events/organizer/my-events${queryString ? `?${queryString}` : ''}`);
    }

    // Registration endpoints
    async registerForEvent(eventId) {
        return this.request(`/api/registrations/${eventId}`, {
            method: 'POST',
        });
    }

    async unregisterFromEvent(eventId) {
        return this.request(`/api/registrations/${eventId}`, {
            method: 'DELETE',
        });
    }

    async getRegistrationPass(eventId) {
        return this.request(`/api/registrations/${eventId}/pass`);
    }

    async getMyRegistrations(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/api/registrations/my-registrations${queryString ? `?${queryString}` : ''}`);
    }

    async getEventRegistrations(eventId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/api/registrations/event/${eventId}${queryString ? `?${queryString}` : ''}`);
    }

    async markAttendance(registrationId, status) {
        return this.request(`/api/registrations/${registrationId}/attendance`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
    }

    async submitFeedback(eventId, rating, feedback) {
        return this.request(`/api/registrations/${eventId}/feedback`, {
            method: 'POST',
            body: JSON.stringify({ rating, feedback }),
        });
    }

    // Venues endpoints
    async getVenues() {
        return this.request('/api/venues');
    }

    async getVenue(venueId) {
        return this.request(`/api/venues/${venueId}`);
    }

    async createVenue(venueData) {
        return this.request('/api/venues', {
            method: 'POST',
            body: JSON.stringify(venueData),
        });
    }

    async updateVenue(venueId, venueData) {
        return this.request(`/api/venues/${venueId}`, {
            method: 'PUT',
            body: JSON.stringify(venueData),
        });
    }

    async deleteVenue(venueId) {
        return this.request(`/api/venues/${venueId}`, {
            method: 'DELETE',
        });
    }

    async getVenueAvailability(venueId, date) {
        return this.request(`/api/venues/${venueId}/availability?date=${date}`);
    }

    // Users endpoints
    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/api/users${queryString ? `?${queryString}` : ''}`);
    }

    async getUser(userId) {
        return this.request(`/api/users/${userId}`);
    }

    async updateUser(userId, userData) {
        return this.request(`/api/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        });
    }

    async deleteUser(userId) {
        return this.request(`/api/users/${userId}`, {
            method: 'DELETE',
        });
    }

    async getUserStats(userId) {
        return this.request(`/api/users/${userId}/stats`);
    }

    async changeUserRole(userId, role) {
        return this.request(`/api/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role }),
        });
    }

    // Notifications endpoints
    async getNotifications(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/api/notifications${queryString ? `?${queryString}` : ''}`);
    }

    async markNotificationRead(notificationId) {
        return this.request(`/api/notifications/${notificationId}/read`, {
            method: 'PUT',
        });
    }

    async markAllNotificationsRead() {
        return this.request('/api/notifications/mark-all-read', {
            method: 'PUT',
        });
    }

    async deleteNotification(notificationId) {
        return this.request(`/api/notifications/${notificationId}`, {
            method: 'DELETE',
        });
    }

    async deleteAllNotifications() {
        return this.request('/api/notifications', {
            method: 'DELETE',
        });
    }

    // Admin endpoints
    async getDashboardStats() {
        return this.request('/api/admin/dashboard-stats');
    }

    async updateEventStatus(eventId, status, adminNotes) {
        return this.request(`/api/admin/events/${eventId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, adminNotes }),
        });
    }

    async getAdminEvents(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/api/admin/events${queryString ? `?${queryString}` : ''}`);
    }

    async cancelEvent(eventId, reason) {
        return this.request(`/api/admin/events/${eventId}/cancel`, {
            method: 'PUT',
            body: JSON.stringify({ reason }),
        });
    }

    async getAnalytics(period = '30') {
        return this.request(`/api/admin/analytics?period=${period}`);
    }

    async getSettings() {
        return this.request('/api/admin/settings');
    }

    async updateSettings(settings) {
        return this.request('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({ settings }),
        });
    }

    async sendAnnouncement(title, message, targetRole = 'all') {
        return this.request('/api/admin/announcements', {
            method: 'POST',
            body: JSON.stringify({ title, message, targetRole }),
        });
    }
}

// Create global API instance
window.api = new API();


