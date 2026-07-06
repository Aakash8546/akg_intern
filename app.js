let hotels = [];
let localHotels = JSON.parse(localStorage.getItem('local_hotels')) || [];
let deletedHotels = JSON.parse(localStorage.getItem('deleted_hotels')) || [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let bookings = JSON.parse(localStorage.getItem('bookings')) || [];
let reviews = JSON.parse(localStorage.getItem('reviews')) || {};

let currentPage = 1;
let limit = 6;
let totalHotelsCount = 0;
let currentHotelDetails = null;

let detailsModal;
let adminModal;

document.addEventListener('DOMContentLoaded', () => {
    detailsModal = new bootstrap.Modal(document.getElementById('details-modal'));
    adminModal = new bootstrap.Modal(document.getElementById('admin-modal'));

    initTheme();
    setupTabNavigation();
    setupFilters();
    setupForms();
    fetchHotels();
    updateBadges();
});

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    
    let icon = 'bi-check-circle-fill text-success';
    if (type === 'danger') icon = 'bi-exclamation-octagon-fill text-danger';
    
    toast.innerHTML = `<i class="bi ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showConfirm(message, callback) {
    let container = document.getElementById('confirm-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'confirm-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; pointer-events: none;';
        document.body.appendChild(container);
    }
    
    container.innerHTML = '';
    
    const card = document.createElement('div');
    card.className = 'confirm-card';
    card.innerHTML = `
        <h6 class="mb-2 fw-bold"><i class="bi bi-question-circle-fill text-warning me-1"></i> Confirmation</h6>
        <p class="small text-muted mb-3">${message}</p>
        <div class="d-flex justify-content-end gap-2">
            <button class="btn btn-sm btn-outline-secondary" id="confirm-no-btn">No</button>
            <button class="btn btn-sm btn-danger" id="confirm-yes-btn">Yes</button>
        </div>
    `;
    container.appendChild(card);
    
    document.getElementById('confirm-no-btn').addEventListener('click', () => {
        card.remove();
    });
    
    document.getElementById('confirm-yes-btn').addEventListener('click', () => {
        card.remove();
        callback();
    });
}

function initTheme() {
    const isDark = localStorage.getItem('dark_mode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').className = 'bi bi-sun-fill';
    }
    
    document.getElementById('theme-btn').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const active = document.body.classList.contains('dark-mode');
        localStorage.setItem('dark_mode', active);
        document.getElementById('theme-icon').className = active ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    });
}

function setupTabNavigation() {
    const tabs = ['explorer', 'bookings', 'favorites', 'admin'];
    tabs.forEach(tab => {
        document.getElementById(`tab-${tab}`).addEventListener('click', (e) => {
            e.preventDefault();
            
            tabs.forEach(t => document.getElementById(`tab-${t}`).classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');
            
            tabs.forEach(t => document.getElementById(`${t}-section`).classList.add('d-none'));
            document.getElementById(`${tab}-section`).classList.remove('d-none');
            
            if (tab === 'bookings') renderBookings();
            if (tab === 'favorites') renderFavorites();
            if (tab === 'admin') renderAdminTable();
        });
    });
}

function setupFilters() {
    document.getElementById('search-btn').addEventListener('click', () => {
        currentPage = 1;
        fetchHotels();
    });

    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentPage = 1;
            fetchHotels();
        }
    });

    document.getElementById('city-select').addEventListener('change', () => {
        currentPage = 1;
        fetchHotels();
    });

    const slider = document.getElementById('price-slider');
    const minInput = document.getElementById('min-price');
    const maxInput = document.getElementById('max-price');

    slider.addEventListener('input', () => {
        maxInput.value = slider.value;
        currentPage = 1;
        fetchHotels();
    });

    minInput.addEventListener('change', () => {
        currentPage = 1;
        fetchHotels();
    });

    maxInput.addEventListener('change', () => {
        slider.value = maxInput.value;
        currentPage = 1;
        fetchHotels();
    });

    document.getElementById('rating-select').addEventListener('change', () => {
        currentPage = 1;
        fetchHotels();
    });

    document.getElementById('sort-select').addEventListener('change', () => {
        currentPage = 1;
        fetchHotels();
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        document.getElementById('city-select').value = '';
        document.getElementById('min-price').value = '1000';
        document.getElementById('max-price').value = '15000';
        document.getElementById('price-slider').value = '15000';
        document.getElementById('rating-select').value = '0';
        document.getElementById('sort-select').value = '';
        currentPage = 1;
        fetchHotels();
    });

    document.getElementById('page-prev').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            fetchHotels();
        }
    });

    document.getElementById('page-next').addEventListener('click', (e) => {
        e.preventDefault();
        const maxPage = Math.ceil(totalHotelsCount / limit);
        if (currentPage < maxPage) {
            currentPage++;
            fetchHotels();
        }
    });
}

async function fetchHotels() {
    const grid = document.getElementById('hotel-grid');
    const loader = document.getElementById('loader');
    
    grid.innerHTML = '';
    loader.classList.remove('d-none');

    const search = document.getElementById('search-input').value.trim();
    const city = document.getElementById('city-select').value;
    const minPrice = document.getElementById('min-price').value;
    const maxPrice = document.getElementById('max-price').value;
    const rating = document.getElementById('rating-select').value;
    const sort = document.getElementById('sort-select').value;

    let url = `https://demohotelsapi.pythonanywhere.com/hotels/?limit=100`;

    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (city) url += `&location=${encodeURIComponent(city)}`;
    if (minPrice) url += `&min_price=${minPrice}`;
    if (maxPrice) url += `&max_price=${maxPrice}`;
    if (rating !== '0') url += `&min_rating=${rating}`;
    if (sort) url += `&order_by=${sort}`;

    try {
        const response = await fetch(url);
        const res = await response.json();
        
        if (res && res.data) {
            hotels = res.data;
            mergeAndRender(hotels);
        } else {
            hotels = [];
            mergeAndRender([]);
        }
    } catch (e) {
        console.error("Fetch error", e);
        showToast("Error connecting to hotel database.", "danger");
        mergeAndRender([]);
    } finally {
        loader.classList.add('d-none');
    }
}

