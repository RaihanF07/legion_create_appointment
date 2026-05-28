from odoo import http
from odoo.http import request

class BookingController(http.Controller):
    # 1. Menampilkan halaman form booking di website
    @http.route('/booking', type='http', auth='public', website=True)
    def booking_form(self, **kw):
        # Tarik data lapangan dari database untuk ditampilkan di pilihan dropdown
        courts = request.env['product.product'].sudo().search([('type', '=', 'service')])
        return request.render('legion_create_appointment.online_booking_form', {
            'courts': courts,
        })

    # 2. Menangkap data saat tombol 'Konfirmasi Booking' ditekan
    @http.route('/booking/submit', type='http', auth='public', website=True, methods=['POST'], csrf=True)
    def booking_submit(self, **post):
        # Cari atau buat data pelanggan otomatis agar tidak error
        partner = request.env['res.partner'].sudo().search([('email', '=', post.get('email'))], limit=1)
        if not partner:
            partner = request.env['res.partner'].sudo().create({
                'name': post.get('name'),
                'email': post.get('email'),
                'phone': post.get('phone'),
            })

        # Konversi format jam (HH:MM) dari HTML web menjadi Float untuk Odoo
        time_str = post.get('appointment_time')
        float_time = 0.0
        if time_str:
            hours, minutes = time_str.split(':')
            float_time = float(hours) + float(minutes) / 60.0

        # Masukkan data ke modul Create Appointment
        request.env['salon.appointment'].sudo().create({
            'customer': partner.id,
            'contact': post.get('phone'),
            'date': post.get('date'), 
            'appointment_time': float_time,
            'duration': int(post.get('duration', 1)), # <-- Tangkap data durasi
            'services': int(post.get('court_id')) if post.get('court_id') else False,
        })
        
        # Arahkan ke halaman sukses
        return request.render('legion_create_appointment.booking_success')