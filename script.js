// ======================================================
// FURAMORA FRONT-END LOGIC (localStorage + Firestore)
// ======================================================

// ---------- Shared helpers ----------

// This function gets all users from localStorage
// If there are no users, it returns an empty array
// It also makes sure the default admin account always exists
function getUsers() {
    const raw = localStorage.getItem("users"); // get users from localStorage
    let users = [];

    // If something exists in localStorage, try to parse it
    if (raw) {
        try {
            const parsed = JSON.parse(raw); // convert JSON string to array
            if (Array.isArray(parsed)) {
                users = parsed; // only assign if it is a valid array
            }
        } catch (e) {
            users = []; // if error happens, reset users
        }
    }

    // Default admin details
    const adminEmail = "admin@furamora.com";

    // Check if admin user already exists
    const existingAdmin = users.some(
        (u) => u.role === "admin" && u.email === adminEmail
    );

    // If admin does not exist, create one automatically
    if (!existingAdmin) {
        users.push({
            id: "admin-1", // fixed id for prototype
            name: "Furamora Admin",
            email: adminEmail,
            password: "admin123", // prototype only (not secure)
            role: "admin",
            active: true, // admin account is active by default
            distanceKm: null, // only used for walkers
            availability: "",
            bio: "",
            pets: [], // only used for owners
            phone: ""
        });

        // Save updated users list back to localStorage
        localStorage.setItem("users", JSON.stringify(users));
    }

    return users; // return final users array
}

// This function saves the updated users array to localStorage
function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

// This function gets all bookings from localStorage
function getBookings() {
    const raw = localStorage.getItem("bookings"); // get bookings data

    if (!raw) return []; // if nothing stored, return empty array

    try {
        const parsed = JSON.parse(raw); // convert JSON string to array
        return Array.isArray(parsed) ? parsed : []; // make sure it is array
    } catch (e) {
        return []; // if parsing fails, return empty array
    }
}

// This function saves the bookings array to localStorage
function saveBookings(bookings) {
    localStorage.setItem("bookings", JSON.stringify(bookings));
}


// Read / save reports (simple array)

// This function gets all reports from localStorage
function getReports() {
    const raw = localStorage.getItem("reports"); // get reports data
    if (!raw) return []; // if nothing stored, return empty array

    try {
        const parsed = JSON.parse(raw); // convert JSON string to array
        return Array.isArray(parsed) ? parsed : []; // make sure it is an array
    } catch (e) {
        return []; // if parsing fails, return empty array
    }
}

// This function saves reports array to localStorage
function saveReports(reports) {
    localStorage.setItem("reports", JSON.stringify(reports));
}

// Shared ID generator
// This generates a unique id using current time + random number
function generateId() {
    return Date.now().toString() + "-" + Math.floor(Math.random() * 100000);
}

// Key used for storing live location in localStorage
const LIVE_LOCATION_KEY = "furamora_live_location";

// --------- Firestore helper ----------

// This function returns Firestore database instance if Firebase is loaded
// If Firebase is not available on this page, it returns null
function getFirestoreDb() {
    try {
        // If db is already defined globally, use it
        if (typeof db !== "undefined" && db && typeof db.collection === "function") {
            return db;
        }

        // Otherwise check if firebase object exists
        if (typeof firebase !== "undefined" &&
            firebase &&
            typeof firebase.firestore === "function") {

            const firestore = firebase.firestore();

            // Save firestore reference to window for reuse
            if (typeof window !== "undefined") {
                window.db = firestore;
            }

            return firestore;
        }
    } catch (e) {
        console.error("Error getting Firestore reference:", e);
    }

    return null; // return null if not available
}

// Simple test function to check if Firestore is connected
function testFirestoreConnection() {
    const firestore = getFirestoreDb();

    if (!firestore) {
        alert("Firestore is not available on this page.");
        return;
    }

    // Add a test document to Firestore
    firestore
        .collection("test")
        .add({
            message: "Firebase connected successfully",
            time: new Date()
        })
        .then(function () {
            alert("Firebase connected! Check Firestore console.");
        })
        .catch(function (error) {
            console.error("Firestore error:", error);
            alert("Firebase connection failed. Check console for details.");
        });
}

