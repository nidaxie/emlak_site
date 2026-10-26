/**
 * Standalone API contract for a separate frontend.
 * Dates are ISO strings. Money, area, and coordinates are decimal strings.
 * This file does not import the backend.
 */

export type Role = 'USER' | 'AGENT' | 'ADMIN';

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ListingType = 'SALE' | 'RENT';

export type PropertyType =
  'APARTMENT' | 'HOUSE' | 'VILLA' | 'LAND' | 'WORKPLACE';

export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'SOLD' | 'RENTED';

export type HeatingType =
  'COMBI' | 'CENTRAL' | 'FLOOR_HEATING' | 'STOVE' | 'NONE' | 'OTHER';

export type Currency = 'TRY';

export type FileVisibility = 'PUBLIC' | 'PRIVATE';

export type FileCategory =
  | 'AGENT_LOGO'
  | 'AGENT_TAX_DOCUMENT'
  | 'AGENT_AUTHORIZATION_DOCUMENT'
  | 'PROPERTY_IMAGE';

export type AgentDocumentType = 'TAX_CERTIFICATE' | 'AUTHORIZATION_CERTIFICATE';

export type AuditAction =
  | 'AGENT_APPLICATION_APPROVED'
  | 'AGENT_APPLICATION_REJECTED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'AGENT_PROFILE_ACTIVATED'
  | 'AGENT_PROFILE_DEACTIVATED'
  | 'PROPERTY_DEACTIVATED_BY_ADMIN'
  | 'PROPERTY_DELETED_BY_ADMIN'
  | 'AGENT_DOCUMENT_UPLOADED'
  | 'AGENT_DOCUMENT_REPLACED'
  | 'PROPERTY_IMAGE_DELETED_BY_ADMIN';

export type PropertySort = 'newest' | 'price_asc' | 'price_desc';

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

export type RefreshResponse = LoginResponse;

export interface LogoutResponse {
  ok: true;
}

export type UserProfile = AuthUser;

export interface UpdateUserProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface City {
  id: string;
  name: string;
  code: string | null;
}

export interface District {
  id: string;
  cityId: string;
  name: string;
}

export interface Neighborhood {
  id: string;
  districtId: string;
  name: string;
}

export interface AgentCardSummary {
  slug: string;
  companyName: string;
}

export interface AgentDetailSummary extends AgentCardSummary {
  phone: string;
  logoUrl: string | null;
}

export interface PropertyImage {
  id: string;
  url: string;
  sortOrder: number;
  isCover: boolean;
}

export interface PropertyCard {
  id: string;
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: PropertyType;
  status: PropertyStatus;
  price: string;
  currency: Currency;
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
  agent: AgentCardSummary;
}

export interface PropertyDetail extends Omit<PropertyCard, 'agent'> {
  images: PropertyImage[];
  agent: AgentDetailSummary;
}

export interface PublicPropertyListQuery extends PageQuery {
  listingType?: ListingType;
  propertyType?: PropertyType;
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: string;
  maxPrice?: string;
  rooms?: number;
  livingRooms?: number;
  minArea?: string;
  maxArea?: string;
  sort?: PropertySort;
}

export type AgentPropertyListQuery = PublicPropertyListQuery;

export type FavoriteListResponse = PaginatedResponse<PropertyCard>;

export interface FavoriteMutationResponse {
  propertyId: string;
  createdAt: string;
}

export interface FavoriteRemovalResponse {
  propertyId: string;
}

export interface PropertyRecord {
  id: string;
  agentProfileId: string;
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: PropertyType;
  status: PropertyStatus;
  price: string;
  currency: Currency;
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
  images?: PropertyImage[];
}

export interface OwnerPropertyDetail extends PropertyRecord {
  images: PropertyImage[];
}

export interface CreatePropertyRequest {
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: PropertyType;
  price: string;
  grossAreaM2: string;
  netAreaM2?: string;
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
  latitude: string;
  longitude: string;
  isFurnished?: boolean;
  hasBalcony?: boolean;
  hasElevator?: boolean;
  hasParking?: boolean;
  inSite?: boolean;
}

export type UpdatePropertyRequest = Partial<CreatePropertyRequest>;

export interface UpdatePropertyStatusRequest {
  status: PropertyStatus;
}

export interface DeletePropertyResponse {
  id: string;
  deletedAt: string;
}

