{
    'name': 'Create Appointment',
    'version': '18.0.1.0',
    'category': 'Sales',
    'summary': 'Modul custom untuk Booking Lapangan Talvora',
    'depends': ['base', 'mail', 'sale', 'website'],
    'data': [
        'security/ir.model.access.csv',
        'data/data.xml',
        'views/create_appo_view.xml',
        'views/website_booking.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'legion_create_appointment/static/src/js/booking.js',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}