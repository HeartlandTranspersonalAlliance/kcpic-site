export const site = {
  name: 'Kansas City Psychedelic Integration Circle',
  email: 'info@kcpic.org',
  facebook: 'https://www.facebook.com/groups/kcpsychedelic',
  description: 'A supportive community in Kansas City for sharing and processing psychedelic experiences. Connect at our monthly integration circle.',
};
export const nav = [
  { label: 'About', path: 'about/' },
  { label: 'Meetings', path: 'meetings/' },
  { label: 'Community Resources', path: 'community-resources/' },
  { label: 'Contact', path: 'contact/' },
];
export const href = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
