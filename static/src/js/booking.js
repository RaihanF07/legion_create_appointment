/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.BookingLapangan = publicWidget.Widget.extend({
    // Selector ini akan mencari form booking milikmu di XML
    selector: 'form[action="/booking/submit"]',
    
    // Odoo secara otomatis akan memantau event change pada input ini
    events: {
        'change #booking_date': '_onDateChange',
        'change #booking_time': '_onTimeChange',
    },

    /**
     * Start dipanggil saat elemen berhasil ditemukan oleh Odoo
     */
    start: function () {
        this.container = this.$el.find('#availability_container');
        this.alertBox = this.$el.find('#booking_alert');
        this.courtSelect = this.$el.find('#court_id_select');
        this.currentCourtsData = [];
        
        console.log("Widget Booking Lapangan Berhasil Dimuat!");
        return this._super.apply(this, arguments);
    },

    _onDateChange: async function (ev) {
        const dateVal = ev.currentTarget.value;
        if (!dateVal) {
            this.container.empty();
            return;
        }

        try {
            // Odoo 18 mendukung fetch standar, struktur payload JSON-RPC mu sudah benar
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
                this.currentCourtsData = result.result.data;
                this._updateUI();
            }
        } catch (error) {
            console.error("Gagal menarik data jadwal:", error);
        }
    },

    _onTimeChange: function () {
        this._updateUI();
    },

    _timeToFloat: function (timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
    },

    _formatTime: function (floatTime) {
        const h = Math.floor(floatTime);
        const m = Math.round((floatTime - h) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    },

    _updateUI: function () {
        const timeVal = this.$el.find('#booking_time').val();
        let selectedTime = timeVal ? this._timeToFloat(timeVal) : null;
        
        this.container.empty(); 
        this.alertBox.addClass('d-none');
        this.courtSelect.html('<option value="">-- Pilih Lapangan --</option>');

        let availableCourtsCount = 0;

        this.currentCourtsData.forEach(court => {
            let maxDuration = 4;
            let isAvailable = true;
            let conflictMsg = "";

            if (selectedTime !== null) {
                for (let slot of court.slots) {
                    // Cek jika jam mulai berada di dalam waktu booking orang lain
                    if (selectedTime >= slot.start && selectedTime < slot.end) {
                        isAvailable = false;
                        conflictMsg = `Sedang dipakai: ${this._formatTime(slot.start)} - ${this._formatTime(slot.end)}`;
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
                ? court.slots.map(s => `<span class="badge bg-secondary me-1 mb-1" style="font-size:0.85rem;">${this._formatTime(s.start)} - ${this._formatTime(s.end)}</span>`).join('')
                : '<span class="badge bg-success" style="font-size:0.85rem;">Kosong Seharian</span>';

            let statusHtml = '';
            if (selectedTime === null) {
                statusHtml = '<span class="text-muted">Isi Jam Mulai untuk cek ketersediaan</span>';
            } else if (isAvailable && maxDuration > 0) {
                statusHtml = `<span class="text-success fw-bold">Tersedia (Sisa Maks. ${maxDuration} Jam)</span>`;
                availableCourtsCount++;
                
                // Masukkan ke Select Option
                this.courtSelect.append(`<option value="${court.id}">${court.name} (Sisa Maks ${maxDuration} Jam)</option>`);
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
            this.container.append(cardHtml);
        });

        // Tampilkan Error Alert jika jam tersebut semua lapangan sudah penuh
        if (selectedTime !== null && availableCourtsCount === 0) {
            this.alertBox.html('<strong>Maaf!</strong> Semua lapangan penuh pada jam tersebut. Silakan geser jam Anda.');
            this.alertBox.removeClass('d-none');
        }
    }
});