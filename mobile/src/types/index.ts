import { ListingCategory, CrowdStatus } from '../constants/categories';

export interface ListingItem {
  id: string;
  name: string;
  category: ListingCategory;
  description: string;
  address: string;
  district?: string | null;
  town?: string | null;
  locality?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  primaryImage?: string | null;
  locationVerified?: boolean;
  publicationStatus?: string;
  verificationStatus?: string | null;
  images?: Array<{ id: string; url: string; isPrimary?: boolean }> | null;
  ghatDetails?: any;
  ghat?: {
    currentCrowdStatus?: CrowdStatus | null;
    statusUpdatedAt?: string | null;
    facilities?: string[] | null;
    capacity?: number | null;
  } | null;
  freeAccommodation?: {
    availableCapacity?: number | null;
    totalCapacity?: number | null;
    availabilityStatus?: string | null;
    isTemporarilyUnavailable?: boolean | null;
  } | null;
  annadanam?: {
    servingStatus?: string | null;
    sessions?: string[] | null;
    queueWaitMinutes?: number | null;
  } | null;
  hotel?: {
    roomCount?: number | null;
    priceRange?: string | null;
  } | null;
  restaurant?: {
    cuisine?: string | null;
    foodType?: string | null;
    tableCapacity?: number | null;
    reservationAvailable?: boolean | null;
  } | null;
  timingStatus?: {
    code: string;
    label: string;
    detail: string;
    isOpen?: boolean;
  } | null;
  isMock?: boolean;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  description?: string | null;
  badgeText?: string | null;
  destinationUrl?: string | null;
  buttonText?: string | null;
  isMock?: boolean;
}

export interface CarouselBannerItem {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl: string;
  destinationUrl?: string | null;
  ctaLabel?: string | null;
  orderIdx?: number;
}

export interface HeroSettings {
  heroTitle?: string;
  heroSubtitle?: string;
  tagline?: string;
  showStatue?: boolean;
  statueImageUrl?: string;
  statueAlt?: string;
  statueGlow?: boolean;
  statueAlignment?: string;
  searchBarVisible?: boolean;
}

export interface FreeServiceHighlight {
  id: string;
  title: string;
  description?: string | null;
  badgeText?: string | null;
  category: ListingCategory;
  imageUrl?: string | null;
  town?: string | null;
  district?: string | null;
  capacity?: number | null;
}

export interface HomepageData {
  announcements: AnnouncementItem[];
  carouselBanners: CarouselBannerItem[];
  heroSettings?: HeroSettings;
  featuredListings: ListingItem[];
  ghats: ListingItem[];
  freeAccommodationListings: ListingItem[];
  annadanamListings: ListingItem[];
  isLive: boolean;
  apiUrl: string;
  connectionError?: string | null;
}

export interface AuthUser {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  role: string;
  status: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
}

export interface PriorityBookingItem {
  id: string;
  applicationNumber: string;
  category: 'SENIOR_CITIZEN' | 'PERSON_WITH_DISABILITY';
  status: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'CHECKED_IN' | 'CANCELLED' | 'SLOT_ASSIGNED';
  beneficiaryName: string;
  beneficiaryDob?: string | null;
  beneficiaryPhone: string;
  beneficiaryEmail?: string | null;
  visitDate: string;
  accompanyingCount: number;
  accessibilityNeeds?: string | null;
  rejectionReason?: string | null;
  qrPassToken?: string | null;
  qrVerifiedAt?: string | null;
  ghat?: {
    id: string;
    name: string;
    town?: string | null;
    district?: string | null;
    locality?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
  } | null;
  timeSlot?: {
    id: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    status: string;
    accessibilityNotes?: string | null;
  } | null;
}

