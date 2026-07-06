/* ==========================================================================
   LuxeStay Application Logic
   ========================================================================== */

// Base API Endpoint
const API_BASE_URL = 'https://demohotelsapi.pythonanywhere.com/hotels/';

// Fallback images for hotels without valid photos
const FALLBACK_HOTEL_IMAGES = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80"
];

// App State
const state = {
    remoteHotels: [],         // Fetched from API
    localHotels: [],          // Stored locally in localStorage (added/edited by user)
    deletedHotelIds: new Set(),// Stored locally in localStorage (hidden from merged list)
    favorites: new Set(),     // Stored locally in localStorage
    bookings: [],             // Stored locally in localStorage
    reviews: {},              // Stored locally: { hotelId: [reviews] }
    
    activeTab: 'explorer',
    currentPage: 1,
    itemsPerPage: 9,
    
    filters: {
        search: '',
        city: '',
        minPrice: 1000,
        maxPrice: 15000,
        minRating: 0
    },
    currentSort: '',          // Recommended, price, -price, -rating
    
    // Modal state
    currentModalHotel: null,
    activePhotoIndex: 0,
    currentModalPhotos: []
};

/* ==========================================================================
   Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadLocalStorage();
    initializeEventListeners();
    fetchHotels();
});

// Load persistent data from LocalStorage
function loadLocalStorage() {
    try {
        const storedLocal = localStorage.getItem('luxestay_local_hotels');
        if (storedLocal) state.localHotels = JSON.parse(storedLocal);

        const storedDeleted = localStorage.getItem('luxestay_deleted_hotels');
        if (storedDeleted) state.deletedHotelIds = new Set(JSON.parse(storedDeleted));

        const storedFavs = localStorage.getItem('luxestay_favorites');
        if (storedFavs) state.favorites = new Set(JSON.parse(storedFavs));

        const storedBookings = localStorage.getItem('luxestay_bookings');
        if (storedBookings) state.bookings = JSON.parse(storedBookings);

        const storedReviews = localStorage.getItem('luxestay_reviews');
        if (storedReviews) state.reviews = JSON.parse(storedReviews);

        updateBadgeCounts();
    } catch (e) {
        console.error("Error loading localStorage data", e);
        showToast("Error loading saved data. Resetting...", "error");
    }
}

// Save state back to LocalStorage
function saveLocalStorage(key) {
    try {
        if (key === 'local') {
            localStorage.setItem('luxestay_local_hotels', JSON.stringify(state.localHotels));
        } else if (key === 'deleted') {
            localStorage.setItem('luxestay_deleted_hotels', JSON.stringify([...state.deletedHotelIds]));
        } else if (key === 'favorites') {
            localStorage.setItem('luxestay_favorites', JSON.stringify([...state.favorites]));
        } else if (key === 'bookings') {
            localStorage.setItem('luxestay_bookings', JSON.stringify(state.bookings));
        } else if (key === 'reviews') {
            localStorage.setItem('luxestay_reviews', JSON.stringify(state.reviews));
        }
        updateBadgeCounts();
    } catch (e) {
        console.error(`Error saving localStorage data for ${key}`, e);
    }
}

// Update UI Badge counters
function updateBadgeCounts() {
    document.getElementById('bookings-count').innerText = state.bookings.length;
    document.getElementById('fav-count').innerText = state.favorites.size;
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */

