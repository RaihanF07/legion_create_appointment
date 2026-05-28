document.addEventListener('DOMContentLoaded', function () {
    const dateInput = document.getElementById('booking_date');
    const timeInput = document.getElementById('booking_time');
    const durationInput = document.getElementById('booking_duration');
    const courtSelect = document.getElementById('court_id_select');
    const container = document.getElementById('availability_container');
    const alertBox = document.getElementById('booking_alert');

    if (!dateInput || !timeInput || !container) return;

    function timeToFloat(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
    }

    function formatTime(floatTime) {
        const h = Math.floor(floatTime);
        const m = Math.round((floatTime - h) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    let currentCourtsData = [];

    async function fetchAvailability() {
        const dateVal = dateInput.value;
        if (!dateVal) {
            container.innerHTML = '';
            return;
        }

        try {
            const response = await fetch('/booking/check_availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: { date: dateVal }
                })
            });

            const result = await response.json();
            if (result.result && result.result.status === 'success') {
                currentCourtsData = result.result.data;
                updateUI();
            }
        } catch (error) {
            console.error("Gagal menarik data jadwal:", error);
        }
    }

    function updateUI() {
        const timeVal = timeInput.value;
        let selectedTime = timeVal ? timeToFloat(timeVal) : null;
        
        container.innerHTML = ''; 
        if (alertBox) alertBox.classList.add('d-none');
        if (courtSelect) courtSelect.innerHTML = '<option value="">-- Pilih Lapangan --</option>';

        let availableCourtsCount = 0;

        currentCourtsData.forEach(court => {
            let maxDuration = 4;
            let isAvailable = true;
            let conflictMsg = "";

            if (selectedTime !== null) {
                for (let slot of court.slots) {
                    // Cek jika jam mulai berada di dalam waktu booking orang lain
                    if (selectedTime >= slot.start && selectedTime < slot.end) {
                        isAvailable = false;
                        conflictMsg = `Sedang dipakai: ${formatTime(slot.start)} - ${formatTime(slot.end)}`;
                        maxDuration = 0;
                        break;
                    }
                    // Cek jarak dengan jadwal berikutnya untuk sisa waktu
                    if (selectedTime < slot.start) {
                        let diff = slot.start - selectedTime;
                        if (diff < maxDuration) {
                            maxDuration = Math.floor(diff);
                        }
                    }
                }
            }

            // Atur Label Status di HTML
            let slotsHtml = court.slots.length > 0 
                ? court.slots.map(s => `<span class="badge bg-secondary me-1 mb-1" style="font-size:0.85rem;">${formatTime(s.start)} - ${formatTime(s.end)}</span>`).join('')
                : '<span class="badge bg-success" style="font-size:0.85rem;">Kosong Seharian</span>';

            let statusHtml = '';
            if (selectedTime === null) {
                statusHtml = '<span class="text-muted">Isi Jam Mulai untuk cek ketersediaan</span>';
            } else if (isAvailable && maxDuration > 0) {
                statusHtml = `<span class="text-success fw-bold">Tersedia (Sisa Maks. ${maxDuration} Jam)</span>`;
                availableCourtsCount++;
                // Hanya suntikkan lapangan ke Dropdown JIKA tersedia
                if(courtSelect) {
                    courtSelect.innerHTML += `<option value="${court.id}">${court.name} (Sisa Maks ${maxDuration} Jam)</option>`;
                }
            } else {
                statusHtml = `<span class="text-danger fw-bold">Penuh / Bentrok</span>`;
            }

            const cardHtml = `
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm h-100 ${isAvailable && selectedTime !== null && maxDuration > 0 ? 'border-success border-2' : (selectedTime !== null ? 'border-danger border-2' : '')}">
                        <div class="card-body">
                            <h5 class="card-title fw-bold">${court.name}</h5>
                            <p class="card-text mb-2">${statusHtml}</p>
                            ${conflictMsg ? `<p class="text-danger mb-2" style="font-size:0.9rem;">${conflictMsg}</p>` : ''}
                            <hr class="my-2">
                            <p class="text-muted mb-1" style="font-size:0.85rem;">Jadwal yang sudah terisi:</p>
                            <div>${slotsHtml}</div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += cardHtml;
        });

        // Tampilkan Error Alert jika jam tersebut semua lapangan sudah penuh
        if (selectedTime !== null && availableCourtsCount === 0 && alertBox) {
            alertBox.innerHTML = '<strong>Maaf!</strong> Semua lapangan penuh pada jam tersebut. Silakan geser jam Anda.';
            alertBox.classList.remove('d-none');
        }
    }

    dateInput.addEventListener('change', fetchAvailability);
    timeInput.addEventListener('change', updateUI);
});