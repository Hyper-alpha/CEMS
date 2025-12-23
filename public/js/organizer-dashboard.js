// Organizer Dashboard JavaScript
class OrganizerDashboard extends DashboardManager {
    constructor() {
        super();
        this.events = [];
        this.venues = [];
        this.currentEventId = null;
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreEvents = true;
        this.currentFilter = 'all';
        this.searchTerm = '';
    }

    setupEventListeners() {
        super.setupEventListeners();
        this.setupOrganizerSpecificListeners();
    }

    setupOrganizerSpecificListeners() {
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

        // Create event form
        const createEventForm = document.getElementById('create-event-form');
        if (createEventForm) {
            createEventForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createEvent(e);
            });
        }

        // Event card clicks
        document.addEventListener('click', (e) => {
            const eventCard = e.target.closest('.event-card');
            if (eventCard) {
                const eventId = eventCard.dataset.eventId;
                this.showEventDetails(eventId);
            }
        });

        // Edit event button (delegated)
        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest && e.target.closest('.edit-event-btn');
            if (editBtn) {
                e.preventDefault();
                const id = editBtn.dataset.eventId;
                if (id) this.openEditEvent(id);
            }
        });

        // Event details modal tabs
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                const tab = e.target.dataset.tab;
                this.showEventDetailsTab(tab);
            }
        });

        // Venue capacity update
        const venueSelect = document.getElementById('event-venue');
        if (venueSelect) {
            venueSelect.addEventListener('change', (e) => {
                this.updateCapacityLimit(e.target.value);
            });
        }

        // Show participants modal (delegated)
        document.addEventListener('click', (e) => {
            const action = e.target.closest && e.target.closest('[data-action]');
            if (action && action.dataset.action === 'showParticipantsModal') {
                e.preventDefault();
                this.showParticipantsModal();
            }
        });
    }

    async loadDashboardStats() {
        try {
            const response = await api.getUserStats(this.currentUser.id);
            const stats = response.stats;

            this.updateStatDisplay('total-events', stats.total_events || 0);
            this.updateStatDisplay('approved-events', stats.approved_events || 0);
            this.updateStatDisplay('total-participants', stats.total_participants || 0);
            this.updateStatDisplay('average-rating', (stats.average_rating || 0).toFixed(1));
            // Load participants preview for organizer (non-blocking)
            this.loadParticipantsPreview().catch(err => console.debug('participants preview failed', err));

        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    // Load participants for organizer's events and show a small preview under the total-participants stat-card
    async loadParticipantsPreview() {
        const eventsResp = await api.getMyEvents({ limit: 50 });
        const events = eventsResp.events || [];

        const promises = events.map(ev => api.getEventRegistrations(ev.id)
            .then(r => ({ event: ev, regs: r.registrations || [] }))
            .catch(() => ({ event: ev, regs: [] })));
        const results = await Promise.all(promises);

        const participants = [];
        results.forEach(({ event, regs }) => {
            regs.forEach(reg => {
                participants.push({
                    eventId: event.id,
                    eventTitle: event.title,
                    registrationId: reg.id,
                    studentId: reg.student_id || reg.studentId || reg.student_id,
                    firstName: reg.first_name || reg.firstName || '',
                    lastName: reg.last_name || reg.lastName || '',
                    department: reg.department || reg.dept || reg.branch || ''
                });
            });
        });

        const totalEl = document.getElementById('total-participants');
        if (totalEl) {
            totalEl.textContent = participants.length;

            // Update the dedicated View Participants button text and visibility
            const viewBtn = document.getElementById('view-participants-btn');
            if (viewBtn) {
                viewBtn.style.display = participants.length > 0 ? 'inline-block' : 'none';
                viewBtn.textContent = participants.length > 0 ? `View Participants (${participants.length})` : 'View Participants';
            }
        }
    }

    escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    async showParticipantsModal() {
        const eventsResp = await api.getMyEvents({ limit: 200 });
        const events = eventsResp.events || [];
        const promises = events.map(ev => api.getEventRegistrations(ev.id)
            .then(r => ({ event: ev, regs: r.registrations || [] }))
            .catch(() => ({ event: ev, regs: [] })));
        const results = await Promise.all(promises);

        const participants = [];
        results.forEach(({ event, regs }) => {
            regs.forEach(reg => participants.push({
                eventTitle: event.title,
                studentId: reg.student_id || reg.studentId,
                firstName: reg.first_name,
                lastName: reg.last_name,
                department: reg.department || reg.dept || reg.branch || ''
            }));
        });

        const body = document.getElementById('participants-modal-body');
        if (!body) return;
        body.innerHTML = '';

        if (participants.length === 0) {
            body.innerHTML = '<p>No participants found.</p>';
        } else {
            const table = document.createElement('table');
            table.className = 'participants-table';
            const thead = document.createElement('thead');
            // Added Branch column to show student's department/branch
            thead.innerHTML = '<tr><th>#</th><th>Name</th><th>Student ID</th><th>Branch</th><th>Event</th></tr>';
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            participants.forEach((p, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${i+1}</td><td>${this.escapeHtml(p.firstName||'')} ${this.escapeHtml(p.lastName||'')}</td><td>${this.escapeHtml(p.studentId||'N/A')}</td><td>${this.escapeHtml(p.department||'')}</td><td>${this.escapeHtml(p.eventTitle||'')}</td>`;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            body.appendChild(table);
        }

        this.showModal('participants-modal');
    }

    async loadRecentActivity() {
        try {
            const response = await api.getMyEvents({ limit: 5 });
            const events = response.events || [];

            const eventsList = document.getElementById('recent-events');
            if (!eventsList) return;

            if (events.length === 0) {
                eventsList.innerHTML = `
                    <div class="no-events">
                        <i class="fas fa-calendar-plus"></i>
                        <h3>No events yet</h3>
                        <p>Create your first event to get started</p>
                    </div>
                `;
                return;
            }

            const eventsHTML = events.map(event => this.createRecentEventCard(event)).join('');
            eventsList.innerHTML = eventsHTML;

        } catch (error) {
            console.error('Failed to load recent events:', error);
        }
    }

    createRecentEventCard(event) {
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const statusColors = {
            'pending': 'var(--warning-color)',
            'approved': 'var(--success-color)',
            'rejected': 'var(--error-color)',
            'completed': 'var(--primary-color)',
            'cancelled': 'var(--text-muted)'
        };

        return `
            <div class="event-card" data-event-id="${event.id}">
                <div class="event-content">
                    <div class="event-header">
                        <h3 class="event-title">${event.title}</h3>
                        <span class="event-status" style="background-color: ${statusColors[event.status] || 'var(--text-muted)'}">
                            ${event.status}
                        </span>
                    </div>
                    <div class="event-meta">
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formattedDate}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-users"></i>
                            <span>${event.registered_count || 0} participants</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadEvents() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading('events-grid');

        try {
            const params = {
                page: this.currentPage,
                limit: 6
            };

            if (this.searchTerm) {
                params.search = this.searchTerm;
            }

            if (this.currentFilter !== 'all') {
                params.status = this.currentFilter;
            }

            const response = await api.getMyEvents(params);
            const newEvents = response.events || [];

            if (this.currentPage === 1) {
                this.events = newEvents;
            } else {
                this.events = [...this.events, ...newEvents];
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

        const statusColors = {
            'pending': 'var(--warning-color)',
            'approved': 'var(--success-color)',
            'rejected': 'var(--error-color)',
            'completed': 'var(--primary-color)',
            'cancelled': 'var(--text-muted)'
        };

        return `
            <div class="event-card" data-event-id="${event.id}">
                <div class="event-image">
                    ${event.banner_image ? 
                        `<img src="/uploads/events/${event.banner_image}" alt="${event.title}">` :
                        `<i class="fas fa-calendar-alt"></i>`
                    }
                </div>
                <div class="event-content">
                    <div class="event-header">
                        <h3 class="event-title">${event.title}</h3>
                        <span class="event-status" style="background-color: ${statusColors[event.status] || 'var(--text-muted)'}">
                            ${event.status}
                        </span>
                    </div>
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
                        <div class="meta-item">
                            <i class="fas fa-users"></i>
                            <span>${event.registered_count || 0}/${event.capacity}</span>
                        </div>
                    </div>
                    <div class="event-actions">
                        <button class="btn btn-outline btn-sm edit-event-btn" data-event-id="${event.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    resetAndLoadEvents() {
        this.currentPage = 1;
        this.events = [];
        this.hasMoreEvents = true;
        this.loadEvents();
    }

    async loadVenues() {
        try {
            const response = await api.getVenues();
            this.venues = response.venues || [];
            this.populateVenueSelect();
        } catch (error) {
            console.error('Failed to load venues:', error);
        }
    }

    populateVenueSelect() {
        // populate all selects that use .venue-select (create + edit forms)
        const selects = document.querySelectorAll('.venue-select');
        selects.forEach(venueSelect => {
            if (!venueSelect) return;
            venueSelect.innerHTML = '<option value="">Select venue</option>';
            this.venues.forEach(venue => {
                const option = document.createElement('option');
                option.value = venue.id;
                option.textContent = `${venue.name} (Capacity: ${venue.capacity})`;
                venueSelect.appendChild(option);
            });
        });
    }

    /* Edit event flow */
    async openEditEvent(eventId) {
        try {
            const response = await api.getEvent(eventId);
            const event = response.event;
            if (!event) {
                this.showError('Event not found');
                return;
            }

            // Ensure venues are loaded so select options exist
            if (!this.venues || this.venues.length === 0) {
                await this.loadVenues();
            }

            // Populate form fields
            document.getElementById('edit-event-id').value = event.id;
            document.getElementById('edit-event-title').value = event.title || '';
            document.getElementById('edit-event-description').value = event.description || '';
            document.getElementById('edit-event-date').value = event.event_date ? event.event_date.split('T')[0] : '';
            document.getElementById('edit-start-time').value = event.start_time || '';
            document.getElementById('edit-end-time').value = event.end_time || '';
            document.getElementById('edit-event-capacity').value = event.capacity || '';
            document.getElementById('edit-registration-deadline').value = event.registration_deadline ? event.registration_deadline.replace(' ', 'T') : '';
            // set venue select
            const vsel = document.getElementById('edit-event-venue');
            if (vsel) vsel.value = event.venue_id || '';

            // show modal
            this.showModal('edit-event-modal');

            // Attach submit handler once
            const editForm = document.getElementById('edit-event-form');
            if (editForm && !editForm._bound) {
                editForm.addEventListener('submit', (e) => this.submitEditForm(e));
                editForm._bound = true;
            }

        } catch (error) {
            console.error('Failed to load event for edit:', error);
            this.showError('Failed to load event for editing.');
        }
    }

    async submitEditForm(e) {
        e.preventDefault();
        const form = e.target;
        const eventId = document.getElementById('edit-event-id').value;
        if (!eventId) return this.showError('Missing event id');

        const formData = new FormData(form);
        // Use same validation as create
        if (!this.validateEventForm(formData)) return;

        const saveBtn = form.querySelector('button[type="submit"]');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        try {
            // Server expects snake_case field names for updates (event_date, start_time, etc.).
            // We'll include both snake_case and camelCase keys to be robust while we debug.
            const eventData = {};
            const titleVal = formData.get('title');
            const descVal = formData.get('description');
            const dateVal = formData.get('eventDate');
            const startVal = formData.get('startTime');
            const endVal = formData.get('endTime');
            const venueVal = formData.get('venueId');
            const capacityVal = formData.get('capacity');
            const regDeadlineVal = formData.get('registrationDeadline');

            // Normalize date formats: accept DD-MM-YYYY typed by users and convert to YYYY-MM-DD
            function normalizeDateString(val) {
                if (!val) return val;
                if (val instanceof Date) return val.toISOString().split('T')[0];
                if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val;
                if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
                    const [d, m, y] = val.split('-');
                    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                }
                return val;
            }

            if (titleVal) { eventData.title = titleVal; }
            if (descVal) { eventData.description = descVal; }
            if (dateVal) { const n = normalizeDateString(dateVal); eventData.event_date = n; eventData.eventDate = n; }
            if (startVal) { eventData.start_time = startVal; eventData.startTime = startVal; }
            if (endVal) { eventData.end_time = endVal; eventData.endTime = endVal; }
            if (venueVal) { eventData.venue_id = venueVal; eventData.venueId = venueVal; }
            if (capacityVal) { eventData.capacity = capacityVal; }
            if (regDeadlineVal) {
                // registrationDeadline may include time (datetime-local). Normalize dd-mm-yyyyT... formats
                let rd = regDeadlineVal;
                if (/^\d{2}-\d{2}-\d{4}T/.test(rd)) {
                    const [datePart, timePart] = rd.split('T');
                    const [d, m, y] = datePart.split('-');
                    rd = `${y}-${m}-${d}T${timePart}`;
                }
                eventData.registration_deadline = rd;
                eventData.registrationDeadline = rd;
            }

            console.debug('Submitting event update payload for event', eventId, eventData);

            // Call update and surface any validation errors from the server
            let updatedEventResponse;
            try {
                updatedEventResponse = await api.updateEvent(eventId, eventData);
            } catch (updateErr) {
                console.error('Update event error response:', updateErr);
                // If server returned structured validation errors, show them
                if (updateErr.response && updateErr.response.errors && Array.isArray(updateErr.response.errors)) {
                    const msgs = updateErr.response.errors.map(e => `${e.param || e.field || ''}: ${e.msg || e.message || JSON.stringify(e)}`);
                    this.showError(msgs.join('\n'));
                } else if (updateErr.response && updateErr.response.message) {
                    this.showError(updateErr.response.message);
                } else {
                    this.showError(updateErr.message || 'Failed to update event.');
                }
                throw updateErr;
            }
            // Prefer the updated event object returned by the API to update the UI instantly
            const updatedEvent = (updatedEventResponse && (updatedEventResponse.event || updatedEventResponse)) || null;
            if (updatedEvent) {
                // Normalize date fields coming from the API (mysql may return Date objects)
                try {
                    if (updatedEvent.event_date && updatedEvent.event_date instanceof Date) {
                        updatedEvent.event_date = updatedEvent.event_date.toISOString();
                    }
                    if (updatedEvent.registration_deadline && updatedEvent.registration_deadline instanceof Date) {
                        updatedEvent.registration_deadline = updatedEvent.registration_deadline.toISOString();
                    }
                } catch (e) { /* ignore */ }

                // Update in-memory list and DOM immediately
                // Update events array if the event exists there
                const existingIndex = this.events.findIndex(ev => String(ev.id) === String(updatedEvent.id));
                if (existingIndex !== -1) {
                    // Merge server fields into the stored event object
                    this.events[existingIndex] = Object.assign({}, this.events[existingIndex], updatedEvent);
                }

                // Apply to DOM elements (cards + recent list)
                this.applyUpdatedEventToDOM(updatedEvent);

                // Re-render the events grid to ensure templates reflect any new fields
                try { this.renderEvents(); } catch (e) { /* ignore */ }

                // Refresh recent activity entry if present
                try { this.loadRecentActivity(); } catch (e) { /* ignore */ }
            } else {
                // If server didn't return the updated event, attempt to refetch it explicitly
                try {
                    const fetched = await api.getEvent(eventId);
                    const fetchedEvent = fetched && (fetched.event || fetched) ? (fetched.event || fetched) : null;
                    if (fetchedEvent) {
                        this.applyUpdatedEventToDOM(fetchedEvent);
                        // merge into in-memory if present
                        const existingIndex2 = this.events.findIndex(ev => String(ev.id) === String(fetchedEvent.id));
                        if (existingIndex2 !== -1) this.events[existingIndex2] = Object.assign({}, this.events[existingIndex2], fetchedEvent);
                        this.renderEvents();
                        this.loadRecentActivity();
                    } else {
                        this.resetAndLoadEvents();
                        this.loadRecentActivity();
                    }
                } catch (refetchErr) {
                    // fallback: full refresh
                    this.resetAndLoadEvents();
                    this.loadRecentActivity();
                }
            }

            this.showSuccess('Event updated successfully');
            this.hideModal('edit-event-modal');

            // if the currently open event details belong to this event, refresh them
            if (this.currentEventId == eventId) {
                this.showEventDetails(eventId);
            }

        } catch (error) {
            console.error('Failed to update event:', error);
            this.showError(error.message || 'Failed to update event.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save Changes';
            }
        }
    }

    applyUpdatedEventToDOM(updatedEvent) {
        // Normalize id to string for comparisons
        const id = String(updatedEvent.id || updatedEvent.event_id || updatedEvent._id);

        // 1) Update in-memory events array if present
        const idx = this.events.findIndex(ev => String(ev.id) === id);
        if (idx !== -1) {
            this.events[idx] = Object.assign({}, this.events[idx], updatedEvent);
        }

        // 2) Update any rendered event-card elements with matching data-event-id
        const selector = `.event-card[data-event-id="${id}"]`;
        const cards = document.querySelectorAll(selector);
        cards.forEach(card => {
            // Prefer to replace the whole card with freshly generated HTML to avoid selector mismatches
            try {
                const newHTML = this.createEventCard(updatedEvent);
                card.outerHTML = newHTML;
            } catch (e) {
                // Fallback to granular updates if createEventCard fails
                // Update title
                const titleEl = card.querySelector('.event-title');
                if (titleEl && updatedEvent.title) titleEl.textContent = updatedEvent.title;

                // Update description
                const descEl = card.querySelector('.event-description');
                if (descEl && typeof updatedEvent.description !== 'undefined') descEl.textContent = updatedEvent.description;

                // Update date
                if (updatedEvent.event_date) {
                    try {
                        const dt = new Date(updatedEvent.event_date);
                        const formatted = dt.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                        const metaCalendar = Array.from(card.querySelectorAll('.meta-item')).find(m => m.querySelector('i.fa-calendar'));
                        if (metaCalendar) {
                            const span = metaCalendar.querySelector('span');
                            if (span) span.textContent = formatted;
                        }
                    } catch (e) { /* ignore formatting errors */ }
                }

                // Update start time
                if (updatedEvent.start_time) {
                    const metaClock = Array.from(card.querySelectorAll('.meta-item')).find(m => m.querySelector('i.fa-clock'));
                    if (metaClock) {
                        const span = metaClock.querySelector('span');
                        if (span) span.textContent = new Date(`2000-01-01T${updatedEvent.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    }
                }

                // Update venue name
                if (updatedEvent.venue_name) {
                    const metaVenue = Array.from(card.querySelectorAll('.meta-item')).find(m => m.querySelector('i.fa-map-marker-alt'));
                    if (metaVenue) {
                        const span = metaVenue.querySelector('span');
                        if (span) span.textContent = updatedEvent.venue_name;
                    }
                }

                // Update capacity/registered count
                const metaUsers = Array.from(card.querySelectorAll('.meta-item')).find(m => m.querySelector('i.fa-users'));
                if (metaUsers) {
                    const span = metaUsers.querySelector('span');
                    if (span) span.textContent = `${updatedEvent.registered_count || 0}/${updatedEvent.capacity || ''}`;
                }
            }
        });

        // 3) Update recent events list entries if present
        const recentSelector = `#recent-events .event-card[data-event-id="${id}"]`;
        const recentCards = document.querySelectorAll(recentSelector);
        recentCards.forEach(rc => {
            try {
                const newHTML = this.createRecentEventCard(updatedEvent);
                rc.outerHTML = newHTML;
            } catch (e) {
                const titleEl = rc.querySelector('.event-title');
                if (titleEl && updatedEvent.title) titleEl.textContent = updatedEvent.title;
                const dateSpan = rc.querySelector('.meta-item span');
                if (dateSpan && updatedEvent.event_date) {
                    const dt = new Date(updatedEvent.event_date);
                    dateSpan.textContent = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
            }
        });
    }

    updateCapacityLimit(venueId) {
        const capacityInput = document.getElementById('event-capacity');
        if (!capacityInput) return;

        const venue = this.venues.find(v => v.id == venueId);
        if (venue) {
            capacityInput.max = venue.capacity;
            capacityInput.placeholder = `Max ${venue.capacity} participants`;
        } else {
            capacityInput.max = '';
            capacityInput.placeholder = 'Max participants';
        }
    }

    async createEvent(e) {
        const formData = new FormData(e.target);
        
        // Validate form
        if (!this.validateEventForm(formData)) {
            return;
        }

        const createBtn = e.target.querySelector('button[type="submit"]');
        this.setButtonLoading(createBtn, true);

        try {
            const eventData = {
                title: formData.get('title'),
                description: formData.get('description'),
                eventDate: formData.get('eventDate'),
                startTime: formData.get('startTime'),
                endTime: formData.get('endTime'),
                venueId: formData.get('venueId'),
                capacity: formData.get('capacity'),
                registrationDeadline: formData.get('registrationDeadline') || null
            };

            const response = await api.createEvent(eventData);
            
            this.showSuccess('Event created successfully! It will be reviewed by admin.');
            e.target.reset();
            this.loadEvents();
            this.loadRecentActivity();

        } catch (error) {
            console.error('Failed to create event:', error);
            this.showError(error.message || 'Failed to create event.');
        } finally {
            this.setButtonLoading(createBtn, false);
        }
    }

    validateEventForm(formData) {
        const title = formData.get('title');
        const description = formData.get('description');
        const eventDate = formData.get('eventDate');
        const startTime = formData.get('startTime');
        const endTime = formData.get('endTime');
        const venueId = formData.get('venueId');
        const capacity = formData.get('capacity');

        // Required fields: title, description, eventDate, venueId, capacity
        if (!title || !description || !eventDate || !venueId || !capacity) {
            this.showError('Please fill in all required fields.');
            return false;
        }

        // Mirror server-side validators: minimum lengths
        if (title && title.trim().length < 5) {
            this.showError('Title must be at least 5 characters long.');
            return false;
        }
        if (description && description.trim().length < 20) {
            this.showError('Description must be at least 20 characters long.');
            return false;
        }

        // Allow editing past events. Only validate times if both provided.
        if (startTime && endTime && startTime >= endTime) {
            this.showError('End time must be after start time.');
            return false;
        }

        const venue = this.venues.find(v => v.id == venueId);
        if (venue && parseInt(capacity) > venue.capacity) {
            this.showError(`Capacity cannot exceed venue capacity (${venue.capacity}).`);
            return false;
        }

        return true;
    }

    async showEventDetails(eventId) {
        try {
            this.currentEventId = eventId;
            const [eventResponse, registrationsResponse] = await Promise.all([
                api.getEvent(eventId),
                api.getEventRegistrations(eventId)
            ]);

            const event = eventResponse.event;
            const registrations = registrationsResponse.registrations || [];

            this.populateEventDetailsModal(event, registrations);
            this.showModal('event-details-modal');

        } catch (error) {
            console.error('Failed to load event details:', error);
            this.showError('Failed to load event details.');
        }
    }

    populateEventDetailsModal(event, registrations) {
        document.getElementById('modal-event-title').textContent = event.title;
        
        // Populate overview tab
        const overview = document.getElementById('event-overview');
        overview.innerHTML = this.createEventOverviewHTML(event, registrations);

        // Populate registrations tab
        const registrationsList = document.getElementById('event-registrations');
        registrationsList.innerHTML = this.createRegistrationsHTML(registrations);

        // Populate attendance tab
        const attendanceList = document.getElementById('event-attendance');
        attendanceList.innerHTML = this.createAttendanceHTML(registrations);
    }

    createEventOverviewHTML(event, registrations) {
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

        const attendedCount = registrations.filter(r => r.status === 'attended').length;
        const attendanceRate = registrations.length > 0 ? (attendedCount / registrations.length * 100).toFixed(1) : 0;

        return `
            <div class="event-overview-content">
                <div class="event-image">
                    ${event.banner_image ? 
                        `<img src="/uploads/events/${event.banner_image}" alt="${event.title}">` :
                        `<i class="fas fa-calendar-alt"></i>`
                    }
                </div>
                <div class="event-info">
                    <div class="event-meta">
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formattedDate}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-clock"></i>
                            <span>${startTime} - ${endTime}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${event.venue_name || 'TBA'}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-users"></i>
                            <span>${registrations.length}/${event.capacity} registered</span>
                        </div>
                    </div>
                    <div class="event-description">
                        <p>${event.description}</p>
                    </div>
                    <div class="event-stats">
                        <div class="stat-item">
                            <span class="stat-value">${registrations.length}</span>
                            <span class="stat-label">Total Registrations</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${attendedCount}</span>
                            <span class="stat-label">Attended</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${attendanceRate}%</span>
                            <span class="stat-label">Attendance Rate</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createRegistrationsHTML(registrations) {
        if (registrations.length === 0) {
            return `
                <div class="no-registrations">
                    <i class="fas fa-users"></i>
                    <h3>No registrations yet</h3>
                    <p>Participants will appear here once they register</p>
                </div>
            `;
        }

        return registrations.map(registration => `
            <div class="registration-item">
                <div class="registration-info">
                    <h4>${registration.first_name} ${registration.last_name}</h4>
                    <p>${registration.email}</p>
                    ${registration.student_id ? `<p>ID: ${registration.student_id}</p>` : ''}
                    ${registration.department ? `<p>${registration.department}</p>` : ''}
                </div>
                <div class="registration-status">
                    <span class="status-badge ${registration.status}">${registration.status}</span>
                    <p>Registered: ${new Date(registration.registration_date).toLocaleDateString()}</p>
                </div>
            </div>
        `).join('');
    }

    createAttendanceHTML(registrations) {
        const attended = registrations.filter(r => r.status === 'attended');
        const absent = registrations.filter(r => r.status === 'absent');
        const pending = registrations.filter(r => r.status === 'registered');

        return `
            <div class="attendance-summary">
                <div class="attendance-stats">
                    <div class="stat-item">
                        <span class="stat-value">${attended.length}</span>
                        <span class="stat-label">Attended</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${absent.length}</span>
                        <span class="stat-label">Absent</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${pending.length}</span>
                        <span class="stat-label">Pending</span>
                    </div>
                </div>
                <div class="attendance-actions">
                    <button class="btn btn-primary" onclick="markAllAttended()">Mark All Attended</button>
                    <button class="btn btn-outline" onclick="exportAttendance()">Export List</button>
                </div>
            </div>
            <div class="attendance-list">
                ${registrations.map(registration => `
                    <div class="attendance-item">
                        <div class="participant-info">
                            <h4>${registration.first_name} ${registration.last_name}</h4>
                            <p>${registration.email}</p>
                        </div>
                        <div class="attendance-actions">
                            <button class="btn btn-sm ${registration.status === 'attended' ? 'btn-success' : 'btn-outline'}" 
                                    onclick="markAttendance(${registration.id}, 'attended')">
                                Attended
                            </button>
                            <button class="btn btn-sm ${registration.status === 'absent' ? 'btn-danger' : 'btn-outline'}" 
                                    onclick="markAttendance(${registration.id}, 'absent')">
                                Absent
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    showEventDetailsTab(tab) {
        const tabContents = document.querySelectorAll('#event-details-modal .tab-content');
        const tabButtons = document.querySelectorAll('#event-details-modal .tab-btn');

        tabContents.forEach(content => content.classList.remove('active'));
        tabButtons.forEach(btn => btn.classList.remove('active'));

        const targetTab = document.getElementById(`${tab}-tab`);
        const targetBtn = document.querySelector(`[data-tab="${tab}"]`);

        if (targetTab) targetTab.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');
    }

    async loadAnalytics() {
        // This would load analytics data
        const feedbackSummary = document.getElementById('feedback-summary');
        if (feedbackSummary) {
            feedbackSummary.innerHTML = `
                <div class="analytics-placeholder">
                    <i class="fas fa-chart-pie"></i>
                    <p>Analytics coming soon</p>
                </div>
            `;
        }
    }

    setButtonLoading(button, loading) {
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        } else {
            button.disabled = false;
            button.innerHTML = 'Create Event';
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

// Global functions for HTML onclick handlers
function showEventDetails(eventId) {
    if (window.dashboardManager) {
        window.dashboardManager.showEventDetails(eventId);
    }
}

function resetEventForm() {
    const form = document.getElementById('create-event-form');
    if (form) {
        form.reset();
    }
}

function markAttendance(registrationId, status) {
    if (window.dashboardManager) {
        api.markAttendance(registrationId, status)
            .then(() => {
                window.dashboardManager.showSuccess('Attendance updated successfully!');
                // Refresh the event details
                if (window.dashboardManager.currentEventId) {
                    window.dashboardManager.showEventDetails(window.dashboardManager.currentEventId);
                }
            })
            .catch(error => {
                window.dashboardManager.showError('Failed to update attendance.');
            });
    }
}

function markAllAttended() {
    // Implementation for marking all as attended
    window.dashboardManager?.showSuccess('Feature coming soon!');
}

function exportAttendance() {
    // Implementation for exporting attendance
    window.dashboardManager?.showSuccess('Export feature coming soon!');
}

// Initialize organizer dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Override the base dashboard manager with organizer-specific functionality
    if (window.dashboardManager) {
        window.dashboardManager = new OrganizerDashboard();
        // Load venues for the create event form
        window.dashboardManager.loadVenues();
    }
});


