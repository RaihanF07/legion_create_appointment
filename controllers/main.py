from odoo import http
from odoo.http import request

class BookingController(http.Controller):
    @http.route('/booking', type='http', auth='public', website=True)
    def booking_form(self, **kw):
        courts = request.env['product.product'].sudo().search([('type', '=', 'service')])
        return request.render('legion_create_appointment.online_booking_form', {
            'courts': courts,
        })

    @http.route('/booking/submit', type='http', auth='public', website=True, methods=['POST'], csrf=True)
    def booking_submit(self, **post):
        # 1. Cari / Buat Data Pelanggan
        partner = request.env['res.partner'].sudo().search([('email', '=', post.get('email'))], limit=1)
        if not partner:
            partner = request.env['res.partner'].sudo().create({
                'name': post.get('name'),
                'email': post.get('email'),
                'phone': post.get('phone'),
            })

        # 2. Konversi Jam ke Desimal
        time_str = post.get('appointment_time')
        float_time = 0.0
        if time_str:
            hours, minutes = time_str.split(':')
            float_time = float(hours) + float(minutes) / 60.0
        
        duration = int(post.get('duration', 1))
        court_id = int(post.get('court_id')) if post.get('court_id') else False
        date = post.get('date')

        # 3. Validasi Backend (Mencegah Bentrok Jadwal)
        end_time = float_time + duration
        existing_bookings = request.env['salon.appointment'].sudo().search([('date', '=', date), ('services', '=', court_id)])
        
        for b in existing_bookings:
            b_start = b.appointment_time
            b_end = b.appointment_time + b.duration
            if max(float_time, b_start) < min(end_time, b_end):
                return request.render('legion_create_appointment.booking_success', {
                    'error': 'Maaf, jadwal pada jam tersebut menabrak booking orang lain. Silakan pilih jam atau durasi yang lebih aman.'
                })

        # 4. Buat Appointment
        appointment = request.env['salon.appointment'].sudo().create({
            'customer': partner.id,
            'contact': post.get('phone'),
            'date': date,
            'appointment_time': float_time,
            'duration': duration,
            'services': court_id,
            'state': 'draft', # Pastikan state awalnya draft
        })

        # 5. BUAT SALES ORDER
        so_vals = {
            'partner_id': partner.id,
            'origin': str(appointment.id), # Kita simpan ID appointment di origin sebagai kunci penghubung
            'order_line': [(0, 0, {
                'product_id': court_id,
                'product_uom_qty': duration,
            })],
        }
        new_so = request.env['sale.order'].sudo().create(so_vals)
        
        # 6. LANGSUNG KONFIRMASI SO & BUAT INVOICE
        new_so.sudo().action_confirm() # Ubah Quotation jadi Sales Order
        invoice = new_so.sudo()._create_invoices() # Buat Draft Invoice
        invoice.sudo().action_post() # Posting Invoice agar bisa dibayar
        
        # 7. Update status Appointment menjadi confirmed karena SO sudah jalan
        appointment.sudo().write({'state': 'confirm'})

        # 8. LEMPAR KE PORTAL INVOICE (Bukan Quotation)
        # Mengarahkan user ke halaman tagihan spesifik
        portal_url = invoice.get_portal_url()
        return request.redirect(portal_url)

    @http.route('/booking/check_availability', type='json', auth='public', website=True)
    def check_availability(self, date=None, **kw):
        if not date:
            return {'status': 'error', 'message': 'Tanggal kosong'}

        courts = request.env['product.product'].sudo().search([('type', '=', 'service')])
        bookings = request.env['salon.appointment'].sudo().search([('date', '=', date)])

        booked_data = {}
        for court in courts:
            booked_data[court.id] = {'id': court.id, 'name': court.name, 'slots': []}

        for booking in bookings:
            if booking.services:
                c_id = booking.services.id
                if c_id in booked_data:
                    booked_data[c_id]['slots'].append({
                        'start': booking.appointment_time,
                        'end': booking.appointment_time + booking.duration
                    })

        for c_id in booked_data:
            booked_data[c_id]['slots'] = sorted(booked_data[c_id]['slots'], key=lambda x: x['start'])

        return {'status': 'success', 'data': list(booked_data.values())}