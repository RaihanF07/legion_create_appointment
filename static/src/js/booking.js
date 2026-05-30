/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.BookingLapangan = publicWidget.Widget.extend({
    selector: 'form[action="/booking/submit"]',
    
    events: {
        'change #booking_date': '_onDateChange',
        'change #booking_time': '_onTimeChange',
        'change #booking_duration': '_onDurationChange',
        'submit': '_onSubmit', // Deteksi saat form dikirim
    },

    start: function () {
        this.container = this.$el.find('#availability_container');
        this.alertBox = this.$el.find('#booking_alert');
        this.courtSelect = this.$el.find('#court_id_select');
        this.btnSubmit = this.$el.find('#btn_submit_booking');
        this.currentCourtsData = [];
        
        console.log("Widget Booking Lapangan (Odoo 18) Dimuat!");
        return this._super.apply(this, arguments);
    },

    // Mencegah Double Submit
    _onSubmit: function (ev) {
        // Matikan tombol agar tidak bisa di klik 2 kali dan beri tahu bahwa sedang proses
        this.btnSubmit.prop('disabled', true);
        this.btnSubmit.html('<i class="fa fa-spinner fa-spin"></i> Memproses...');
    },

    _onDateChange: async function (ev) {
        const dateVal = ev.currentTarget.value;
        if (!dateVal) {
            this.container.empty();
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
                this.currentCourtsData = result.result.data.filter(court => {
                    let name = court.name.toLowerCase();
                    return name !== 'sewa lapangan padel 2' && name !== 'standard delivery';
                });
                this._updateUI();
            }
        } catch (error) {
            console.error("Gagal menarik data jadwal:", error);
        }
    },

    _onTimeChange: function () {
        this._updateUI();
    },

    _onDurationChange: function () {
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
        let duration = parseInt(this.$el.find('#booking_duration').val() || 1);
        
        this.container.empty(); 
        this.alertBox.addClass('d-none');
        this.courtSelect.html('<option value="">-- Pilih Lapangan --</option>');
        this.btnSubmit.prop('disabled', false);

        if (selectedTime !== null) {
            let endTime = selectedTime + duration;
            if (selectedTime < 8.0 || endTime > 22.0) {
                this.alertBox.html('<strong>Jam di luar operasional!</strong> Lapangan hanya buka dari jam 08:00 hingga 22:00. Silakan kurangi durasi atau majukan jam main.');
                this.alertBox.removeClass('d-none');
                this.btnSubmit.prop('disabled', true);
            }
        }

        let availableCourtsCount = 0;

        this.currentCourtsData.forEach(court => {
            let maxDuration = 4;
            let isAvailable = true;
            let conflictMsg = "";

            if (selectedTime !== null) {
                let hoursUntilClose = 22.0 - selectedTime;
                maxDuration = Math.floor(Math.min(maxDuration, hoursUntilClose));
                if (maxDuration < 0) maxDuration = 0;

                for (let slot of court.slots) {
                    if (selectedTime >= slot.start && selectedTime < slot.end) {
                        isAvailable = false;
                        conflictMsg = `Sedang dipakai: ${this._formatTime(slot.start)} - ${this._formatTime(slot.end)}`;
                        maxDuration = 0;
                        break;
                    }
                    if (selectedTime < slot.start) {
                        let diff = slot.start - selectedTime;
                        if (diff < maxDuration) {
                            maxDuration = Math.floor(diff);
                        }
                    }
                }
            }

            let slotsHtml = court.slots.length > 0 
                ? court.slots.map(s => `<span class="badge bg-secondary me-1 mb-1" style="font-size:0.85rem;">${this._formatTime(s.start)} - ${this._formatTime(s.end)}</span>`).join('')
                : '<span class="badge bg-success" style="font-size:0.85rem;">Kosong Seharian</span>';

            let statusHtml = '';
            let enoughDuration = maxDuration >= duration;
            
            let isWithinOperationalHours = true;
            if (selectedTime !== null) {
                 let endTime = selectedTime + duration;
                 isWithinOperationalHours = (selectedTime >= 8.0 && endTime <= 22.0);
            }

            if (selectedTime === null) {
                statusHtml = '<span class="text-muted">Isi Jam Mulai untuk cek ketersediaan</span>';
            } else if (!isWithinOperationalHours) {
                 statusHtml = `<span class="text-danger fw-bold">Tutup</span>`;
            } else if (isAvailable && maxDuration > 0 && enoughDuration) {
                statusHtml = `<span class="text-success fw-bold">Tersedia (Sisa Maks. ${maxDuration} Jam)</span>`;
                availableCourtsCount++;
                this.courtSelect.append(`<option value="${court.id}">${court.name} (Sisa Maks ${maxDuration} Jam)</option>`);
            } else if (isAvailable && !enoughDuration) {
                statusHtml = `<span class="text-warning fw-bold">Waktu tidak cukup (${maxDuration} Jam)</span>`;
            } else {
                statusHtml = `<span class="text-danger fw-bold">Penuh / Bentrok</span>`;
            }

            const cardHtml = `
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm h-100 ${isAvailable && selectedTime !== null && enoughDuration && isWithinOperationalHours ? 'border-success border-2' : (selectedTime !== null ? 'border-danger border-2' : '')}">
                        <div class="card-body">
                            <h5 class="card-title fw-bold">${court.name}</h5>
                            <p class="card-text mb-2">${statusHtml}</p>
                            ${conflictMsg && isWithinOperationalHours ? `<p class="text-danger mb-2" style="font-size:0.9rem;">${conflictMsg}</p>` : ''}
                            <hr class="my-2">
                            <p class="text-muted mb-1" style="font-size:0.85rem;">Jadwal yang sudah terisi:</p>
                            <div>${slotsHtml}</div>
                        </div>
                    </div>
                </div>
            `;
            this.container.append(cardHtml);
        });

        if (selectedTime !== null && availableCourtsCount === 0 && (selectedTime >= 8.0 && (selectedTime + duration) <= 22.0)) {
            this.alertBox.html('<strong>Maaf!</strong> Tidak ada lapangan yang tersedia dengan durasi tersebut. Silakan geser jam Anda.');
            this.alertBox.removeClass('d-none');
            this.btnSubmit.prop('disabled', true);
        }
    }
});