// --------- Auth / session helpers ----------

// This checks if a user is logged in and has the correct role
function requireRole(expectedRole) {
    const raw = localStorage.getItem("currentUser"); // get logged in user

    // If no user found, redirect to login
    if (!raw) {
        alert("Please log in to access this page.");
        window.location.href = "index.html";
        return null;
    }

    let user;

    // Try to parse stored user
    try {
        user = JSON.parse(raw);
    } catch (e) {
        localStorage.removeItem("currentUser");
        alert("There was a problem with your login data. Please log in again.");
        window.location.href = "index.html";
        return null;
    }

    // If role does not match, block access
    if (expectedRole && user.role !== expectedRole) {
        alert("You do not have permission to view this page.");
        window.location.href = "index.html";
        return null;
    }

    return user; // return valid user
}

// ======================================================
// REGISTRATION + LOGIN
// ======================================================

// Registration for owners and walkers
function registerUser() {

    // Get form input elements
    const nameInput = document.getElementById("reg-name");
    const emailInput = document.getElementById("reg-email");
    const passwordInput = document.getElementById("reg-password");
    const roleSelect = document.getElementById("reg-role");

    // If form not found on page
    if (!nameInput || !emailInput || !passwordInput || !roleSelect) {
        alert("Registration form is not available on this page.");
        return;
    }

    // Get user input values
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const role = roleSelect.value;

    // Basic validation
    if (!name || !email || !password || !role) {
        alert("Please fill in all fields before registering.");
        return;
    }

    // Prevent registering as admin
    if (role === "admin") {
        alert("You cannot register as an admin.");
        return;
    }

    let users = getUsers();

    // Check if user already exists
    const existingIndex = users.findIndex((u) => u.email === email);

    // For demo purposes, assign random distance to walkers
    let distanceKm = null;
    if (role === "walker") {
        const options = [1, 3, 5];
        distanceKm = options[Math.floor(Math.random() * options.length)];
    }

    // Create new user object
    const newUser = {
        id: existingIndex >= 0 ? users[existingIndex].id : generateId(),
        name: name,
        email: email,
        password: password, // prototype only (not secure)
        role: role,
        active: true,
        distanceKm: distanceKm,
        availability: "",
        bio: "",
        pets: [],
        phone: ""
    };

    // If user exists, update it. Otherwise add new user.
    if (existingIndex >= 0) {
        users[existingIndex] = newUser;
    } else {
        users.push(newUser);
    }

    // Save to localStorage (prototype behaviour)
    saveUsers(users);

    // Set current logged in user
    localStorage.setItem("currentUser", JSON.stringify(newUser));

    // Also save user profile to Firestore (without password)
    (function () {
        const firestore = getFirestoreDb();

        if (!firestore) {
            console.log("Firestore not available – skipping cloud save.");
            return;
        }

        firestore
            .collection("users")
            .doc(newUser.id)
            .set({
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                active: newUser.active,
                distanceKm: newUser.distanceKm || null,
                availability: newUser.availability || "",
                bio: newUser.bio || "",
                phone: newUser.phone || "",
                pets: newUser.pets || []
            })
            .then(function () {
                console.log("User saved to Firestore:", newUser.email);
            })
            .catch(function (error) {
                console.error("Error saving user to Firestore:", error);
            });
    })();

    alert("Registration successful!");
    window.location.href = "index.html";
}

// Login using localStorage users
function loginUser() {

    // Get login form elements
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const roleSelect = document.getElementById("loginRole");

    if (!emailInput || !passwordInput || !roleSelect) {
        alert("Login form is not available on this page.");
        return;
    }

    // Get user input values
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const role = roleSelect.value;

    // Basic validation
    if (!email || !password || !role) {
        alert("Please enter your email, password and role.");
        return;
    }

    const users = getUsers();

    // Find matching user
    const user = users.find(
        (u) =>
            u.email === email &&
            u.password === password &&
            u.role === role &&
            u.active !== false
    );

    // If no match found
    if (!user) {
        alert("Invalid email, password or role. Please try again.");
        return;
    }

    // Save logged in user
    localStorage.setItem("currentUser", JSON.stringify(user));

    // Redirect based on role
    if (role === "walker") {
        window.location.href = "walker.html";
    } else if (role === "admin") {
        window.location.href = "admin.html";
    } else {
        window.location.href = "owner.html";
    }
}

