
const mainContent = document.getElementById('main-content');

const initialState = {
    totalMileage: 60,
    currentMileage: 0,
    destinations: [
        { name: 'Home', mileage: 5 },
        { name: 'Work', mileage: 10 },
        { name: 'Grocery Store', mileage: 2 },
    ],
    selectedDestinations: []
};

let state = JSON.parse(localStorage.getItem('ebikeState')) || initialState;
if (!state.selectedDestinations) {
    state.selectedDestinations = [];
}


function render() {
    const selectionCounts = state.selectedDestinations.reduce((acc, dest) => {
        acc[dest.name] = (acc[dest.name] || 0) + 1;
        return acc;
    }, {});

    mainContent.innerHTML = `
        <div>
            <h2>Status</h2>
            <p>Total Mileage: ${state.totalMileage} km</p>
            <p>Current Mileage: ${state.currentMileage.toFixed(2)} km</p>
            <p>Remaining Mileage: ${(state.totalMileage - state.currentMileage).toFixed(2)} km</p>
            <p>Battery: ${((1 - state.currentMileage / state.totalMileage) * 100).toFixed(2)}%</p>
        </div>
        <div>
            <h2>Quick Add Mileage</h2>
            ${state.destinations.map(dest => {
                const count = selectionCounts[dest.name] || 0;
                return `<button class="dest-btn" data-name="${dest.name}" data-mileage="${dest.mileage}">
                    ${dest.name} (${dest.mileage} km) ${count > 0 ? `x${count}` : ''}
                </button>`
            }).join('')}
            <button id="add-selected-btn">Add Selected</button>
            <button id="clear-selected-btn">Clear Selection</button>
        </div>
        <div>
            <h2>Calibration</h2>
            <button id="full-charge-btn">Set Full Charge</button>
            <div>
                <label for="current-battery">Set Current Battery (%):</label>
                <input type="number" id="current-battery" min="0" max="100" step="1">
                <button id="set-battery-btn">Set</button>
            </div>
        </div>
    `;
}

function addMileage(mileage) {
    state.currentMileage += mileage;
    state.selectedDestinations = [];
    saveState();
    render();
}

function saveState() {
    localStorage.setItem('ebikeState', JSON.stringify(state));
}

function setFullCharge() {
    state.currentMileage = 0;
    saveState();
    render();
}

function setBattery(percentage) {
    state.currentMileage = state.totalMileage * (1 - percentage / 100);
    saveState();
    render();
}

mainContent.addEventListener('click', e => {
    if (e.target.classList.contains('dest-btn')) {
        const name = e.target.dataset.name;
        const mileage = parseFloat(e.target.dataset.mileage);
        state.selectedDestinations.push({ name, mileage });
        saveState();
        render();
    }

    if (e.target.id === 'add-selected-btn') {
        const totalMileageToAdd = state.selectedDestinations.reduce((total, dest) => total + dest.mileage, 0);
        if (totalMileageToAdd > 0) {
            addMileage(totalMileageToAdd);
        }
    }

    if (e.target.id === 'clear-selected-btn') {
        state.selectedDestinations = [];
        saveState();
        render();
    }

    if (e.target.id === 'full-charge-btn') {
        setFullCharge();
    }

    if (e.target.id === 'set-battery-btn') {
        const batteryInput = document.getElementById('current-battery');
        const percentage = parseFloat(batteryInput.value);
        if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
            setBattery(percentage);
            batteryInput.value = '';
        } else {
            alert('Please enter a valid percentage (0-100).');
        }
    }
});

render();
