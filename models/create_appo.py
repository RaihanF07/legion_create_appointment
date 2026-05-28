# -*- coding: utf-8 -*-
from odoo import tools, api, models, _, fields
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
