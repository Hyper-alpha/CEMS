// Main JavaScript for Index Page
class EventManager {
    constructor() {
        this.events = [];
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreEvents = true;
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadStats();
        await this.loadEvents();
    }

    setupEventListeners() {
        // Search functionality
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

        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.resetAndLoadEvents();
            });
        });

        // Load more button
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreEvents();
            });
        }

        // Event card clicks
        document.addEventListener('click', (e) => {
            const eventCard = e.target.closest('.event-card');
            if (eventCard) {
                const eventId = eventCard.dataset.eventId;
                this.showEventModal(eventId);
            }
        });

        // Modal close
        const modal = document.getElementById('event-modal');
        const closeBtn = modal?.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideEventModal();
            });
        }

        // Modal backdrop click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideEventModal();
                }
            });
        }

        // Register/Unregister buttons — use closest() so clicks on child elements still trigger
        document.addEventListener('click', (e) => {
            const registerBtn = e.target.closest && e.target.closest('#register-btn');
            const unregisterBtn = e.target.closest && e.target.closest('#unregister-btn');

            if (registerBtn) {
                this.registerForEvent();
            }

            if (unregisterBtn) {
                this.unregisterFromEvent();
            }
        });

        // Contact form
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleContactForm(e);
            });
        }

        // Mobile menu toggle
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
        }

        // Close mobile menu when clicking on links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger?.classList.remove('active');
                navMenu?.classList.remove('active');
            });
        });
    }

    async loadStats() {
        try {
            const [eventsResponse, venuesResponse] = await Promise.all([
                api.getEvents({ limit: 1000 }),
                api.getVenues()
            ]);

            const totalEvents = eventsResponse.events?.length || 0;
            const totalVenues = venuesResponse.venues?.length || 0;
            
            // Calculate total participants
            let totalParticipants = 0;
            if (eventsResponse.events) {
                totalParticipants = eventsResponse.events.reduce((sum, event) => {
                    return sum + (event.registered_count || 0);
                }, 0);
            }

            // Calculate average rating (mock for now)
            const avgRating = 4.5;

            // Update stats display
            this.updateStatDisplay('total-events', totalEvents);
            this.updateStatDisplay('total-participants', totalParticipants);
            this.updateStatDisplay('total-venues', totalVenues);
            this.updateStatDisplay('avg-rating', avgRating.toFixed(1));

        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    updateStatDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            // Animate counter
            this.animateCounter(element, 0, value, 2000);
        }
    }

    animateCounter(element, start, end, duration) {
        const startTime = performance.now();
        const isNumber = !isNaN(end);
        
        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (isNumber) {
                const current = Math.floor(start + (end - start) * progress);
                element.textContent = current.toLocaleString();
            } else {
                element.textContent = end;
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        };
        
        requestAnimationFrame(updateCounter);
    }

    async loadEvents() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();

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
            this.hideLoading();
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
                case 'this-week':
                    const weekFromNow = new Date(today);
                    weekFromNow.setDate(today.getDate() + 7);
                    return eventDate >= today && eventDate <= weekFromNow;
                
                case 'this-month':
                    const monthFromNow = new Date(today);
                    monthFromNow.setMonth(today.getMonth() + 1);
                    return eventDate >= today && eventDate <= monthFromNow;
                
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

    async loadMoreEvents() {
        if (!this.hasMoreEvents || this.isLoading) return;
        
        this.currentPage++;
        await this.loadEvents();
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
            this.showModal();

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
        document.getElementById('modal-event-capacity').textContent = 
            `${event.registered_count || 0} / ${event.capacity} participants`;
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

    showModal() {
        const modal = document.getElementById('event-modal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    hideEventModal() {
        const modal = document.getElementById('event-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    async registerForEvent() {
        if (!this.currentEventId) return;

        try {
            await api.registerForEvent(this.currentEventId);
            this.showSuccess('Successfully registered for the event!');
            this.hideEventModal();
            this.resetAndLoadEvents(); // Refresh events to update registration status
        } catch (error) {
            console.error('Registration failed:', error);
            this.showError(error.message || 'Failed to register for event.');
        }
    }

    async unregisterFromEvent() {
        if (!this.currentEventId) return;

        try {
            await api.unregisterFromEvent(this.currentEventId);
            this.showSuccess('Successfully unregistered from the event.');
            this.hideEventModal();
            this.resetAndLoadEvents(); // Refresh events to update registration status
        } catch (error) {
            console.error('Unregistration failed:', error);
            this.showError(error.message || 'Failed to unregister from event.');
        }
    }

    async handleContactForm(e) {
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name') || document.getElementById('contact-name')?.value,
            email: formData.get('email') || document.getElementById('contact-email')?.value,
            subject: formData.get('subject') || document.getElementById('contact-subject')?.value,
            message: formData.get('message') || document.getElementById('contact-message')?.value
        };

        // Basic validation
        if (!data.name || !data.email || !data.subject || !data.message) {
            this.showError('Please fill in all fields.');
            return;
        }

        // Simulate form submission (in a real app, this would send to backend)
        this.showSuccess('Thank you for your message! We\'ll get back to you soon.');
        e.target.reset();
    }

    showLoading() {
        const eventsGrid = document.getElementById('events-grid');
        if (eventsGrid && this.currentPage === 1) {
            eventsGrid.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading events...</p>
                </div>
            `;
        }
    }

    hideLoading() {
        // Loading is handled by renderEvents
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

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 3000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EventManager();
});


