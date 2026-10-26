export type ListingType = 'SALE' | 'RENT';
export type PropertyType =
  'APARTMENT' | 'HOUSE' | 'VILLA' | 'LAND' | 'WORKPLACE';
export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'SOLD' | 'RENTED';
export type HeatingType =
  'COMBI' | 'CENTRAL' | 'FLOOR_HEATING' | 'STOVE' | 'NONE' | 'OTHER';

export type PropertyInput = {
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: PropertyType;
  price: number | string;
  grossAreaM2: number | string;
  netAreaM2?: number | string;
  rooms: number;
  livingRooms: number;
  buildingAge?: number;
  floor?: number;
  totalFloors?: number;
  heatingType?: HeatingType;
  cityId: string;
  districtId: string;
  neighborhoodId: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  isFurnished?: boolean;
  hasBalcony?: boolean;
  hasElevator?: boolean;
  hasParking?: boolean;
  inSite?: boolean;
};

export type Property = {
  id: string;
  agentProfileId: string;
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: PropertyType;
  status: PropertyStatus;
  price: string;
  currency: 'TRY';
  grossAreaM2: string;
  netAreaM2: string | null;
  rooms: number;
  livingRooms: number;
  buildingAge: number | null;
  floor: number | null;
  totalFloors: number | null;
  heatingType: HeatingType | null;
  cityId: string;
  districtId: string;
  neighborhoodId: string;
  city: string;
  district: string;
  neighborhood: string;
  address: string;
  latitude: string;
  longitude: string;
  isFurnished: boolean;
  hasBalcony: boolean;
  hasElevator: boolean;
  hasParking: boolean;
  inSite: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PublicProperty = {
  id: string;
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: PropertyType;
  status: PropertyStatus;
  price: string;
  currency: 'TRY';
  grossAreaM2: string;
  netAreaM2: string | null;
  rooms: number;
  livingRooms: number;
  buildingAge: number | null;
  floor: number | null;
  totalFloors: number | null;
  heatingType: HeatingType | null;
  cityId: string;
  districtId: string;
  neighborhoodId: string;
  city: string;
  district: string;
  neighborhood: string;
  address: string;
  latitude: string;
  longitude: string;
  isFurnished: boolean;
  hasBalcony: boolean;
  hasElevator: boolean;
  hasParking: boolean;
  inSite: boolean;
  createdAt: string;
  coverImageUrl: string | null;
  isFavorite: boolean;
  images?: Array<{
    id: string;
    url: string | null;
    sortOrder: number;
    isCover: boolean;
  }>;
  agent: {
    slug: string;
    companyName: string;
    phone?: string;
    logoUrl?: string | null;
  };
};

export type PropertyPage<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export type PublicPropertyQuery = {
  listingType?: ListingType;
  propertyType?: PropertyType;
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  rooms?: number;
  livingRooms?: number;
  minArea?: number | string;
  maxArea?: number | string;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
};
