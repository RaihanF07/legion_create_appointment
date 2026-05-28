# -*- coding: utf-8 -*-
{
    "name": "Create Appointment",
    "version": "18.0.0.0.1",
    "author": "Byte Legions",
    "website": "https://bytelegions.com",
    "depends": ["base",'stock','contacts','hr','sale'],
    "license": "AGPL-3",
    'sequence': 10,
    "category": "Tools",
    'company': 'Byte Legions',

    "summary": """This Module used to Create Salon Appointment.""",
    "description": """This Module used to Create Salon Appointment.""",

    "data": [
        'security/ir.model.access.csv',
        'views/create_appo_view.xml',
        'data/data.xml',
        'views/website_booking.xml',
    ],

    'installable': True,
    'application': True,
    'auto_install': False,
    'images': ['static/description/banner.gif'], 
    
}