function mergeAndRender(apiHotels) {
    const city = document.getElementById('city-select').value;
    const search = document.getElementById('search-input').value.trim().toLowerCase();
    const minPrice = parseFloat(document.getElementById('min-price').value) || 0;
    const maxPrice = parseFloat(document.getElementById('max-price').value) || 999999;
    const rating = parseFloat(document.getElementById('rating-select').value) || 0;
    const sort = document.getElementById('sort-select').value;

    let filteredLocals = localHotels.filter(hotel => {
        if (deletedHotels.includes(hotel.id)) return false;
        if (city && hotel.location !== city) return false;
        
        if (search) {
            const inName = hotel.name.toLowerCase().includes(search);
            const inLoc = hotel.location.toLowerCase().includes(search);
            const inDesc = hotel.description.toLowerCase().includes(search);
            if (!inName && !inLoc && !inDesc) return false;
        }

        const price = parseFloat(hotel.price) || 0;
        const ratingVal = parseFloat(hotel.rating) || 0;
        if (price < minPrice || price > maxPrice) return false;
        if (ratingVal < rating) return false;

        return true;
    });

    let filteredRemotes = apiHotels.filter(hotel => {
        if (deletedHotels.includes(hotel.id)) return false;
        const isOverridden = localHotels.some(local => String(local.id) === String(hotel.id));
        if (isOverridden) return false;
        return true;
    });

    let merged = [...filteredLocals, ...filteredRemotes];

    if (sort === 'price') {
        merged.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sort === '-price') {
        merged.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    } else if (sort === '-rating') {
        merged.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    }

    totalHotelsCount = merged.length;
    
    const totalPages = Math.ceil(totalHotelsCount / limit) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * limit;
    const paginated = merged.slice(start, start + limit);

    renderExplorerGrid(paginated);

    document.getElementById('page-number').innerText = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('page-prev-li').classList.toggle('disabled', currentPage === 1);
    document.getElementById('page-next-li').classList.toggle('disabled', currentPage === totalPages);
}

