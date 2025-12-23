// Student Dashboard JavaScript
class StudentDashboard extends DashboardManager {
    constructor() {
        super();
        this.events = [];
        this.registrations = [];
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreEvents = true;
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.currentEventId = null;
    }

    setupEventListeners() {
        super.setupEventListeners();
        this.setupStudentSpecificListeners();
    }

    setupStudentSpecificListeners() {
        // Event search
        const searchInput = document.getElementById('event-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchTerm = e.target.value;
                    this.resetAndLoadEvents();
                }, 300);
            });
        }

        // Event filters
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.resetAndLoadEvents();
            });
        });

        // Registration tabs
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const tab = e.target.dataset.tab;
                this.showRegistrationTab(tab);
            });
        });

        // Event card clicks
        document.addEventListener('click', (e) => {
            const eventCard = e.target.closest('.event-card');
            if (eventCard) {
                const eventId = eventCard.dataset.eventId;
                this.showEventModal(eventId);
            }
        });

        // Registration actions
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('unregister-btn')) {
                const eventId = e.target.dataset.eventId;
                this.unregisterFromEvent(eventId);
            } else if (e.target.classList.contains('feedback-btn')) {
                const eventId = e.target.dataset.eventId;
                this.showFeedbackModal(eventId);
            } else if (e.target.classList.contains('qr-ticket-btn')) {
                const eventId = e.target.dataset.eventId;
                this.showQRTicket(eventId);
            } else if (e.target.classList.contains('show-pass-btn')) {
                const eventId = e.target.dataset.eventId;
                this.handleShowPass(eventId);
            } else if (e.target.classList.contains('download-pass-btn')) {
                const eventId = e.target.dataset.eventId;
                this.handleDownloadPass(eventId);
            }
        });

        // Modal actions — use closest() so clicks on inner elements (icons/text) still count
        document.addEventListener('click', (e) => {
            const registerBtn = e.target.closest && e.target.closest('#register-btn');
            const unregisterBtn = e.target.closest && e.target.closest('#unregister-btn');

            if (registerBtn) {
                this.registerForEvent();
            }

            if (unregisterBtn) {
                this.unregisterFromEvent(this.currentEventId);
            }
        });

        // Feedback form
        const feedbackForm = document.getElementById('feedback-form');
        if (feedbackForm) {
            feedbackForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitFeedback(e);
            });
        }
    }

    async loadEvents() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading('events-grid');

        try {
            const params = {
                page: this.currentPage,
                limit: 6,
                status: 'approved'
            };

            if (this.searchTerm) {
                params.search = this.searchTerm;
            }

            const response = await api.getEvents(params);
            const newEvents = response.events || [];

            // Apply date filter
            const filteredEvents = this.applyDateFilter(newEvents);

            if (this.currentPage === 1) {
                this.events = filteredEvents;
            } else {
                this.events = [...this.events, ...filteredEvents];
            }

            this.hasMoreEvents = response.pagination?.hasNext || false;
            this.renderEvents();
            this.updateLoadMoreButton();

        } catch (error) {
            console.error('Failed to load events:', error);
            this.showError('Failed to load events. Please try again.');
        } finally {
            this.isLoading = false;
            this.hideLoading('events-grid');
        }
    }

    applyDateFilter(events) {
        if (this.currentFilter === 'all') {
            return events;
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return events.filter(event => {
            const eventDate = new Date(event.event_date);
            
            switch (this.currentFilter) {
                case 'upcoming':
                    return eventDate >= today;
                
                case 'this-week':
                    const weekFromNow = new Date(today);
                    weekFromNow.setDate(today.getDate() + 7);
                    return eventDate >= today && eventDate <= weekFromNow;
                
                default:
                    return true;
            }
        });
    }

    resetAndLoadEvents() {
        this.currentPage = 1;
        this.events = [];
        this.hasMoreEvents = true;
        this.loadEvents();
    }

    renderEvents() {
        const eventsGrid = document.getElementById('events-grid');
        if (!eventsGrid) return;

        if (this.events.length === 0) {
            eventsGrid.innerHTML = `
                <div class="no-events">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No events found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }

        const eventsHTML = this.events.map(event => this.createEventCard(event)).join('');
        eventsGrid.innerHTML = eventsHTML;
    }

    createEventCard(event) {
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const startTime = new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const capacityText = `${event.registered_count || 0}/${event.capacity}`;
        const isFull = (event.registered_count || 0) >= event.capacity;

        return `
            <div class="event-card" data-event-id="${event.id}">
                <div class="event-image">
                    ${event.banner_image ? 
                        `<img src="/uploads/events/${event.banner_image}" alt="${event.title}">` :
                        `<i class="fas fa-calendar-alt"></i>`
                    }
                </div>
                <div class="event-content">
                    <h3 class="event-title">${event.title}</h3>
                    <p class="event-description">${event.description}</p>
                    <div class="event-meta">
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formattedDate}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-clock"></i>
                            <span>${startTime}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${event.venue_name || 'TBA'}</span>
                        </div>
                    </div>
                    <div class="event-footer">
                        <span class="event-date">${formattedDate}</span>
                        <span class="event-capacity ${isFull ? 'full' : ''}">${capacityText}</span>
                    </div>
                </div>
            </div>
        `;
    }

    async showEventModal(eventId) {
        try {
            const response = await api.getEvent(eventId);
            const event = response.event;

            if (!event) {
                throw new Error('Event not found');
            }

            this.populateEventModal(event);
            this.showModal('event-modal');

        } catch (error) {
            console.error('Failed to load event details:', error);
            this.showError('Failed to load event details.');
        }
    }

    populateEventModal(event) {
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const startTime = new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const endTime = new Date(`2000-01-01T${event.end_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Update modal content
        document.getElementById('modal-event-title').textContent = event.title;
        document.getElementById('modal-event-date').textContent = formattedDate;
        document.getElementById('modal-event-time').textContent = `${startTime} - ${endTime}`;
        document.getElementById('modal-event-venue').textContent = event.venue_name || 'TBA';
        document.getElementById('modal-event-organizer').textContent = 
            `${event.organizer_first_name} ${event.organizer_last_name}`;
        document.getElementById('modal-event-description').textContent = event.description;

        // Update event image
        const eventImage = document.getElementById('modal-event-image');
        if (event.banner_image) {
            eventImage.src = `/uploads/events/${event.banner_image}`;
            eventImage.style.display = 'block';
        } else {
            eventImage.style.display = 'none';
        }

        // Update registration buttons
        const registerBtn = document.getElementById('register-btn');
        const unregisterBtn = document.getElementById('unregister-btn');
        
        if (event.isRegistered) {
            registerBtn.style.display = 'none';
            unregisterBtn.style.display = 'inline-flex';
        } else {
            registerBtn.style.display = 'inline-flex';
            unregisterBtn.style.display = 'none';
        }

        // Store current event ID for registration actions
        this.currentEventId = event.id;
    }

    async registerForEvent() {
        if (!this.currentEventId) return;

        try {
            const response = await api.registerForEvent(this.currentEventId);
            // If API returns registrationPass, show it in the modal
            if (response && response.registrationPass) {
                this.renderRegistrationPass(response.registrationPass);
                this.hideModal('event-modal');
                this.showModal('registration-pass-modal');
            } else {
                this.showSuccess('Successfully registered for the event!');
                this.hideModal('event-modal');
            }

            // Refresh lists
            this.resetAndLoadEvents();
            this.loadRegistrations();
        } catch (error) {
            console.error('Registration failed:', error);
            this.showError(error.message || 'Failed to register for event.');
        }
    }

    renderRegistrationPass(pass) {
        try {
            document.getElementById('pass-event-title').textContent = pass.event.title || '';
            const dt = new Date(pass.event.event_date);
            const start = pass.event.start_time ? new Date(`2000-01-01T${pass.event.start_time}`) : null;
            const end = pass.event.end_time ? new Date(`2000-01-01T${pass.event.end_time}`) : null;
            const timeText = start && end ? `${start.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}` : '';
            document.getElementById('pass-event-datetime').textContent = `${dt.toLocaleDateString()} ${timeText}`;
            document.getElementById('pass-venue').textContent = pass.event.venue_name || '';

            document.getElementById('pass-user-name').textContent = `${pass.user.first_name || ''} ${pass.user.last_name || ''}`;
            document.getElementById('pass-user-email').textContent = pass.user.email || '';
            document.getElementById('pass-user-studentid').textContent = pass.user.student_id ? `Student ID: ${pass.user.student_id}` : '';

            const qrImg = document.getElementById('pass-qr-image');
            if (pass.qrImage) {
                qrImg.src = pass.qrImage;
                qrImg.style.display = 'block';
            } else {
                qrImg.style.display = 'none';
            }

            const printBtn = document.getElementById('print-pass-btn');
            if (printBtn) {
                printBtn.onclick = () => {
                    // Open a new window with only the pass content for a clean print
                    const passCard = document.getElementById('pass-card');
                    const w = window.open('', '_blank');
                    if (!w) return;
                    w.document.write(`<!doctype html><html><head><title>Registration Pass</title><link rel="stylesheet" href="/css/style.css"></head><body>${passCard.innerHTML}</body></html>`);
                    w.document.close();
                    // Delay to allow rendering
                    setTimeout(() => {
                        w.print();
                        w.close();
                    }, 300);
                };
            }

        } catch (err) {
            console.error('Failed to render registration pass:', err);
        }
    }

    // Simple modal helpers (fall back if base DashboardManager doesn't provide these)
    showModal(id) {
        const m = document.getElementById(id);
        if (m) m.style.display = 'flex';
    }

    hideModal(id) {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    }

    async unregisterFromEvent(eventId) {
        if (!eventId) eventId = this.currentEventId;
        if (!eventId) return;

        try {
            await api.unregisterFromEvent(eventId);
            this.showSuccess('Successfully unregistered from the event.');
            this.hideModal('event-modal');
            this.resetAndLoadEvents();
            this.loadRegistrations();
        } catch (error) {
            console.error('Unregistration failed:', error);
            this.showError(error.message || 'Failed to unregister from event.');
        }
    }

    async loadRegistrations() {
        try {
            const response = await api.getMyRegistrations({ limit: 100 });
            this.registrations = response.registrations || [];
            this.renderRegistrations();
        } catch (error) {
            console.error('Failed to load registrations:', error);
            this.showError('Failed to load registrations.');
        }
    }

    renderRegistrations() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const upcoming = this.registrations.filter(reg => new Date(reg.event_date) >= today);
        const past = this.registrations.filter(reg => new Date(reg.event_date) < today);

        this.renderRegistrationList('upcoming-registrations', upcoming);
        this.renderRegistrationList('past-registrations', past);
        this.renderRegistrationList('all-registrations', this.registrations);
    }

    renderRegistrationList(containerId, registrations) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (registrations.length === 0) {
            container.innerHTML = `
                <div class="no-registrations">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No registrations found</h3>
                    <p>Register for events to see them here</p>
                </div>
            `;
            return;
        }

        const registrationsHTML = registrations.map(registration => 
            this.createRegistrationCard(registration)
        ).join('');

        container.innerHTML = registrationsHTML;
    }

    createRegistrationCard(registration) {
        const eventDate = new Date(registration.event_date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const startTime = new Date(`2000-01-01T${registration.start_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Determine if event has already started by combining date and start_time
        let eventDateTime;
        try {
            eventDateTime = new Date(`${registration.event_date} ${registration.start_time}`);
            if (isNaN(eventDateTime.getTime())) {
                // fallback to date-only check
                eventDateTime = new Date(registration.event_date);
            }
        } catch (e) {
            eventDateTime = new Date(registration.event_date);
        }

        const now = new Date();
        const isPast = eventDateTime < now;
        const canGiveFeedback = isPast && registration.status === 'attended' && !registration.feedback_rating;

        return `
            <div class="registration-card">
                <div class="registration-header">
                    <div>
                        <h3 class="registration-title">${registration.title}</h3>
                        <span class="registration-status ${registration.status}">${registration.status}</span>
                    </div>
                </div>
                <div class="registration-meta">
                    <div class="registration-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="registration-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${startTime}</span>
                    </div>
                    <div class="registration-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${registration.venue_name || 'TBA'}</span>
                    </div>
                    <div class="registration-meta-item">
                        <i class="fas fa-user"></i>
                        <span>${registration.organizer_first_name} ${registration.organizer_last_name}</span>
                    </div>
                </div>
                <div class="registration-actions">
                    ${!isPast ? `
                        <button class="btn btn-outline unregister-btn" data-event-id="${registration.event_id}">
                            Unregister
                        </button>
                    ` : ''}
                    ${canGiveFeedback ? `
                        <button class="btn btn-primary feedback-btn" data-event-id="${registration.event_id}">
                            Give Feedback
                        </button>
                    ` : ''}
                    ${registration.status === 'attended' ? `
                        <button class="btn btn-outline qr-ticket-btn" data-event-id="${registration.event_id}">
                            View QR Ticket
                        </button>
                    ` : ''}
                    ${registration.status !== 'cancelled' ? `
                        <button class="btn btn-outline show-pass-btn" data-event-id="${registration.event_id}">Show Pass</button>
                        <button class="btn btn-primary download-pass-btn" data-event-id="${registration.event_id}">Download Pass</button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    showRegistrationTab(tab) {
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        const targetTab = document.getElementById(`${tab}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
    }

    showFeedbackModal(eventId) {
        this.currentEventId = eventId;
        this.showModal('feedback-modal');
    }

    async submitFeedback(e) {
        const formData = new FormData(e.target);
        const rating = formData.get('rating');
        const feedback = formData.get('feedback') || document.getElementById('feedback-text')?.value;

        if (!rating) {
            this.showError('Please select a rating.');
            return;
        }

        try {
            await api.submitFeedback(this.currentEventId, parseInt(rating), feedback);
            this.showSuccess('Feedback submitted successfully!');
            this.hideModal('feedback-modal');
            this.loadRegistrations();
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            this.showError(error.message || 'Failed to submit feedback.');
        }
    }

    showQRTicket(eventId) {
        // This would show the QR ticket for the event
        this.showSuccess('QR ticket feature coming soon!');
    }

    async handleShowPass(eventId) {
        try {
            const res = await api.getRegistrationPass(eventId);
            if (res && res.registrationPass) {
                this.renderRegistrationPass(res.registrationPass);
                this.showModal('registration-pass-modal');
            } else {
                this.showError('Pass not available');
            }
        } catch (err) {
            console.error('Failed to fetch pass:', err);
            this.showError(err?.message || 'Failed to fetch pass');
        }
    }

    async handleDownloadPass(eventId) {
        try {
            const res = await api.getRegistrationPass(eventId);
            if (res && res.registrationPass && res.registrationPass.pdfFileUrl) {
                window.open(res.registrationPass.pdfFileUrl, '_blank');
            } else {
                this.showError('PDF pass not available for download');
            }
        } catch (err) {
            console.error('Failed to download pass:', err);
            this.showError(err?.message || 'Failed to download pass');
        }
    }

    async loadCertificates() {
        // This would load certificates from the API
        const certificatesGrid = document.getElementById('certificates-grid');
        if (certificatesGrid) {
            certificatesGrid.innerHTML = `
                <div class="no-certificates">
                    <i class="fas fa-certificate"></i>
                    <h3>No Certificates Yet</h3>
                    <p>Complete events to earn certificates</p>
                </div>
            `;
        }
    }

    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container && this.currentPage === 1) {
            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading...</p>
                </div>
            `;
        }
    }

    hideLoading(containerId) {
        // Loading is handled by render methods
    }

    updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            if (this.hasMoreEvents) {
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.disabled = this.isLoading;
                loadMoreBtn.textContent = this.isLoading ? 'Loading...' : 'Load More Events';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    }
}

// Initialize student dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Override the base dashboard manager with student-specific functionality
    if (window.dashboardManager) {
        window.dashboardManager = new StudentDashboard();
    }
});


