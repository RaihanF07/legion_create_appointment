from odoo import http
from odoo.http import request

class BookingController(http.Controller):
    # 1. Menampilkan halaman form booking di website
    @http.route('/booking', type='http', auth='public', website=True)
    def booking_form(self, **kw):
        courts = request.env['product.product'].sudo().search([('type', '=', 'service')])
        return request.render('legion_create_appointment.online_booking_form', {
            'courts': courts,
        })

    # 2. Menangkap data saat tombol 'Konfirmasi Booking' ditekan
    @http.route('/booking/submit', type='http', auth='public', website=True, methods=['POST'], csrf=True)
    def booking_submit(self, **post):
        partner = request.env['res.partner'].sudo().search([('email', '=', post.get('email'))], limit=1)
        if not partner:
            partner = request.env['res.partner'].sudo().create({
                'name': post.get('name'),
                'email': post.get('email'),
                'phone': post.get('phone'),
            })

        time_str = post.get('appointment_time')
        float_time = 0.0
        if time_str:
            hours, minutes = time_str.split(':')
            float_time = float(hours) + float(minutes) / 60.0

        request.env['salon.appointment'].sudo().create({
            'customer': partner.id,
            'contact': post.get('phone'),
            'date': post.get('date'),
            'appointment_time': float_time,
            'duration': int(post.get('duration', 1)),
            'services': int(post.get('court_id')) if post.get('court_id') else False,
        })
        
        return request.render('legion_create_appointment.booking_success')

    # 3. API Pengecekan Ketersediaan Lapangan (Ditembak oleh JavaScript)
    @http.route('/booking/check_availability', type='json', auth='public', website=True)
    def check_availability(self, date=None, **kw):
        if not date:
            return {'status': 'error', 'message': 'Tanggal kosong'}

        # Cari semua produk jasa (lapangan) dan booking di tanggal tersebut
        courts = request.env['product.product'].sudo().search([('type', '=', 'service')])
        bookings = request.env['salon.appointment'].sudo().search([('date', '=', date)])

        # Kelompokkan data jadwal berdasarkan masing-masing lapangan
        booked_data = {}
        for court in courts:
            booked_data[court.id] = {
                'id': court.id,
                'name': court.name,
                'slots': []
            }

        for booking in bookings:
            if booking.services:
                court_id = booking.services.id
                if court_id in booked_data:
                    start_time = booking.appointment_time
                    end_time = start_time + booking.duration
                    booked_data[court_id]['slots'].append({
                        'start': start_time,
                        'end': end_time
                    })

        # Urutkan jadwal dari pagi ke malam
        for c_id in booked_data:
            booked_data[c_id]['slots'] = sorted(booked_data[c_id]['slots'], key=lambda x: x['start'])

        # Kirim balik datanya ke browser dalam wujud JSON
        return {
            'status': 'success',
            'data': list(booked_data.values())
        }