// ======================================================
// OWNER DASHBOARD
// ======================================================

// This function runs when owner dashboard loads
function initOwnerDashboard() {
    const user = requireRole("owner"); // make sure logged in user is owner
    if (!user) return;

    fillOwnerProfile(user);        // fill profile fields
    renderPets(user);              // show owner pets
    renderOwnerBookings(user);     // show bookings
    renderWalkersForOwner();       // show available walkers
    renderOwnerReports(user);      // show walk reports
    initLiveMap();                 // initialize live map if available
}

// Profile fields

// Fill profile input fields with current user data
function fillOwnerProfile(user) {
    const nameField = document.getElementById("owner-name");
    const phoneField = document.getElementById("owner-phone");

    if (nameField) nameField.value = user.name || "";
    if (phoneField) phoneField.value = user.phone || "";

    // Check if profile already has data
    const hasProfile =
        (user.name && user.name.trim() !== "") ||
        (user.phone && user.phone.trim() !== "");

    // If profile exists, lock fields (view mode)
    if (hasProfile) {
        enterProfileViewMode();
    } else {
        enableProfileEdit(); // otherwise allow editing
    }
}

// Save owner profile changes
function saveOwnerProfile() {
    const user = requireRole("owner");
    if (!user) return;

    const nameField = document.getElementById("owner-name");
    const phoneField = document.getElementById("owner-phone");

    if (!nameField || !phoneField) return;

    const name = nameField.value.trim();
    const phone = phoneField.value.trim();

    // Basic validation
    if (!name || !phone) {
        alert("Please fill in both your name and phone number.");
        return;
    }

    const users = getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx < 0) return;

    // Update values
    users[idx].name = name;
    users[idx].phone = phone;

    saveUsers(users);

    // Update current user session
    localStorage.setItem("currentUser", JSON.stringify(users[idx]));

    alert("Owner profile saved.");
    enterProfileViewMode(); // switch back to view mode
}

// Disable profile fields (view mode)
function enterProfileViewMode() {
    const nameField = document.getElementById("owner-name");
    const phoneField = document.getElementById("owner-phone");
    const saveBtn = document.getElementById("save-profile-btn");
    const editBtn = document.getElementById("edit-profile-btn");

    if (nameField) nameField.disabled = true;
    if (phoneField) phoneField.disabled = true;
    if (saveBtn) saveBtn.style.display = "none";
    if (editBtn) editBtn.style.display = "inline-block";
}

// Enable profile editing
function enableProfileEdit() {
    const nameField = document.getElementById("owner-name");
    const phoneField = document.getElementById("owner-phone");
    const saveBtn = document.getElementById("save-profile-btn");
    const editBtn = document.getElementById("edit-profile-btn");

    if (nameField) nameField.disabled = false;
    if (phoneField) phoneField.disabled = false;
    if (saveBtn) saveBtn.style.display = "inline-block";
    if (editBtn) editBtn.style.display = "none";
}

// Pets

// Show list of pets for the owner
function renderPets(user) {
    const list = document.getElementById("pet-list");
    if (!list) return;

    list.innerHTML = "";
    const pets = Array.isArray(user.pets) ? user.pets : [];

    if (pets.length === 0) {
        list.innerHTML = "<p>No pets added yet.</p>";
        return;
    }

    pets.forEach(function (pet) {
        const item = document.createElement("p");
        item.textContent = pet.name + " (" + pet.type + ")";
        list.appendChild(item);
    });
}

// Add new pet for owner
function addPet() {
    const user = requireRole("owner");
    if (!user) return;

    const nameField = document.getElementById("pet-name");
    const typeField = document.getElementById("pet-type");
    const notesField = document.getElementById("pet-notes");

    if (!nameField || !typeField || !notesField) return;

    const name = nameField.value.trim();
    const type = typeField.value.trim();
    const notes = notesField.value.trim();

    if (!name || !type) {
        alert("Please enter both pet name and type.");
        return;
    }

    const users = getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx < 0) return;

    // Make sure pets array exists
    if (!Array.isArray(users[idx].pets)) {
        users[idx].pets = [];
    }

    // Add new pet object
    users[idx].pets.push({
        id: generateId(),
        name: name,
        type: type,
        notes: notes
    });

    saveUsers(users);
    localStorage.setItem("currentUser", JSON.stringify(users[idx]));

    // Clear form
    nameField.value = "";
    typeField.value = "";
    notesField.value = "";

    renderPets(users[idx]); // refresh pet list
}

