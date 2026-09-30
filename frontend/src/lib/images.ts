/**
 * Helper to retrieve the high-quality category default image for flash sale events
 */
export const getEventImage = (category?: string, customImage?: string): string => {
  if (customImage && (customImage.startsWith('http') || customImage.startsWith('/'))) {
    return customImage;
  }

  const cat = (category || 'concerts').toLowerCase().trim();

  switch (cat) {
    case 'festivals':
    case 'festival':
      return '/images/events/festivals.jpg';
    case 'theatre':
    case 'theater':
    case 'cinema':
    case 'movie':
    case 'film':
      return '/images/events/cinema.jpg';
    case 'sports':
    case 'sport':
      return '/images/events/sports.jpg';
    case 'comedy':
    case 'standup':
    case 'social':
    case 'community':
    case 'party':
      return '/images/events/social.jpg';
    case 'concerts':
    case 'concert':
    case 'music':
    default:
      return '/images/events/concerts.jpg';
  }
};