function initializeEventListeners() {
    // Navigation Tabs
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
            
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Dark/Light Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        themeToggle.querySelector('i').className = newTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
        showToast(`Theme switched to ${newTheme} mode!`, 'success');
    });

    // Explorer - Search Bar
    document.getElementById('search-btn').addEventListener('click', executeSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });

    // Explorer - Filters (Sidebar)
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');
    const priceSlider = document.getElementById('price-slider');

    minPriceInput.addEventListener('input', () => {
        state.filters.minPrice = parseInt(minPriceInput.value) || 0;
        triggerFilterUpdate();
    });

    maxPriceInput.addEventListener('input', () => {
        state.filters.maxPrice = parseInt(maxPriceInput.value) || 0;
        priceSlider.value = state.filters.maxPrice;
        triggerFilterUpdate();
    });

    priceSlider.addEventListener('input', () => {
        maxPriceInput.value = priceSlider.value;
        state.filters.maxPrice = parseInt(priceSlider.value);
        triggerFilterUpdate();
    });

    // Rating Filter (Radio selection)
    const ratingRadios = document.querySelectorAll('input[name="rating-filter"]');
    ratingRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            state.filters.minRating = parseFloat(radio.value) || 0;
            triggerFilterUpdate();
        });
    });

    // Sort By Filter
    document.getElementById('sort-select').addEventListener('change', (e) => {
        state.currentSort = e.target.value;
        triggerFilterUpdate();
    });

    // Clear Filters
    document.getElementById('clear-filters').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        state.filters.search = '';
        
        minPriceInput.value = 1000;
        maxPriceInput.value = 15000;
        priceSlider.value = 15000;
        state.filters.minPrice = 1000;
        state.filters.maxPrice = 15000;
        
        document.querySelector('input[name="rating-filter"][value="0"]').checked = true;
        state.filters.minRating = 0;
        
        document.getElementById('sort-select').value = '';
        state.currentSort = '';
        
        // Reset City Chips
        document.querySelectorAll('.location-chips-wrapper .chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.location-chips-wrapper .chip[data-city=""]').classList.add('active');
        state.filters.city = '';
        
        fetchHotels();
    });

    // Location Chips
    const locationChips = document.querySelectorAll('.location-chips-wrapper .chip');
    locationChips.forEach(chip => {
        chip.addEventListener('click', () => {
            locationChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            state.filters.city = chip.getAttribute('data-city') || '';
            state.currentPage = 1;
            fetchHotels();
        });
    });

    // Pagination Click
    document.getElementById('prev-page').addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderExplorer();
            window.scrollTo({ top: 250, behavior: 'smooth' });
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const totalFiltered = getMergedAndFilteredHotels().length;
        const totalPages = Math.ceil(totalFiltered / state.itemsPerPage);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderExplorer();
            window.scrollTo({ top: 250, behavior: 'smooth' });
        }
    });

    // Modal Details Carousels
    document.getElementById('slider-prev').addEventListener('click', () => rotatePhoto(-1));
    document.getElementById('slider-next').addEventListener('click', () => rotatePhoto(1));

    // Booking Calculations (Form changes)
    const bookingForm = document.getElementById('booking-form');
    const checkinInput = document.getElementById('booking-checkin');
    const checkoutInput = document.getElementById('booking-checkout');
    const roomSelect = document.getElementById('booking-room-type');

    // Date validator helper (No booking in the past)
    const today = new Date().toISOString().split('T')[0];
    checkinInput.min = today;
    
    checkinInput.addEventListener('change', () => {
        checkoutInput.min = checkinInput.value;
        calculateBookingPrice();
    });
    checkoutInput.addEventListener('change', calculateBookingPrice);
    roomSelect.addEventListener('change', calculateBookingPrice);

    // Book Stay Submit
    bookingForm.addEventListener('submit', handleBookingSubmit);

    // Review Submit
    document.getElementById('review-form').addEventListener('submit', handleReviewSubmit);

    // Modal Close Triggers
    document.getElementById('close-detail-modal').addEventListener('click', () => closeModal('detail-modal'));
    document.getElementById('close-admin-modal').addEventListener('click', () => closeModal('admin-modal'));

    // Admin - Add New Hotel Trigger
    document.getElementById('add-hotel-btn').addEventListener('click', () => openAdminModal());
    document.getElementById('cancel-crud-btn').addEventListener('click', () => closeModal('admin-modal'));

    // Admin - CRUD Submit Form
    document.getElementById('hotel-crud-form').addEventListener('submit', handleCrudSubmit);
}

// Switch between navigation tabs
function switchTab(tabName) {
    state.activeTab = tabName;
    
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.remove('active');
    });
    
    // Display targeted content
    const activeSection = document.getElementById(`${tabName}-tab`);
    if (activeSection) {
        activeSection.classList.add('active');
    }
    
    // Custom renders for specific tabs
    if (tabName === 'explorer') {
        renderExplorer();
    } else if (tabName === 'bookings') {
        renderBookings();
    } else if (tabName === 'favorites') {
        renderFavorites();
    } else if (tabName === 'admin') {
        renderAdmin();
    }
}

// Trigger query search execution
function executeSearch() {
    state.filters.search = document.getElementById('search-input').value.trim();
    state.currentPage = 1;
    fetchHotels();
}

// Re-render matching list locally when simple filters update
let filterDebounce;
function triggerFilterUpdate() {
    clearTimeout(filterDebounce);
    filterDebounce = setTimeout(() => {
        state.currentPage = 1;
        renderExplorer();
    }, 200);
}

/* ==========================================================================
   API Integration & Data Merging
   ========================================================================== */

