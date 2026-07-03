import shepherd from '@/assets/backgrounds/shepherd.png.asset.json';
import fellowship from '@/assets/backgrounds/fellowship.jpg';
import worship from '@/assets/backgrounds/worship.jpg';
import scripture from '@/assets/backgrounds/scripture.jpg';
import praise from '@/assets/backgrounds/praise.jpg';

export interface HeroBackground {
  id: string;
  label: string;
  url: string;
}

export const HERO_BACKGROUNDS: HeroBackground[] = [
  { id: 'shepherd',   label: 'Mchungaji & Kondoo', url: shepherd.url },
  { id: 'fellowship', label: 'Ushirika',           url: fellowship },
  { id: 'worship',    label: 'Ibada',              url: worship },
  { id: 'scripture',  label: 'Neno la Mungu',      url: scripture },
  { id: 'praise',     label: 'Sifa & Kuabudu',     url: praise },
];

const STORAGE_KEY = 'tucasa.heroBg';
const AVATAR_KEY  = 'tucasa.avatar';

export const getStoredHeroBg = (): string => {
  if (typeof window === 'undefined') return HERO_BACKGROUNDS[0].id;
  return localStorage.getItem(STORAGE_KEY) || HERO_BACKGROUNDS[0].id;
};
export const setStoredHeroBg = (id: string) => localStorage.setItem(STORAGE_KEY, id);

export const getStoredAvatar = (userId: string): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${AVATAR_KEY}.${userId}`);
};
export const setStoredAvatar = (userId: string, dataUrl: string) =>
  localStorage.setItem(`${AVATAR_KEY}.${userId}`, dataUrl);
