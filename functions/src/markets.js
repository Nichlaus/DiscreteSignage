export const markets = [
  { id: 'general', name: 'General signage', guide: 'Start with a welcome message, opening hours or a promotion. Add a schedule when the advert should only appear at certain times.' },
  { id: 'food', name: 'Food stall, cafe or restaurant', guide: 'Start with a menu image and prices. Use a second region for specials, then schedule breakfast, lunch or evening promotions. Ordering, POS and order-status screens are planned separately.' },
  { id: 'retail', name: 'Retail or clothing store', guide: 'Show product collections and promotions. Give seasonal campaigns start and end dates, and use your logo to keep the display recognisable.' },
  { id: 'fitness', name: 'Gym or fitness studio', guide: 'Show class timetables, membership offers and announcements. Schedule each advert for the relevant days and hours. Live class-booking integration is not available yet.' },
  { id: 'services', name: 'Salon or service business', guide: 'Show service prices, opening hours and offers. Use a second region for helpful information. Live appointment and queue integrations are not available yet.' },
  { id: 'advertising', name: 'Advertising screen operator', guide: 'Create client records and invite clients to submit adverts. Validate and approve each submission, then add it to a playlist with campaign dates. Playback reports count reported starts, not audience views.' },
];

export const marketFor = id => markets.find(market => market.id === id) ?? markets[0];