function renderExplorerGrid(list) {
    const grid = document.getElementById('hotel-grid');
    
    if (list.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center my-5">
                <i class="bi bi-emoji-frown text-muted fs-1"></i>
                <p class="mt-2 text-muted">No hotels found matching your search options.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = list.map(hotel => {
        const isFav = favorites.includes(hotel.id);
        const rating = hotel.rating ? parseFloat(hotel.rating).toFixed(1) : 'N/A';
        const price = formatCurrency(hotel.price);
        
        return `
            <div class="col-md-4">
                <div class="card h-100 shadow-sm position-relative cursor-pointer" onclick="openDetails('${hotel.id}')">
                    <button class="fav-btn" onclick="event.stopPropagation(); toggleFav('${hotel.id}')">
                        <i class="bi ${isFav ? 'bi-heart-fill text-danger' : 'bi-heart'}"></i>
                    </button>
                    <img src="${hotel.thumbnail}" class="card-img-top" alt="${hotel.name}" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500'">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <small class="text-primary fw-bold">${hotel.location}</small>
                            <small class="fw-bold"><i class="bi bi-star-fill text-warning"></i> ${rating}</small>
                        </div>
                        <h6 class="card-title text-dark text-truncate">${hotel.name}</h6>
                        <p class="card-text text-muted small flex-grow-1" style="height: 38px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                            ${hotel.description}
                        </p>
                        <div class="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
                            <div>
                                <small class="text-muted d-block" style="font-size: 0.75rem;">Price per night</small>
                                <span class="fw-bold text-dark">${price}</span>
                            </div>
                            <button class="btn btn-sm btn-primary">Book stay</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function openDetails(id) {
    let hotel = localHotels.find(h => String(h.id) === String(id));
    
    if (!hotel) {
        try {
            const res = await fetch(`https://demohotelsapi.pythonanywhere.com/hotels/${id}/`);
            const json = await res.json();
            if (json && json.data) {
                hotel = json.data;
            }
        } catch (e) {
            console.error("ID fetch error", e);
        }
    }

    if (!hotel) {
        showToast("Hotel details not found.", "danger");
        return;
    }

    currentHotelDetails = hotel;

    document.getElementById('modal-hotel-name').innerText = hotel.name;
    document.getElementById('modal-hotel-desc').innerText = hotel.description;

    let photos = [];
    if (hotel.photos) {
        if (Array.isArray(hotel.photos)) photos = hotel.photos;
        else if (typeof hotel.photos === 'string') photos = hotel.photos.split(',').map(s => s.trim());
    }
    if (photos.length === 0) photos = [hotel.thumbnail];

    document.getElementById('carousel-images').innerHTML = photos.map((url, i) => `
        <div class="carousel-item ${i === 0 ? 'active' : ''}">
            <img src="${url}" class="d-block w-100" alt="Slide" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'">
        </div>
    `).join('');

    const bookingForm = document.getElementById('booking-form');
    bookingForm.reset();
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    document.getElementById('booking-checkin').min = today;
    document.getElementById('booking-checkin').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('booking-checkout').min = tomorrow.toISOString().split('T')[0];
    document.getElementById('booking-checkout').value = dayAfter.toISOString().split('T')[0];

    calcBookingPrice();
    renderReviews(hotel.id, hotel.rating);
    detailsModal.show();
}

function calcBookingPrice() {
    const checkin = document.getElementById('booking-checkin').value;
    const checkout = document.getElementById('booking-checkout').value;
    const room = document.getElementById('booking-room');
    
    if (!currentHotelDetails || !checkin || !checkout) return;

    const inDate = new Date(checkin);
    const outDate = new Date(checkout);
    const diff = outDate - inDate;
    const nights = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
        document.getElementById('calc-base').innerText = '₹0';
        document.getElementById('calc-gst').innerText = '₹0';
        document.getElementById('calc-total').innerText = '₹0';
        document.getElementById('booking-confirm-btn').disabled = true;
        return;
    }

    document.getElementById('booking-confirm-btn').disabled = false;
    const basePrice = parseFloat(currentHotelDetails.price) || 0;
    const multiplier = parseFloat(room.options[room.selectedIndex].getAttribute('data-multiplier')) || 1;

    const baseSum = basePrice * nights * multiplier;
    const gstSum = baseSum * 0.18;
    const totalSum = baseSum + gstSum;

    document.getElementById('calc-base').innerText = formatCurrency(baseSum);
    document.getElementById('calc-gst').innerText = formatCurrency(gstSum);
    document.getElementById('calc-total').innerText = formatCurrency(totalSum);
}

