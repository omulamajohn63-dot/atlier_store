"""Official store policy text for the assistant.

Source of truth: the same wording shown to customers on the storefront
(``frontend/src/pages/LegalPage.tsx``). Policy questions must be answered
from here — never from the model's general knowledge.
"""

POLICIES = {
    'shipping': {
        'title': 'Shipping & Delivery',
        'intro': 'Every parcel travels carbon-neutral, from artisan cutting '
                 'to handover. Delivery is calculated by the delivery method '
                 'selected at checkout.',
        'sections': [
            {'heading': 'Delivery options',
             'body': 'Standard delivery is charged at 20% of the cart '
                     'subtotal, while express (Priority Air) delivery carries '
                     'a higher fee. Delivery is complimentary on qualifying '
                     'orders above KES 15,000.',
             'bullets': [
                 'Standard — usually 2–4 working days within major Kenyan counties.',
                 'Express Priority Air — usually 1–2 working days.',
                 'Orders are shipped from our Kenyan fulfillment centre after '
                 'payment or, for pay-on-delivery, at handover.',
             ]},
            {'heading': 'Tracking',
             'body': 'Every order receives a reference code you can track at '
                     'any time from Track Order. Status milestones are shown '
                     'as they are confirmed by our fulfillment team — we '
                     'never invent tracking events.'},
            {'heading': 'Delivery area',
             'body': 'We currently deliver across Kenya. If your county is '
                     'not yet served, we will let you know before dispatch.'},
        ],
    },
    'returns': {
        'title': 'Returns & Exchanges',
        'intro': 'If a piece is not right for you, return it within 30 days '
                 'of delivery for a refund or exchange. Garments must be '
                 'unworn, unwashed, and in their original tissue wrapping.',
        'sections': [
            {'heading': 'How to return',
             'body': 'Contact concierge@modeza-boutique.com within 30 days of '
                     'delivery and we will arrange collection. Refunds to the '
                     'original payment method are issued once the garment '
                     'passes inspection.',
             'bullets': [
                 'M-Pesa and card returns are processed to the account used for payment.',
                 'Cash-on-delivery returns can be refunded to a chosen M-Pesa number.',
                 'Return shipping is complimentary for standard-sized parcels.',
             ]},
            {'heading': 'Exchanges',
             'body': 'Prefer a different size or silhouette? We will prioritise '
                     'an exchange before refunding, subject to availability.'},
            {'heading': 'Exclusions',
             'body': 'Altered garments, underwear, and sale pieces marked '
                     'final are excluded from returns. This does not affect '
                     'your statutory rights.'},
        ],
    },
    'payments': {
        'title': 'Payments',
        'intro': 'All prices are in Kenyan Shillings (KES). The final total '
                 'shown at checkout includes the prevailing value-added tax, '
                 'delivery, and any discount applied.',
        'sections': [
            {'heading': 'Payment methods',
             'body': 'Payment methods available include M-Pesa, card, cash on '
                     'delivery, and pay on delivery.',
             'bullets': [
                 'An order is confirmed when you receive an order number from MODEZA.',
                 'Prices and availability are correct at the time of display '
                 'but may change without notice.',
                 'A confirmed order reserves stock; cancellation is available '
                 'only for pending or confirmed orders.',
             ]},
            {'heading': 'Security',
             'body': 'We will never ask for your M-Pesa PIN or password in '
                     'chat, by phone, or by email. Report any such request to '
                     'concierge@modeza-boutique.com.'},
        ],
    },
    'sizing': {
        'title': 'Sizing & Fit',
        'intro': 'Our garments are made in small batches; sizing can vary '
                 'slightly between pieces.',
        'sections': [
            {'heading': 'Finding your size',
             'body': 'Every product page lists the available sizes and the '
                     'model\u2019s worn size. Compare those measurements with '
                     'a garment you already own before ordering.',
             'bullets': [
                 'Use the product\u2019s size list and fit notes as the source of truth.',
                 'If you are between sizes, size up for a relaxed fit.',
                 'Message us with the product name and your usual size for '
                 'personal advice.',
             ]},
            {'heading': 'Wrong size?',
             'body': 'Exchanges are prioritised before refunds, subject to '
                     'availability — see Returns & Exchanges.'},
        ],
    },
    'contact': {
        'title': 'Contact',
        'intro': 'Our concierge replies during Kenyan business hours.',
        'sections': [
            {'heading': 'Email',
             'body': 'concierge@modeza-boutique.com — orders, returns, and '
                     'product questions.'},
            {'heading': 'Order help',
             'body': 'Have your order number ready; it starts with MDZ and '
                     'appears in your confirmation.'},
        ],
    },
}

TOPICS = ('shipping', 'returns', 'payments', 'sizing', 'contact')

_ALIASES = {
    'delivery': 'shipping',
    'ship': 'shipping',
    'postage': 'shipping',
    'refund': 'returns',
    'return': 'returns',
    'exchange': 'returns',
    'payment': 'payments',
    'mpesa': 'payments',
    'm-pesa': 'payments',
    'card': 'payments',
    'pay': 'payments',
    'size': 'sizing',
    'sizes': 'sizing',
    'fit': 'sizing',
    'help': 'contact',
    'support': 'contact',
    'email': 'contact',
}


def get_store_policy(*, context=None, topic=''):
    key = (topic or '').strip().lower()
    key = _ALIASES.get(key, key)
    if key not in POLICIES:
        return {'error': {'code': 'unknown_topic',
                          'message': 'Available topics: ' + ', '.join(TOPICS)}}
    policy = dict(POLICIES[key])
    policy['topic'] = key
    return policy
