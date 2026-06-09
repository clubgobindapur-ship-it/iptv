export interface Channel {
  name: string;
  url: string;
  logo: string;
  category: string;
}

export interface Banner {
  id: string;
  bannerURL: string;
  redirection: string;
  title?: string;
  description?: string;
}

export const CATEGORY_ALL = 'All';
export const CATEGORY_FAVORITES = '❤ Favorites';
export const UNCATEGORIZED = 'Uncategorized';