// Fetch matching Hotels from live API
async function fetchHotels() {
    const loader = document.getElementById('loader');
    const hotelGrid = document.getElementById('hotel-grid');
    const pagination = document.getElementById('pagination');
    
    loader.classList.remove('hidden');
    hotelGrid.classList.add('hidden');
    pagination.classList.add('hidden');

    try {
        // Construct endpoint query (limit parameters to let server do first search filter pass)
        let queryParams = new URLSearchParams();
        queryParams.append('limit', '100'); // Grab a rich subset to allow client-side sliders
        
        if (state.filters.city) {
            queryParams.append('location', state.filters.city);
        }
        if (state.filters.search) {
            queryParams.append('search', state.filters.search);
        }

        const url = `${API_BASE_URL}?${queryParams.toString()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const json = await response.json();
        
        if (json && json.data) {
            state.remoteHotels = json.data;
        } else {
            state.remoteHotels = [];
        }
    } catch (error) {
        console.error("Failed fetching hotels from API", error);
        showToast("Using local storage. Remote server is temporarily unreachable.", "error");
        state.remoteHotels = [];
    } finally {
        loader.classList.add('hidden');
        hotelGrid.classList.remove('hidden');
        pagination.classList.remove('hidden');
        renderExplorer();
    }
}

// Get combined hotels list (Remote API + Local Admin CRUD items)
function getMergedAndFilteredHotels() {
    // 1. Filter local hotels based on search & city filters in memory
    const filteredLocal = state.localHotels.filter(hotel => {
        // Check city
        if (state.filters.city && hotel.location.toLowerCase() !== state.filters.city.toLowerCase()) {
            return false;
        }
        // Check search query matches name, location or description
        if (state.filters.search) {
            const query = state.filters.search.toLowerCase();
            const inName = hotel.name.toLowerCase().includes(query);
            const inLoc = hotel.location.toLowerCase().includes(query);
            const inDesc = hotel.description.toLowerCase().includes(query);
            if (!inName && !inLoc && !inDesc) return false;
        }
        // Exclude if deleted locally
        if (state.deletedHotelIds.has(hotel.id)) {
            return false;
        }
        return true;
    });

    // 2. Filter remote API hotels
    const filteredRemote = state.remoteHotels.filter(hotel => {
        // Double-check filters (in case API returns more than matching, e.g. on client updates)
        if (state.filters.city && hotel.location.toLowerCase() !== state.filters.city.toLowerCase()) {
            return false;
        }
        if (state.filters.search) {
            const query = state.filters.search.toLowerCase();
            const inName = hotel.name.toLowerCase().includes(query);
            const inLoc = hotel.location.toLowerCase().includes(query);
            const inDesc = hotel.description.toLowerCase().includes(query);
            if (!inName && !inLoc && !inDesc) return false;
        }
        
        // EXCLUDE if deleted locally or overridden locally
        if (state.deletedHotelIds.has(hotel.id)) return false;
        
        // If a remote hotel was edited, the edited version lives in localHotels with the same numerical ID.
        // We must exclude the raw remote version to avoid duplicates.
        const isOverridden = state.localHotels.some(local => String(local.id) === String(hotel.id));
        if (isOverridden) return false;

        return true;
    });

    // 3. Merge both datasets
    let merged = [...filteredLocal, ...filteredRemote];

    // 4. Apply range sliders filters in client side
    merged = merged.filter(hotel => {
        const price = parseFloat(hotel.price) || 0;
        const rating = parseFloat(hotel.rating) || 0;
        
        return price >= state.filters.minPrice && 
               price <= state.filters.maxPrice && 
               rating >= state.filters.minRating;
    });

    // 5. Apply sorting
    if (state.currentSort === 'price') {
        merged.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (state.currentSort === '-price') {
        merged.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    } else if (state.currentSort === '-rating') {
        merged.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    } else {
        // Recommended / default sorting by ID
        merged.sort((a, b) => {
            const aId = typeof a.id === 'string' ? 9999 + parseInt(a.id.split('_')[1] || 0) : a.id;
            const bId = typeof b.id === 'string' ? 9999 + parseInt(b.id.split('_')[1] || 0) : b.id;
            return aId - bId;
        });
    }

    return merged;
}

/* ==========================================================================
   HTML Rendering Systems
   ========================================================================== */

// RENDER TAB 1: Explorer Grid
function renderExplorer() {
    const hotelGrid = document.getElementById('hotel-grid');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');
    
    const hotels = getMergedAndFilteredHotels();
    const totalCount = hotels.length;
    
    // Page calculations
    const totalPages = Math.ceil(totalCount / state.itemsPerPage) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIdx = (state.currentPage - 1) * state.itemsPerPage;
    const paginatedHotels = hotels.slice(startIdx, startIdx + state.itemsPerPage);

    // Update Pagination Buttons
    prevBtn.disabled = state.currentPage === 1;
    nextBtn.disabled = state.currentPage === totalPages;
    pageIndicator.innerText = `Page ${state.currentPage} of ${totalPages} (${totalCount} stays found)`;

    if (paginatedHotels.length === 0) {
        hotelGrid.innerHTML = `
            <div class="empty-state-container">
                <i class="bi bi-search-heart empty-icon"></i>
                <h3>No Luxury Stays Found</h3>
                <p>Try adjusting your search criteria, raising your price limits, or clearing the active filters.</p>
            </div>
        `;
        return;
    }

    hotelGrid.innerHTML = paginatedHotels.map(hotel => {
        const isFav = state.favorites.has(hotel.id);
        const price = formatRupee(hotel.price);
        const rating = hotel.rating ? parseFloat(hotel.rating).toFixed(1) : 'N/A';
        
        return `
            <div class="hotel-card" data-id="${hotel.id}">
                <div class="card-img-wrapper">
                    <img src="${hotel.thumbnail || FALLBACK_HOTEL_IMAGES[0]}" alt="${hotel.name}" onerror="this.src='${FALLBACK_HOTEL_IMAGES[0]}'">
                    <span class="rating-badge"><i class="bi bi-star-fill"></i> ${rating}</span>
                    <button class="fav-btn-toggle ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${hotel.id}')" aria-label="Add to Favorites">
                        <i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i>
                    </button>
                </div>
                <div class="card-body">
                    <span class="card-location"><i class="bi bi-geo-alt"></i> ${hotel.location}</span>
                    <h3 class="card-title">${hotel.name}</h3>
                    <p class="card-desc">${hotel.description}</p>
                    <div class="card-footer">
                        <div class="price-box">
                            <span class="price-lbl">Starting at</span>
                            <span class="price-num">${price}<span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted)"> / night</span></span>
                        </div>
                        <button class="btn btn-primary" onclick="openDetailsModal('${hotel.id}')">View Details</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// RENDER TAB 2: Bookings list
function renderBookings() {
    const list = document.getElementById('bookings-list');
    
    if (state.bookings.length === 0) {
        list.innerHTML = `
            <div class="empty-state-container" style="grid-column: 1 / -1">
                <i class="bi bi-calendar-x empty-icon"></i>
                <h3>No Bookings Confirmed Yet</h3>
                <p>Browse through our hotels on the Explorer page and book your room today!</p>
                <button class="btn btn-primary" onclick="switchTab('explorer')" style="margin-top: 1rem;">Start Exploring</button>
            </div>
        `;
        return;
    }

    list.innerHTML = state.bookings.map(booking => {
        const nights = calculateNights(booking.checkIn, booking.checkOut);
        
        return `
            <div class="booking-card">
                <img class="booking-hero-img" src="${booking.hotelThumbnail || FALLBACK_HOTEL_IMAGES[0]}" alt="${booking.hotelName}" onerror="this.src='${FALLBACK_HOTEL_IMAGES[0]}'">
                <div class="booking-details-box">
                    <span class="booking-badge">Confirmed Booking</span>
                    <h3 class="card-title" style="margin-top: 0.25rem;">${booking.hotelName}</h3>
                    <p class="card-location" style="margin-bottom: 1rem;"><i class="bi bi-geo-alt"></i> ${booking.hotelLocation}</p>
                    
                    <div class="booking-meta-row">
                        <div class="booking-meta-item">
                            <span class="booking-meta-label">Room Type:</span>
                            <span class="booking-meta-value">${booking.roomType}</span>
                        </div>
                        <div class="booking-meta-item">
                            <span class="booking-meta-label">Check-in Date:</span>
                            <span class="booking-meta-value">${formatDateString(booking.checkIn)}</span>
                        </div>
                        <div class="booking-meta-item">
                            <span class="booking-meta-label">Check-out Date:</span>
                            <span class="booking-meta-value">${formatDateString(booking.checkOut)}</span>
                        </div>
                        <div class="booking-meta-item">
                            <span class="booking-meta-label">Duration:</span>
                            <span class="booking-meta-value">${nights} night(s)</span>
                        </div>
                        <div class="booking-meta-item">
                            <span class="booking-meta-label">Number of Guests:</span>
                            <span class="booking-meta-value">${booking.guests}</span>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                        <div>
                            <div class="price-lbl">Paid Booking Total</div>
                            <div class="price-num" style="font-size: 1.3rem;">${formatRupee(booking.totalPrice)}</div>
                        </div>
                        <button class="btn btn-secondary btn-danger" onclick="cancelBooking('${booking.id}')" style="padding: 0.5rem 0.85rem; font-size: 0.85rem">
                            <i class="bi bi-x-circle"></i> Cancel Stay
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// RENDER TAB 3: Favorites Grid
function renderFavorites() {
    const grid = document.getElementById('favorites-grid');
    
    if (state.favorites.size === 0) {
        grid.innerHTML = `
            <div class="empty-state-container" style="grid-column: 1 / -1">
                <i class="bi bi-heartbreak empty-icon"></i>
                <h3>No Favorited Hotels</h3>
                <p>Click on the heart icon on any hotel card in Explorer to save it here.</p>
                <button class="btn btn-primary" onclick="switchTab('explorer')" style="margin-top: 1rem;">Go to Explorer</button>
            </div>
        `;
        return;
    }

    // Merge everything to locate favorited hotels
    const allHotels = [...state.localHotels, ...state.remoteHotels];
    const favHotels = allHotels.filter(hotel => state.favorites.has(hotel.id) && !state.deletedHotelIds.has(hotel.id));

    if (favHotels.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-container" style="grid-column: 1 / -1">
                <i class="bi bi-heartbreak empty-icon"></i>
                <h3>No Active Stays</h3>
                <p>The hotels you saved might have been removed.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = favHotels.map(hotel => {
        const rating = hotel.rating ? parseFloat(hotel.rating).toFixed(1) : 'N/A';
        return `
            <div class="hotel-card" data-id="${hotel.id}">
                <div class="card-img-wrapper">
                    <img src="${hotel.thumbnail || FALLBACK_HOTEL_IMAGES[0]}" alt="${hotel.name}" onerror="this.src='${FALLBACK_HOTEL_IMAGES[0]}'">
                    <span class="rating-badge"><i class="bi bi-star-fill"></i> ${rating}</span>
                    <button class="fav-btn-toggle active" onclick="event.stopPropagation(); toggleFavorite('${hotel.id}')" aria-label="Remove Favorite">
                        <i class="bi bi-heart-fill"></i>
                    </button>
                </div>
                <div class="card-body">
                    <span class="card-location"><i class="bi bi-geo-alt"></i> ${hotel.location}</span>
                    <h3 class="card-title">${hotel.name}</h3>
                    <p class="card-desc">${hotel.description}</p>
                    <div class="card-footer">
                        <div class="price-box">
                            <span class="price-lbl">Starting at</span>
                            <span class="price-num">${formatRupee(hotel.price)}/ night</span>
                        </div>
                        <button class="btn btn-primary" onclick="openDetailsModal('${hotel.id}')">View Details</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// RENDER TAB 4: Admin Control Table
function renderAdmin() {
    const listBody = document.getElementById('admin-hotels-list');
    
    // Formulate final admin table list
    // Include custom local hotels
    const locals = state.localHotels.map(h => ({ ...h, isLocal: true }));
    
    // Include remote hotels (except deleted ones, and except those overridden locally)
    const remotes = state.remoteHotels
        .filter(h => !state.deletedHotelIds.has(h.id) && !state.localHotels.some(local => String(local.id) === String(h.id)))
        .map(h => ({ ...h, isLocal: false }));
        
    const combined = [...locals, ...remotes];

    // Sort alphabetically by name
    combined.sort((a, b) => a.name.localeCompare(b.name));

    if (combined.length === 0) {
        listBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="padding: 2rem; color: var(--text-muted);">
                    <i class="bi bi-database-fill-x" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No hotels registered in the catalog.
                </td>
            </tr>
        `;
        return;
    }

    listBody.innerHTML = combined.map(hotel => {
        const originClass = hotel.isLocal ? 'origin-local' : 'origin-api';
        const originLabel = hotel.isLocal ? 'Local Override' : 'Remote API';
        
        return `
            <tr>
                <td>
                    <img class="admin-table-img" src="${hotel.thumbnail || FALLBACK_HOTEL_IMAGES[0]}" alt="${hotel.name}" onerror="this.src='${FALLBACK_HOTEL_IMAGES[0]}'">
                </td>
                <td style="font-weight: 600;">${hotel.name}</td>
                <td><i class="bi bi-geo-alt"></i> ${hotel.location}</td>
                <td style="font-weight: 700;">${formatRupee(hotel.price)}</td>
                <td><i class="bi bi-star-fill" style="color: #eab308"></i> ${parseFloat(hotel.rating).toFixed(1)}</td>
                <td>
                    <span class="admin-table-origin ${originClass}">${originLabel}</span>
                </td>
                <td>
                    <div class="admin-actions-cell">
                        <button class="icon-action-btn edit" onclick="openAdminModal('${hotel.id}')" title="Edit Hotel Details">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="icon-action-btn delete" onclick="deleteHotelLocal('${hotel.id}')" title="Delete Hotel">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/* ==========================================================================
   Details Modal, Reviews & Carousels
   ========================================================================== */

function openDetailsModal(hotelId) {
    // Locate the hotel details
    const allHotels = [...state.localHotels, ...state.remoteHotels];
    const hotel = allHotels.find(h => String(h.id) === String(hotelId));
    
    if (!hotel) {
        showToast("Hotel not found.", "error");
        return;
    }

    state.currentModalHotel = hotel;
    state.activePhotoIndex = 0;
    
    // Gather photo gallery
    let photosList = [];
    if (hotel.photos && Array.isArray(hotel.photos) && hotel.photos.length > 0) {
        photosList = [...hotel.photos];
    } else if (typeof hotel.photos === 'string' && hotel.photos.trim() !== '') {
        photosList = hotel.photos.split(',').map(u => u.trim());
    } else {
        photosList = [hotel.thumbnail || FALLBACK_HOTEL_IMAGES[0], FALLBACK_HOTEL_IMAGES[1], FALLBACK_HOTEL_IMAGES[2]];
    }
    state.currentModalPhotos = photosList.filter(url => url !== '');

    // Setup elements
    document.getElementById('modal-hotel-name').innerText = hotel.name;
    document.getElementById('modal-hotel-location').innerText = hotel.location;
    document.getElementById('modal-hotel-rating').innerHTML = `<i class="bi bi-star-fill"></i> ${parseFloat(hotel.rating).toFixed(1)}`;
    document.getElementById('modal-hotel-price').innerText = formatRupee(hotel.price);
    document.getElementById('modal-hotel-description').innerText = hotel.description;

    // Reset Forms
    document.getElementById('booking-hotel-id').value = hotel.id;
    document.getElementById('review-hotel-id').value = hotel.id;
    document.getElementById('booking-form').reset();
    document.getElementById('review-form').reset();

    // Default dates (Check-in = tomorrow, Check-out = day after)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    document.getElementById('booking-checkin').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('booking-checkout').value = dayAfter.toISOString().split('T')[0];

    // Trigger initial carousel & bookings details calculation
    renderModalSlides();
    calculateBookingPrice();
    renderReviews(hotel.id, hotel.rating);

    // Open Modal
    document.getElementById('detail-modal').classList.add('active');
    document.body.style.overflow = 'hidden'; // Stop background scrolling
}

// Render slides container
function renderModalSlides() {
    const slidesContainer = document.getElementById('modal-slides');
    const dotsContainer = document.getElementById('slider-dots');

    if (state.currentModalPhotos.length === 0) {
        slidesContainer.innerHTML = `<img class="slide-img" src="${FALLBACK_HOTEL_IMAGES[0]}">`;
        dotsContainer.innerHTML = '';
        return;
    }

    slidesContainer.innerHTML = state.currentModalPhotos.map((url) => {
        return `<img class="slide-img" src="${url}" onerror="this.src='${FALLBACK_HOTEL_IMAGES[0]}'">`;
    }).join('');

    dotsContainer.innerHTML = state.currentModalPhotos.map((_, index) => {
        return `<span class="dot ${index === 0 ? 'active' : ''}" onclick="jumpToPhoto(${index})"></span>`;
    }).join('');

    updatePhotoTransform();
}

function rotatePhoto(direction) {
    if (state.currentModalPhotos.length <= 1) return;
    
    state.activePhotoIndex += direction;
    if (state.activePhotoIndex >= state.currentModalPhotos.length) state.activePhotoIndex = 0;
    if (state.activePhotoIndex < 0) state.activePhotoIndex = state.currentModalPhotos.length - 1;

    updatePhotoTransform();
}

function jumpToPhoto(index) {
    state.activePhotoIndex = index;
    updatePhotoTransform();
}

function updatePhotoTransform() {
    const container = document.getElementById('modal-slides');
    container.style.transform = `translateX(-${state.activePhotoIndex * 100}%)`;

    // Update Dots
    const dots = document.querySelectorAll('#slider-dots .dot');
    dots.forEach((dot, index) => {
        if (index === state.activePhotoIndex) dot.classList.add('active');
        else dot.classList.remove('active');
    });
}

// Realtime booking pricing calculation
function calculateBookingPrice() {
    const checkinVal = document.getElementById('booking-checkin').value;
    const checkoutVal = document.getElementById('booking-checkout').value;
    const roomSelect = document.getElementById('booking-room-type');
    const hotel = state.currentModalHotel;

    if (!hotel || !checkinVal || !checkoutVal) return;

    const nights = calculateNights(checkinVal, checkoutVal);
    const dayLabel = document.getElementById('booking-calc-days');
    
    if (nights <= 0) {
        dayLabel.innerText = "Check-out date must be after Check-in date.";
        document.getElementById('booking-calc-base').innerText = '₹0';
        document.getElementById('booking-calc-tax').innerText = '₹0';
        document.getElementById('booking-calc-total').innerText = '₹0';
        document.getElementById('confirm-booking-btn').disabled = true;
        return;
    }
    
    document.getElementById('confirm-booking-btn').disabled = false;
    dayLabel.innerText = `Base Price (${nights} nights)`;

    const baseVal = parseFloat(hotel.price) || 0;
    const multiplier = parseFloat(roomSelect.options[roomSelect.selectedIndex].getAttribute('data-multiplier')) || 1;
    
    const baseTotal = baseVal * nights * multiplier;
    const taxTotal = baseTotal * 0.18;
    const finalTotal = baseTotal + taxTotal;

    document.getElementById('booking-calc-base').innerText = formatRupee(baseTotal);
    document.getElementById('booking-calc-tax').innerText = formatRupee(taxTotal);
    document.getElementById('booking-calc-total').innerText = formatRupee(finalTotal);
}

// Generate & Render Review section
function renderReviews(hotelId, hotelRating) {
    const reviewsList = document.getElementById('reviews-list');
    
    // Get custom user reviews
    const customReviews = state.reviews[hotelId] || [];
    
    // Get standard seed reviews if empty
    let seeds = [];
    if (customReviews.length === 0) {
        seeds = generateSeedReviews(hotelId, hotelRating);
    }
    
    const combinedReviews = [...customReviews, ...seeds];

    if (combinedReviews.length === 0) {
        reviewsList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted)">No reviews yet. Be the first to share your experience!</p>`;
        return;
    }

    // Sort reviews newest first
    combinedReviews.sort((a, b) => new Date(b.date) - new Date(a.date));

    reviewsList.innerHTML = combinedReviews.map(r => {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `<i class="bi ${i <= r.rating ? 'bi-star-fill' : 'bi-star'}"></i>`;
        }
        
        return `
            <div class="review-item">
                <div class="review-item-header">
                    <span class="reviewer-name">${r.author}</span>
                    <span class="review-stars">${stars}</span>
                </div>
                <p class="review-comment">${r.text}</p>
                <small style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.25rem;">Reviewed on ${formatDateString(r.date)}</small>
            </div>
        `;
    }).join('');
}

// Mock seed generator for nice aesthetics
function generateSeedReviews(hotelId, hotelRating) {
    const ratingVal = parseFloat(hotelRating) || 4;
    
    const seeds = [
        {
            author: "Aarav Sharma",
            rating: Math.round(ratingVal),
            text: ratingVal >= 4.2 
                ? "This stay was absolutely phenomenal! The views are unmatched, and the concierge went above and beyond to arrange our private dinners. Truly 5-star standard."
                : "A very comfortable stay. The location is excellent, right in the center, making it easy to travel around. Breakfast was delicious.",
            date: "2026-06-15"
        },
        {
            author: "Priya Iyer",
            rating: Math.max(1, Math.round(ratingVal - 0.5)),
            text: ratingVal >= 4 
                ? "Extremely clean rooms, beautiful structural layouts, and excellent hospitality. The spa package was worth every penny. Will definitely return."
                : "Decent hotel for short stays. Hospitality was warm, but check-in was a bit slow. Room amenities are solid.",
            date: "2026-06-28"
        }
    ];
    return seeds;
}

/* ==========================================================================
   Form Handling (Bookings, Reviews & CRUD overrides)
   ========================================================================== */

// Simulated Booking Submission
function handleBookingSubmit(e) {
    e.preventDefault();

    const hotel = state.currentModalHotel;
    if (!hotel) return;

    const checkin = document.getElementById('booking-checkin').value;
    const checkout = document.getElementById('booking-checkout').value;
    const roomType = document.getElementById('booking-room-type').value;
    const guests = parseInt(document.getElementById('booking-guests').value) || 1;

    const nights = calculateNights(checkin, checkout);
    if (nights <= 0) {
        showToast("Invalid checkout date.", "error");
        return;
    }

    const baseVal = parseFloat(hotel.price) || 0;
    const roomMultiplier = parseFloat(document.getElementById('booking-room-type').options[document.getElementById('booking-room-type').selectedIndex].getAttribute('data-multiplier')) || 1;
    const baseTotal = baseVal * nights * roomMultiplier;
    const totalPrice = baseTotal + (baseTotal * 0.18);

    // Save booking
    const booking = {
        id: 'BKG-' + Date.now().toString(36).toUpperCase(),
        hotelId: hotel.id,
        hotelName: hotel.name,
        hotelLocation: hotel.location,
        hotelThumbnail: hotel.thumbnail,
        roomType: roomType,
        checkIn: checkin,
        checkOut: checkout,
        guests: guests,
        totalPrice: totalPrice,
        bookedAt: new Date().toISOString()
    };

    state.bookings.push(booking);
    saveLocalStorage('bookings');
    
    closeModal('detail-modal');
    showToast(`Successfully booked stay at ${hotel.name}! Receipt: ${booking.id}`, "success");
    
    // Switch to Bookings tab to review booking list
    switchTab('bookings');
    document.querySelectorAll('.main-nav .nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === 'bookings') btn.classList.add('active');
    });
}

// Simulated Review Submission
function handleReviewSubmit(e) {
    e.preventDefault();

    const hotelId = document.getElementById('review-hotel-id').value;
    const author = document.getElementById('review-author').value.trim();
    const ratingInput = document.querySelector('input[name="user-rating"]:checked');
    const text = document.getElementById('review-text').value.trim();

    if (!ratingInput) {
        showToast("Please choose a rating score.", "error");
        return;
    }

    const rating = parseInt(ratingInput.value);

    const review = {
        author,
        rating,
        text,
        date: new Date().toISOString().split('T')[0]
    };

    if (!state.reviews[hotelId]) {
        state.reviews[hotelId] = [];
    }

    state.reviews[hotelId].push(review);
    saveLocalStorage('reviews');

    showToast("Review submitted successfully!", "success");
    document.getElementById('review-form').reset();
    
    // Reload Reviews
    const hotel = [...state.localHotels, ...state.remoteHotels].find(h => String(h.id) === String(hotelId));
    renderReviews(hotelId, hotel ? hotel.rating : 4);
}

// Local CRUD Admin - Add or Edit hotel override
function openAdminModal(hotelId = null) {
    const modalTitle = document.getElementById('admin-modal-title');
    const form = document.getElementById('hotel-crud-form');
    
    form.reset();
    document.getElementById('crud-hotel-id').value = '';

    if (hotelId) {
        modalTitle.innerText = "Edit Hotel Details";
        
        // Find existing data (either local overrides or remote raw items)
        const all = [...state.localHotels, ...state.remoteHotels];
        const hotel = all.find(h => String(h.id) === String(hotelId));
        
        if (hotel) {
            document.getElementById('crud-hotel-id').value = hotel.id;
            document.getElementById('crud-name').value = hotel.name;
            document.getElementById('crud-location').value = hotel.location;
            document.getElementById('crud-price').value = Math.round(parseFloat(hotel.price));
            document.getElementById('crud-rating').value = parseFloat(hotel.rating).toFixed(1);
            document.getElementById('crud-thumbnail').value = hotel.thumbnail;
            document.getElementById('crud-description').value = hotel.description;
            
            // Photo gallery commas
            let pUrls = '';
            if (hotel.photos && Array.isArray(hotel.photos)) {
                pUrls = hotel.photos.join(', ');
            } else if (typeof hotel.photos === 'string') {
                pUrls = hotel.photos;
            }
            document.getElementById('crud-photos').value = pUrls;
        }
    } else {
        modalTitle.innerText = "Add New Hotel";
    }

    document.getElementById('admin-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function handleCrudSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('crud-hotel-id').value;
    const name = document.getElementById('crud-name').value.trim();
    const locationVal = document.getElementById('crud-location').value;
    const price = parseFloat(document.getElementById('crud-price').value) || 0;
    const rating = parseFloat(document.getElementById('crud-rating').value) || 4.0;
    const thumbnail = document.getElementById('crud-thumbnail').value.trim();
    const description = document.getElementById('crud-description').value.trim();
    const photosText = document.getElementById('crud-photos').value.trim();

    // Parse gallery photos
    let photos = [];
    if (photosText) {
        photos = photosText.split(',').map(url => url.trim()).filter(url => url !== '');
    }

    if (editId) {
        // Mode: UPDATE (Edit existing)
        const isLocal = state.localHotels.some(h => String(h.id) === String(editId));
        
        const updatedHotel = {
            id: editId,
            name,
            location: locationVal,
            price: price.toString(),
            rating: rating,
            thumbnail: thumbnail,
            description: description,
            photos: photos.length > 0 ? photos : [thumbnail],
            origin: isLocal ? 'local' : 'override'
        };

        if (isLocal) {
            // Update in local array
            state.localHotels = state.localHotels.map(h => String(h.id) === String(editId) ? updatedHotel : h);
        } else {
            // It was a remote hotel overridden for the first time
            state.localHotels.push(updatedHotel);
        }
        
        showToast("Hotel updated successfully!", "success");
    } else {
        // Mode: CREATE (Add new local hotel)
        const newHotel = {
            id: 'local_' + Date.now(),
            name,
            location: locationVal,
            price: price.toString(),
            rating: rating,
            thumbnail: thumbnail,
            description: description,
            photos: photos.length > 0 ? photos : [thumbnail],
            origin: 'local'
        };

        state.localHotels.push(newHotel);
        showToast(`Created new hotel entry: ${name}`, "success");
    }

    saveLocalStorage('local');
    closeModal('admin-modal');
    renderAdmin();
    renderExplorer();
}

// Local delete simulation
function deleteHotelLocal(hotelId) {
    const name = [...state.localHotels, ...state.remoteHotels].find(h => String(h.id) === String(hotelId))?.name || "Hotel";
    
    if (confirm(`Are you sure you want to remove "${name}" from the active stays registry?`)) {
        const isLocal = state.localHotels.some(h => String(h.id) === String(hotelId));
        
        if (isLocal) {
            // If it is fully local, just delete it from state list
            state.localHotels = state.localHotels.filter(h => String(h.id) !== String(hotelId));
            saveLocalStorage('local');
        } else {
            // If it is remote, add it to deletedHotelIds registry so it gets filtered out of explorer
            state.deletedHotelIds.add(hotelId);
            saveLocalStorage('deleted');
        }
        
        showToast(`Successfully removed hotel entry: ${name}`, "success");
        renderAdmin();
        renderExplorer();
    }
}

// Toggle favorites
function toggleFavorite(hotelId) {
    if (state.favorites.has(hotelId)) {
        state.favorites.delete(hotelId);
        showToast("Removed from Saved Favorites.", "success");
    } else {
        state.favorites.add(hotelId);
        showToast("Added to Saved Favorites!", "success");
    }
    
    saveLocalStorage('favorites');
    
    // Refresh active views
    if (state.activeTab === 'explorer') renderExplorer();
    else if (state.activeTab === 'favorites') renderFavorites();
}

// Cancel active booking
function cancelBooking(bookingId) {
    if (confirm("Are you sure you want to cancel this reservation? All paid deposits will be refunded to your card.")) {
        state.bookings = state.bookings.filter(b => b.id !== bookingId);
        saveLocalStorage('bookings');
        showToast("Reservation cancelled successfully.", "success");
        renderBookings();
    }
}

/* ==========================================================================
   Helper Utilities
   ========================================================================== */

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = ''; // Restore background scroll
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    
    const icon = type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
    toast.innerHTML = `<i class="bi ${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Auto-remove element after animations
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function calculateNights(inStr, outStr) {
    if (!inStr || !outStr) return 0;
    const inDate = new Date(inStr);
    const outDate = new Date(outStr);
    const diffTime = outDate - inDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatRupee(value) {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(num);
}

function formatDateString(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