// Bookings for owner

// Show bookings for logged in owner
function renderOwnerBookings(user) {
    const list = document.getElementById("owner-bookings");
    if (!list) return;

    list.innerHTML = "";

    const bookings = getBookings().filter(function (b) {
        return b.ownerId === user.id;
    });

    if (bookings.length === 0) {
        list.innerHTML = "<p>No bookings yet.</p>";
        return;
    }

    bookings.forEach(function (booking) {
        const item = document.createElement("div");
        item.className = "data-item";
        item.innerHTML =
            "<strong>" +
            booking.service +
            "</strong> on " +
            booking.date +
            " at " +
            booking.time +
            " with " +
            (booking.walkerName || "any walker") +
            " — <em>" +
            booking.status +
            "</em>";
        list.appendChild(item);
    });
}

// Save new booking
function saveBooking() {
    const user = requireRole("owner");
    if (!user) return;

    const serviceField = document.getElementById("booking-service");
    const dateField = document.getElementById("booking-date");
    const timeField = document.getElementById("booking-time");

    if (!serviceField || !dateField || !timeField) return;

    const service = serviceField.value || "Dog Walk";
    const date = dateField.value;
    const time = timeField.value;

    if (!date || !time) {
        alert("Please select a date and time for your booking.");
        return;
    }

    const bookings = getBookings();

    const booking = {
        id: generateId(),
        ownerId: user.id,
        ownerName: user.name || "",
        walkerId: null,
        walkerName: "",
        service: service,
        date: date,
        time: time,
        status: "Pending"
    };

    bookings.push(booking);
    saveBookings(bookings);

    alert("Booking submitted.");

    renderOwnerBookings(user); // refresh owner view
    renderAdminBookings();     // update admin view as well
}

// Show list of walkers for owner

function renderWalkersForOwner() {
    const list = document.getElementById("walker-list");
    if (!list) return;

    const distanceFilter = document.getElementById("distance-filter");

    const maxDistance = distanceFilter && distanceFilter.value
        ? Number(distanceFilter.value)
        : null;

    const users = getUsers();

    // Filter only active walkers
    const walkers = users.filter(function (u) {
        if (u.role !== "walker" || u.active === false) return false;
        if (!maxDistance) return true;
        if (typeof u.distanceKm !== "number") return false;
        return u.distanceKm <= maxDistance;
    });

    list.innerHTML = "";

    if (walkers.length === 0) {
        list.innerHTML = "<p>No walkers match this filter.</p>";
        return;
    }

    walkers.forEach(function (w) {
        const item = document.createElement("div");
        item.className = "data-item";
        item.innerHTML =
            "<strong>" +
            w.name +
            "</strong> — approx. " +
            (w.distanceKm || "?") +
            " km away<br>" +
            "<span>" +
            (w.availability || "Availability not set") +
            "</span><br>" +
            "<span>" +
            (w.bio || "No bio yet.") +
            "</span>";
        list.appendChild(item);
    });
}

// Re-apply distance filter
function applyWalkerFilter() {
    renderWalkersForOwner();
}

// Owner reports list

// Show reports related to this owner
function renderOwnerReports(user) {
    const container = document.getElementById("owner-reports");
    if (!container) return;

    const reports = getReports().filter(function (r) {
        return r.ownerId === user.id;
    });

    container.innerHTML = "";

    if (reports.length === 0) {
        container.innerHTML =
            "<p class='placeholder-text'>No walk reports yet.</p>";
        return;
    }

    reports.forEach(function (r) {
        const item = document.createElement("div");
        item.className = "data-item";
        item.innerHTML =
            "<strong>" +
            r.date +
            " " +
            r.time +
            "</strong><br>" +
            "<em>Walker: " +
            (r.walkerName || "Unknown") +
            "</em><br>" +
            "<span>" +
            r.text +
            "</span>";
        container.appendChild(item);
    });
}