function setupForms() {
    document.getElementById('booking-checkin').addEventListener('change', () => {
        document.getElementById('booking-checkout').min = document.getElementById('booking-checkin').value;
        calcBookingPrice();
    });
    document.getElementById('booking-checkout').addEventListener('change', calcBookingPrice);
    document.getElementById('booking-room').addEventListener('change', calcBookingPrice);

    document.getElementById('booking-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentHotelDetails) return;

        const checkin = document.getElementById('booking-checkin').value;
        const checkout = document.getElementById('booking-checkout').value;
        const room = document.getElementById('booking-room').value;
        const guests = document.getElementById('booking-guests').value;

        const inDate = new Date(checkin);
        const outDate = new Date(checkout);
        const nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));

        const basePrice = parseFloat(currentHotelDetails.price) || 0;
        const multiplier = parseFloat(document.getElementById('booking-room').options[document.getElementById('booking-room').selectedIndex].getAttribute('data-multiplier')) || 1;
        const total = (basePrice * nights * multiplier) * 1.18;

        const booking = {
            id: 'BKG-' + Date.now(),
            hotelId: currentHotelDetails.id,
            hotelName: currentHotelDetails.name,
            hotelLocation: currentHotelDetails.location,
            hotelThumbnail: currentHotelDetails.thumbnail,
            room: room,
            checkin: checkin,
            checkout: checkout,
            guests: guests,
            totalPrice: total
        };

        bookings.push(booking);
        localStorage.setItem('bookings', JSON.stringify(bookings));
        updateBadges();
        
        detailsModal.hide();
        showToast(`Booking Confirmed! Ref: ${booking.id}`, "success");

        document.getElementById('tab-bookings').click();
    });

    document.getElementById('review-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentHotelDetails) return;

        const name = document.getElementById('review-name').value.trim();
        const rating = parseInt(document.getElementById('review-rating').value) || 5;
        const comment = document.getElementById('review-comment').value.trim();

        const review = {
            author: name,
            rating: rating,
            text: comment,
            date: new Date().toISOString().split('T')[0]
        };

        if (!reviews[currentHotelDetails.id]) {
            reviews[currentHotelDetails.id] = [];
        }

        reviews[currentHotelDetails.id].push(review);
        localStorage.setItem('reviews', JSON.stringify(reviews));

        document.getElementById('review-form').reset();
        renderReviews(currentHotelDetails.id, currentHotelDetails.rating);
        showToast("Review submitted successfully!", "success");
    });

    document.getElementById('add-hotel-btn').addEventListener('click', () => {
        document.getElementById('hotel-form').reset();
        document.getElementById('hotel-id').value = '';
        document.getElementById('admin-modal-title').innerText = "Add New Hotel";
        adminModal.show();
    });

    document.getElementById('hotel-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const id = document.getElementById('hotel-id').value;
        const name = document.getElementById('form-name').value.trim();
        const locationVal = document.getElementById('form-location').value;
        const price = document.getElementById('form-price').value;
        const rating = document.getElementById('form-rating').value;
        const thumbnail = document.getElementById('form-thumbnail').value.trim();
        const desc = document.getElementById('form-desc').value.trim();
        const photosText = document.getElementById('form-photos').value.trim();

        let photos = [];
        if (photosText) {
            photos = photosText.split(',').map(s => s.trim()).filter(s => s);
        }

        if (id) {
            const isLocal = localHotels.some(h => String(h.id) === String(id));
            const updated = {
                id: id,
                name: name,
                location: locationVal,
                price: price,
                rating: rating,
                thumbnail: thumbnail,
                description: desc,
                photos: photos.length > 0 ? photos : [thumbnail]
            };

            if (isLocal) {
                localHotels = localHotels.map(h => String(h.id) === String(id) ? updated : h);
            } else {
                localHotels.push(updated);
            }
            showToast("Hotel updated successfully!", "success");
        } else {
            const newHotel = {
                id: 'local_' + Date.now(),
                name: name,
                location: locationVal,
                price: price,
                rating: rating,
                thumbnail: thumbnail,
                description: desc,
                photos: photos.length > 0 ? photos : [thumbnail]
            };

            localHotels.push(newHotel);
            showToast("New hotel added successfully!", "success");
        }

        localStorage.setItem('local_hotels', JSON.stringify(localHotels));
        adminModal.hide();
        
        renderAdminTable();
        fetchHotels();
    });
}

