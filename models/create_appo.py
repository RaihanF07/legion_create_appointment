# -*- coding: utf-8 -*-
from odoo import tools, api, models, _, fields
from datetime import datetime, timedelta
from odoo.exceptions import UserError
from odoo.tools import config
from odoo.exceptions import ValidationError
import datetime as dt


class CreateAppointment(models.Model):
    _name = "salon.appointment"

    app_id = fields.Char(string='Appointment ID',
                         required=True,
                         copy=False,
                         readonly=True,
                         default='New')

    customer = fields.Many2one('res.partner', string="Customer")
    contact = fields.Char(string="Contact")
    appointment_time = fields.Float(string='Time')
    duration = fields.Integer(string='Durasi (Jam)', default=1)
    court_id = fields.Many2one(
        'product.product', 
        string='Pilihan Lapangan', 
        domain=[('type', '=', 'service')]
    )

    services = fields.Many2one('product.template', string="Services")
    employee = fields.Many2one('hr.employee', string="Employee")
    date = fields.Date(string="Date")

    state = fields.Selection([('draft', 'Draft'), ('confirm', 'Confirmed'),
                              ('done', 'Done'), ('cancel', 'Cancelled')], default='draft',
                             string="Status", tracking=True)

    def action_confirm(self):
        self.state = 'confirm'

    def action_done(self):
        self.state = 'done'

    def action_draft(self):
        self.state = 'draft'

    def action_cancel(self):
        self.state = 'cancel'

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('app_id', 'New') == 'New':
                vals['app_id'] = self.env['ir.sequence'].next_by_code('salon.appointment') or _('New')
        res = super(CreateAppointment, self).create(vals)
        return res
    
    # Field baru khusus untuk merender Kalender Odoo
    datetime_start = fields.Datetime(string="Mulai (Kalender)", compute='_compute_datetime', store=True)
    datetime_end = fields.Datetime(string="Selesai (Kalender)", compute='_compute_datetime', store=True)

    @api.depends('date', 'appointment_time', 'duration')
    def _compute_datetime(self):
        for record in self:
            if record.date:
                # 1. Pecah nilai desimal menjadi Jam dan Menit
                hours = int(record.appointment_time)
                minutes = int((record.appointment_time - hours) * 60)
                
                # 2. Gabungkan tanggal dan waktu
                start_dt = datetime.combine(record.date, datetime.min.time()) + timedelta(hours=hours, minutes=minutes)
                
                # 3. Konversi ke standar UTC (Database Odoo menggunakan UTC)
                # Karena kita di zona waktu WIB (UTC+7), kita kurangi 7 jam 
                # agar saat tampil di browser kamu jamnya tetap akurat.
                start_dt_utc = start_dt - timedelta(hours=7)
                
                record.datetime_start = start_dt_utc
                record.datetime_end = start_dt_utc + timedelta(hours=record.duration)
            else:
                record.datetime_start = False
                record.datetime_end = False

    def create_invoice_appointment(self): 
        self.ensure_one()
        
        for record in self:
            # 1. Siapkan data untuk Sales Order
            so_vals = {
                'partner_id': record.customer.id,
                'origin': record.app_id, 
                'order_line': [(0, 0, {
                    'product_id': record.services.id,
                    'product_uom_qty': record.duration,
                })],
            }
            
            # 2. Buat eksekusi pembuatan SO di database
            new_so = self.env['sale.order'].sudo().create(so_vals)
            
            # 3. Arahkan layar otomatis membuka dokumen SO yang baru dibuat
            return {
                'type': 'ir.actions.act_window',
                'name': 'Sales Order',
                'res_model': 'sale.order',
                'view_mode': 'form',
                'res_id': new_so.id,
                'target': 'current',
            }