// Show last shared location on a Google Map
function initLiveMap() {
    const mapContainer = document.getElementById("live-map");
    if (!mapContainer) return;

    // Get last saved live location from localStorage
    const raw = localStorage.getItem(LIVE_LOCATION_KEY);
    if (!raw) {
        mapContainer.innerHTML =
            "<p class='placeholder-text'>Live walk location will appear here when a walker shares it (demo only).</p>";
        return;
    }

    let loc;
    try {
        loc = JSON.parse(raw); // try to parse stored location
    } catch (e) {
        mapContainer.innerHTML =
            "<p class='placeholder-text'>Unable to read live location.</p>";
        return;
    }

    // Fallback if coords are missing
    if (typeof loc.lat !== "number" || typeof loc.lng !== "number") {
        mapContainer.innerHTML =
            "<p class='placeholder-text'>No valid coordinates available.</p>";
        return;
    }

    // If Google Maps is not loaded, just show text instead of map
    if (typeof google === "undefined" || !google.maps) {
        mapContainer.innerHTML =
            "<p>Walker location: " +
            loc.lat.toFixed(5) +
            ", " +
            loc.lng.toFixed(5) +
            "</p>";
        return;
    }

    const position = { lat: loc.lat, lng: loc.lng };

    // Create the map centered at walker position
    const map = new google.maps.Map(mapContainer, {
        center: position,
        zoom: 15
    });

    // Add a marker at the walker location
    new google.maps.Marker({
        position: position,
        map: map,
        title: "Walker location"
    });
}


// ======================================================
// WALKER DASHBOARD
// ======================================================

// This runs when walker dashboard loads
function initWalkerDashboard() {
    const user = requireRole("walker"); // make sure user is a walker
    if (!user) return;

    fillWalkerProfile(user);     // fill profile fields
    renderWalkerBookings(user);  // show bookings for walker
    updateLiveLocationStatus();  // update live location status text/button
}

// Fill walker profile inputs from current user data
function fillWalkerProfile(user) {
    const nameField = document.getElementById("walker-name");
    const availabilityField = document.getElementById("walker-availability");
    const bioField = document.getElementById("walker-bio");

    if (nameField) nameField.value = user.name || "";
    if (availabilityField) availabilityField.value = user.availability || "";
    if (bioField) bioField.value = user.bio || "";
}

// Save walker profile changes
function saveWalkerProfile() {
    const user = requireRole("walker");
    if (!user) return;

    const nameField = document.getElementById("walker-name");
    const availabilityField = document.getElementById("walker-availability");
    const bioField = document.getElementById("walker-bio");

    if (!nameField || !availabilityField || !bioField) return;

    const name = nameField.value.trim();
    const availability = availabilityField.value.trim();
    const bio = bioField.value.trim();

    // At least name should not be empty
    if (!name) {
        alert("Please enter your name.");
        return;
    }

    const users = getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx < 0) return;

    // Update walker details
    users[idx].name = name;
    users[idx].availability = availability;
    users[idx].bio = bio;

    saveUsers(users);

    // Update currentUser in localStorage
    localStorage.setItem("currentUser", JSON.stringify(users[idx]));

    alert("Walker profile saved.");
}

// Walker bookings view