function renderReviews(hotelId, hotelRating) {
    const list = document.getElementById('reviews-list');
    const custom = reviews[hotelId] || [];
    
    let seeds = [
        { author: "Rohan Verma", rating: 5, text: "Excellent facilities and clean room stay.", date: "2026-06-12" },
        { author: "Shreya Sen", rating: 4, text: "Pleasant stay. Room services were smooth.", date: "2026-06-25" }
    ];

    const all = [...custom, ...seeds];
    all.sort((a,b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = all.map(r => `
        <div class="border-bottom py-2">
            <div class="d-flex justify-content-between align-items-center">
                <strong>${r.author}</strong>
                <small class="text-warning"><i class="bi bi-star-fill"></i> ${r.rating}</small>
            </div>
            <p class="mb-0 text-muted small">${r.text}</p>
        </div>
    `).join('');
}

function renderBookings() {
    const list = document.getElementById('bookings-list');
    
    if (bookings.length === 0) {
        list.innerHTML = `
            <div class="col-12 text-center my-5">
                <i class="bi bi-calendar-x text-muted fs-1"></i>
                <p class="mt-2 text-muted">No stay booked yet.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = bookings.map(b => `
        <div class="col-md-6">
            <div class="card shadow-sm bg-white">
                <div class="row g-0">
                    <div class="col-sm-4">
                        <img src="${b.hotelThumbnail}" class="img-fluid rounded-start h-100 w-100" style="object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500'">
                    </div>
                    <div class="col-sm-8">
                        <div class="card-body">
                            <h6 class="card-title text-dark">${b.hotelName}</h6>
                            <p class="card-text text-primary small mb-2"><i class="bi bi-geo-alt"></i> ${b.hotelLocation}</p>
                            <div class="bg-light p-2 rounded small mb-2 text-muted" style="font-size: 0.8rem;">
                                <div><strong>Room Type:</strong> ${b.room}</div>
                                <div><strong>Check-in:</strong> ${b.checkin}</div>
                                <div><strong>Check-out:</strong> ${b.checkout}</div>
                                <div><strong>Guests:</strong> ${b.guests}</div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-3">
                                <span class="fw-bold text-dark">${formatCurrency(b.totalPrice)}</span>
                                <button class="btn btn-sm btn-outline-danger" onclick="cancelStay('${b.id}')">Cancel Stay</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function cancelStay(id) {
    showConfirm("Are you sure you want to cancel this booking?", () => {
        bookings = bookings.filter(b => b.id !== id);
        localStorage.setItem('bookings', JSON.stringify(bookings));
        updateBadges();
        renderBookings();
        showToast("Stay cancelled successfully.", "danger");
    });
}

function renderFavorites() {
    const grid = document.getElementById('favorites-grid');
    const all = [...localHotels, ...hotels];
    const favList = all.filter(h => favorites.includes(h.id) && !deletedHotels.includes(h.id));

    if (favList.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center my-5">
                <i class="bi bi-heartbreak text-muted fs-1"></i>
                <p class="mt-2 text-muted">No favorite hotel saved.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = favList.map(hotel => {
        const rating = hotel.rating ? parseFloat(hotel.rating).toFixed(1) : 'N/A';
        const price = formatCurrency(hotel.price);
        
        return `
            <div class="col-md-4">
                <div class="card h-100 shadow-sm position-relative cursor-pointer" onclick="openDetails('${hotel.id}')">
                    <button class="fav-btn" onclick="event.stopPropagation(); toggleFav('${hotel.id}')">
                        <i class="bi bi-heart-fill text-danger"></i>
                    </button>
                    <img src="${hotel.thumbnail}" class="card-img-top" alt="${hotel.name}" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500'">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <small class="text-primary fw-bold">${hotel.location}</small>
                            <small class="fw-bold"><i class="bi bi-star-fill text-warning"></i> ${rating}</small>
                        </div>
                        <h6 class="card-title text-dark text-truncate">${hotel.name}</h6>
                        <p class="card-text text-muted small flex-grow-1" style="height: 38px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                            ${hotel.description}
                        </p>
                        <div class="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
                            <div>
                                <small class="text-muted d-block" style="font-size: 0.75rem;">Price per night</small>
                                <span class="fw-bold text-dark">${price}</span>
                            </div>
                            <button class="btn btn-sm btn-primary">Book stay</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleFav(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(favId => favId !== id);
        showToast("Removed from favorites.", "danger");
    } else {
        favorites.push(id);
        showToast("Saved to favorites!", "success");
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateBadges();
    
    if (!document.getElementById('explorer-section').classList.contains('d-none')) {
        fetchHotels();
    } else if (!document.getElementById('favorites-section').classList.contains('d-none')) {
        renderFavorites();
    }
}

function renderAdminTable() {
    const body = document.getElementById('admin-table-body');
    const locals = localHotels.map(h => ({ ...h, isLocal: true }));
    const remotes = hotels
        .filter(h => !deletedHotels.includes(h.id) && !localHotels.some(l => String(l.id) === String(h.id)))
        .map(h => ({ ...h, isLocal: false }));

    const combined = [...locals, ...remotes];
    combined.sort((a,b) => a.name.localeCompare(b.name));

    if (combined.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">No hotels cataloged.</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = combined.map(h => `
        <tr>
            <td>
                <img src="${h.thumbnail}" class="rounded" style="width: 45px; height: 45px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200'">
            </td>
            <td><strong>${h.name}</strong></td>
            <td>${h.location}</td>
            <td>₹${Math.round(h.price)}</td>
            <td><i class="bi bi-star-fill text-warning"></i> ${parseFloat(h.rating).toFixed(1)}</td>
            <td>
                <span class="badge ${h.isLocal ? 'bg-warning text-dark' : 'bg-primary'}">
                    ${h.isLocal ? 'Local Entry' : 'Server API'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-secondary me-1" onclick="editHotel('${h.id}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteHotelLocal('${h.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function deleteHotelLocal(id) {
    showConfirm("Are you sure you want to delete this hotel from listings?", () => {
        const isLocal = localHotels.some(h => String(h.id) === String(id));
        if (isLocal) {
            localHotels = localHotels.filter(h => String(h.id) !== String(id));
            localStorage.setItem('local_hotels', JSON.stringify(localHotels));
        } else {
            deletedHotels.push(id);
            localStorage.setItem('deleted_hotels', JSON.stringify(deletedHotels));
        }
        renderAdminTable();
        fetchHotels();
        showToast("Hotel deleted successfully.", "danger");
    });
}

function editHotel(id) {
    const all = [...localHotels, ...hotels];
    const hotel = all.find(h => String(h.id) === String(id));

    if (!hotel) return;

    document.getElementById('hotel-id').value = hotel.id;
    document.getElementById('form-name').value = hotel.name;
    document.getElementById('form-location').value = hotel.location;
    document.getElementById('form-price').value = Math.round(hotel.price);
    document.getElementById('form-rating').value = hotel.rating;
    document.getElementById('form-thumbnail').value = hotel.thumbnail;
    document.getElementById('form-desc').value = hotel.description;

    let photos = '';
    if (hotel.photos) {
        if (Array.isArray(hotel.photos)) photos = hotel.photos.join(', ');
        else photos = hotel.photos;
    }
    document.getElementById('form-photos').value = photos;

    document.getElementById('admin-modal-title').innerText = "Edit Hotel Details";
    adminModal.show();
}

function updateBadges() {
    document.getElementById('badge-bookings').innerText = bookings.length;
    document.getElementById('badge-favorites').innerText = favorites.length;
}

function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(num);
}