export interface MyPropertyListQuery extends PageQuery {
  status?: PropertyStatus;
}

export interface UploadedPropertyImage extends PropertyImage {
  createdAt: string;
}

export interface PropertyImageOrderRequest {
  imageIds: string[];
}

export interface PropertyImageOrderResponse {
  imageIds: string[];
}

export interface PropertyCoverResponse {
  id: string;
  isCover: true;
}

export interface DeletedPropertyImageResponse {
  id: string;
}

export interface AgentPublicProfile {
  slug: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  description: string | null;
  logoUrl: string | null;
}

export interface AgentProfile extends AgentPublicProfile {
  id: string;
  taxNumber: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAgentProfileRequest {
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
}

export interface AgentLogoResponse {
  logoUrl: string;
}

export interface AgentApplication {
  id: string;
  status: ApplicationStatus;
  companyName: string;
  authorizedFirstName: string;
  authorizedLastName: string;
  phone: string;
  email: string;
  taxNumber: string;
  city: string;
  district: string;
  address: string;
  description: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentApplicationRequest {
  companyName: string;
  authorizedFirstName: string;
  authorizedLastName: string;
  phone: string;
  email: string;
  taxNumber: string;
  city: string;
  district: string;
  address: string;
  description?: string;
}

export type UpdateAgentApplicationRequest =
  Partial<CreateAgentApplicationRequest>;

export interface AgentApplicationDocument {
  id: string;
  documentType: AgentDocumentType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface UploadedAgentDocument {
  id: string;
  documentType: AgentDocumentType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadAgentDocumentFields {
  documentType: AgentDocumentType;
}

export interface ActiveStatusRequest {
  isActive: boolean;
}

export interface ActiveStatusResponse {
  id: string;
  isActive: boolean;
}

export interface ModerationReasonRequest {
  reason: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUser {
  updatedAt: string;
  agentProfile: {
    id: string;
    slug: string;
    companyName: string;
    isActive: boolean;
    city: string;
    district: string;
  } | null;
}

export interface AdminUserListQuery extends PageQuery {
  role?: Role;
  isActive?: 'true' | 'false';
  email?: string;
}

export interface AdminAgentListItem {
  id: string;
  slug: string;
  companyName: string;
  city: string;
  district: string;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
  };
}

export interface AdminAgent extends AgentProfile {
  userId: string;
  user: AdminUser;
}

export interface AdminAgentListQuery extends PageQuery {
  isActive?: 'true' | 'false';
  companyName?: string;
  city?: string;
  district?: string;
}

export interface AdminAgentApplicationListItem {
  id: string;
  status: ApplicationStatus;
  companyName: string;
  city: string;
  district: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
  };
}

export interface AdminAgentApplication extends AgentApplication {
  userId: string;
  reviewedById: string | null;
  user: AdminUser;
}

export interface AdminAgentApplicationListQuery extends PageQuery {
  status?: ApplicationStatus;
}

export interface AgentApplicationApproval {
  application: {
    id: string;
    status: ApplicationStatus;
    userId: string;
    reviewedById: string | null;
    reviewedAt: string;
    companyName: string;
  };
  profile: {
    id: string;
    userId: string;
    slug: string;
    companyName: string;
    isActive: boolean;
  };
  user: {
    id: string;
    role: Role;
  };
}

export interface AgentApplicationRejection {
  id: string;
  status: ApplicationStatus;
  userId: string;
  companyName: string;
  rejectionReason: string;
  reviewedById: string | null;
  reviewedAt: string;
}

export interface AdminPropertyListAgent {
  id: string;
  slug: string;
  companyName: string;
  isActive: boolean;
  user: {
    id: string;
    role: Role;
    isActive: boolean;
  };
}

export interface AdminPropertyDetailAgent {
  id: string;
  slug: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
  };
}

export interface AdminProperty extends PropertyRecord {
  agent: AdminPropertyListAgent;
}

export interface AdminPropertyDetail extends PropertyRecord {
  agent: AdminPropertyDetailAgent;
  images: PropertyImage[];
}

export interface AdminPropertyListQuery extends PageQuery {
  status?: PropertyStatus;
  listingType?: ListingType;
  city?: string;
  deleted?: 'true' | 'false';
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListQuery extends PageQuery {
  entityType?: string;
  entityId?: string;
}

export interface HealthResponse {
  status: 'ok';
  checks: {
    database: 'up';
    postgis: 'up';
  };
}