// Show pending bookings + walker’s own accepted/completed bookings
function renderWalkerBookings(user) {
    const pendingContainer = document.getElementById("pendingBookings");
    const confirmedContainer = document.getElementById("confirmedBookings");
    if (!pendingContainer || !confirmedContainer) return;

    const bookings = getBookings();

    // All bookings still waiting for a walker
    const pending = bookings.filter(function (b) {
        return b.status === "Pending";
    });

    // Bookings assigned to this walker (accepted or completed)
    const mine = bookings.filter(function (b) {
        return (
            b.walkerId === user.id &&
            (b.status === "Accepted" || b.status === "Completed")
        );
    });

    pendingContainer.innerHTML = "";
    confirmedContainer.innerHTML = "";

    // Render pending bookings
    if (pending.length === 0) {
        pendingContainer.innerHTML = "<p>No pending bookings.</p>";
    } else {
        pending.forEach(function (b) {
            const item = document.createElement("div");
            item.className = "data-item";
            item.innerHTML =
                "<strong>" +
                (b.service || "Walk") +
                "</strong> for " +
                (b.ownerName || "owner") +
                " on " +
                b.date +
                " at " +
                b.time +
                "<br><button type='button'>Accept</button> " +
                "<button type='button'>Decline</button>";

            // Wire up Accept / Decline buttons
            const buttons = item.querySelectorAll("button");
            if (buttons[0]) {
                buttons[0].onclick = function () {
                    updateBookingStatus(b.id, "Accepted", user);
                };
            }
            if (buttons[1]) {
                buttons[1].onclick = function () {
                    updateBookingStatus(b.id, "Declined", user);
                };
            }
            pendingContainer.appendChild(item);
        });
    }

    // Render bookings owned by this walker
    if (mine.length === 0) {
        confirmedContainer.innerHTML =
            "<p>No accepted or completed bookings yet.</p>";
    } else {
        mine.forEach(function (b) {
            const item = document.createElement("div");
            item.className = "data-item";
            item.innerHTML =
                "<strong>" +
                (b.service || "Walk") +
                "</strong> with " +
                (b.ownerName || "owner") +
                " on " +
                b.date +
                " at " +
                b.time +
                " — <em>" +
                b.status +
                "</em>";
            confirmedContainer.appendChild(item);
        });
    }
}

// Update a booking status (Accept / Decline)
// walker is the logged in walker object
function updateBookingStatus(bookingId, status, walker) {
    const bookings = getBookings();
    const idx = bookings.findIndex((b) => b.id === bookingId);
    if (idx < 0) return;

    bookings[idx].status = status;

    // When accepted, assign the walker to this booking
    if (status === "Accepted") {
        bookings[idx].walkerId = walker.id;
        bookings[idx].walkerName = walker.name;
    }

    saveBookings(bookings);

    // Re-render walker view (we are on walker page)
    renderWalkerBookings(walker);

    // Re-render owner/admin views only if they are actually on screen
    safeRenderOwnerViews();
    renderAdminBookings();
}

// Safely refresh owner view (only if owner sections exist and user is owner)
function safeRenderOwnerViews() {
    const ownerBookingsEl = document.getElementById("owner-bookings");
    const ownerReportsEl = document.getElementById("owner-reports");

    // If owner sections are not on this page, do nothing
    if (!ownerBookingsEl && !ownerReportsEl) return;

    const raw = localStorage.getItem("currentUser");
    if (!raw) return;

    try {
        const user = JSON.parse(raw);
        if (user.role !== "owner") return;

        if (ownerBookingsEl) {
            renderOwnerBookings(user);
        }
        if (ownerReportsEl) {
            renderOwnerReports(user);
        }
    } catch (e) {
        console.error("Could not re-render owner views:", e);
    }
}

// Walker submits report (attached to most recent accepted booking)
function submitReport() {
    const user = requireRole("walker"); // make sure current user is a walker
    if (!user) return;

    const textArea = document.getElementById("reportText");
    if (!textArea) return;

    const text = textArea.value.trim();

    // Do not allow empty report
    if (!text) {
        alert("Please write a short report before submitting.");
        return;
    }

    // Find all accepted bookings for this walker
    const bookings = getBookings()
        .filter(function (b) {
            return b.walkerId === user.id && b.status === "Accepted";
        })
        .sort(function (a, b) {
            // Sort by date then time
            return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
        });

    // If no accepted bookings, we cannot attach report
    if (bookings.length === 0) {
        alert("There is no accepted booking to attach this report to.");
        return;
    }

    // Take the latest accepted booking
    const latest = bookings[bookings.length - 1];

    // Save report in reports array
    const reports = getReports();
    reports.push({
        id: generateId(),
        bookingId: latest.id,
        ownerId: latest.ownerId,
        walkerId: user.id,
        walkerName: user.name || "",
        date: latest.date,
        time: latest.time,
        text: text
    });
    saveReports(reports);

    // Also store only the text for report.html (simple demo)
    localStorage.setItem("latestWalkReport", text);

    alert("Report submitted.");
    textArea.value = "";

    // Re-render owner/admin lists if they are open
    // (requireRole('owner') will only work when owner is logged in)
    renderOwnerReports(requireRole("owner") || {});
    renderAdminBookings();
}

