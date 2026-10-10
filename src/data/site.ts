export const site = {
  name: 'Kansas City Psychedelic Integration Circle',
  email: 'info@kcpic.org',
  facebook: 'https://www.facebook.com/groups/kcpsychedelic',
  description:
    'Monthly, confidential, community-led integration circles in Kansas City for reflecting on profound or challenging experiences and bringing their lessons into everyday life.',
};
export const nav = [
  { label: 'About', path: 'about/' },
  { label: 'Meetings', path: 'meetings/' },
  { label: 'Community Resources', path: 'community-resources/' },
  { label: 'Contact', path: 'contact/' },
];
export const href = (path = '') =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
