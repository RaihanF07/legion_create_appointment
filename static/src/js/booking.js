document.addEventListener('DOMContentLoaded', function () {
    const dateInput = document.getElementById('booking_date');
    const timeInput = document.getElementById('booking_time');
    const container = document.getElementById('availability_container');

    if (!dateInput || !timeInput || !container) return;

    // Mengubah string jam "14:30" menjadi desimal 14.5 untuk dihitung
    function timeToFloat(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
    }

    // Mengubah desimal 14.5 menjadi string jam "14:30" untuk ditampilkan
    function formatTime(floatTime) {
        const h = Math.floor(floatTime);
        const m = Math.round((floatTime - h) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    // Fungsi memanggil API di backend Python
    async function fetchAvailability() {
        const dateVal = dateInput.value;
        const timeVal = timeInput.value;

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
                renderCards(result.result.data, timeVal);
            }
        } catch (error) {
            console.error("Gagal menarik data jadwal:", error);
        }
    }

    // Fungsi menggambar Card di layar HTML
    function renderCards(courtsData, timeVal) {
        container.innerHTML = ''; 
        let selectedTime = timeVal ? timeToFloat(timeVal) : null;

        courtsData.forEach(court => {
            let maxDuration = 4; // Aturan bisnis: Maksimal 4 jam
            let isAvailable = true;
            let conflictMsg = "";

            if (selectedTime !== null) {
                // Hitung celah waktu kosong (Opsi B)
                for (let slot of court.slots) {
                    // Jika jam mulai berada di dalam waktu booking orang lain
                    if (selectedTime >= slot.start && selectedTime < slot.end) {
                        isAvailable = false;
                        conflictMsg = `Sedang dipakai: ${formatTime(slot.start)} - ${formatTime(slot.end)}`;
                        maxDuration = 0;
                        break;
                    }
                    // Jika jam mulai sebelum jadwal orang, hitung sisa waktunya
                    if (selectedTime < slot.start) {
                        let diff = slot.start - selectedTime;
                        if (diff < maxDuration) {
                            maxDuration = Math.floor(diff);
                        }
                    }
                }
            }

            // Tampilan daftar jam terisi
            let slotsHtml = court.slots.length > 0 
                ? court.slots.map(s => `<span class="badge bg-secondary me-1 mb-1" style="font-size:0.85rem;">${formatTime(s.start)} - ${formatTime(s.end)}</span>`).join('')
                : '<span class="badge bg-success" style="font-size:0.85rem;">Kosong Seharian</span>';

            // Teks Status
            let statusHtml = '';
            if (selectedTime === null) {
                statusHtml = '<span class="text-muted">Isi Jam Mulai untuk cek ketersediaan</span>';
            } else if (isAvailable && maxDuration > 0) {
                statusHtml = `<span class="text-success fw-bold">Tersedia (Sisa Maksimal ${maxDuration} Jam)</span>`;
            } else {
                statusHtml = `<span class="text-danger fw-bold">Penuh / Bentrok</span>`;
            }

            // Gabungkan menjadi struktur HTML
            const cardHtml = `
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm h-100 ${isAvailable && selectedTime !== null && maxDuration > 0 ? 'border-success border-2' : (selectedTime !== null ? 'border-danger border-2' : '')}">
                        <div class="card-body">
                            <h5 class="card-title fw-bold">${court.name}</h5>
                            <p class="card-text mb-2">${statusHtml}</p>
                            ${conflictMsg ? `<p class="text-danger mb-2" style="font-size:0.9rem;">${conflictMsg}</p>` : ''}
                            <hr class="my-2">
                            <p class="text-muted mb-1" style="font-size:0.85rem;">Jadwal yang sudah di-booking orang lain:</p>
                            <div>${slotsHtml}</div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += cardHtml;
        });
    }

    // Trigger agar JS jalan otomatis tiap Tanggal/Jam diubah
    dateInput.addEventListener('change', fetchAvailability);
    timeInput.addEventListener('change', fetchAvailability);
});