// Live location demo

function startLiveLocation() {
    const user = requireRole("walker");
    if (!user) return;

    // Very simple demo: just store a fake coordinate and timestamp
    const demoLocation = {
        lat: 51.509865,
        lng: -0.118092,
        walkerId: user.id,
        time: Date.now()
    };

    // Save demo location in localStorage
    localStorage.setItem(LIVE_LOCATION_KEY, JSON.stringify(demoLocation));

    updateLiveLocationStatus();
    alert("Live location sharing started (demo only).");
}

function stopLiveLocation() {
    // Remove live location from localStorage
    localStorage.removeItem(LIVE_LOCATION_KEY);
    updateLiveLocationStatus();
    alert("Live location sharing stopped.");
}

// Update the small status text for live location
function updateLiveLocationStatus() {
    const statusEl = document.getElementById("live-location-status");
    if (!statusEl) return;

    const raw = localStorage.getItem(LIVE_LOCATION_KEY);

    // If there is no location saved, it is stopped
    if (!raw) {
        statusEl.innerHTML =
            "Location sharing is currently <strong>stopped</strong>.";
        return;
    }

    try {
        const loc = JSON.parse(raw);
        statusEl.innerHTML =
            "Location sharing is <strong>active</strong> (demo): " +
            "lat " +
            loc.lat +
            ", lng " +
            loc.lng +
            " at " +
            new Date(loc.time).toLocaleTimeString();
    } catch (e) {
        statusEl.innerHTML =
            "Location sharing status unknown (could not read data).";
    }
}

// ======================================================
// ADMIN DASHBOARD
// ======================================================

function initAdminDashboard() {
    const user = requireRole("admin"); // only admin can open this dashboard
    if (!user) return;

    renderAdminUsers();     // show users table
    renderAdminBookings();  // show bookings table
}

// Render list of users in admin panel
function renderAdminUsers() {
    const roleFilter = document.getElementById("admin-role-filter");
    const list = document.getElementById("admin-users-list");
    if (!roleFilter || !list) return;

    const filterValue = roleFilter.value || "all";
    const users = getUsers();

    list.innerHTML = "";

    // Filter users by selected role
    const filtered = users.filter(function (u) {
        if (filterValue === "all") return true;
        return u.role === filterValue;
    });

    if (filtered.length === 0) {
        list.innerHTML = "<p>No users match this filter.</p>";
        return;
    }

    // Create simple card for each user
    filtered.forEach(function (u) {
        const item = document.createElement("div");
        item.className = "data-item";
        item.innerHTML =
            "<strong>" +
            u.name +
            "</strong> (" +
            u.role +
            ")<br>" +
            "<span>" +
            u.email +
            "</span>";
        list.appendChild(item);
    });
}

// Render bookings list in admin panel
function renderAdminBookings() {
    const statusFilter = document.getElementById("admin-status-filter");
    const list = document.getElementById("admin-bookings-list");
    if (!statusFilter || !list) return;

    const filterValue = statusFilter.value || "all";
    const bookings = getBookings();

    list.innerHTML = "";

    // Filter bookings by status
    const filtered = bookings.filter(function (b) {
        if (filterValue === "all") return true;
        return b.status === filterValue;
    });

    if (filtered.length === 0) {
        list.innerHTML = "<p>No bookings match this filter.</p>";
        return;
    }

    // Show basic info for each booking
    filtered.forEach(function (b) {
        const item = document.createElement("div");
        item.className = "data-item";
        item.innerHTML =
            "<strong>" +
            (b.service || "Walk") +
            "</strong> – " +
            b.date +
            " " +
            b.time +
            "<br>" +
            "<span>Owner: " +
            (b.ownerName || "Unknown") +
            "</span><br>" +
            "<span>Walker: " +
            (b.walkerName || "Unassigned") +
            "</span><br>" +
            "<em>Status: " +
            b.status +
            "</em>";
        list.appendChild(item);
    });
}
