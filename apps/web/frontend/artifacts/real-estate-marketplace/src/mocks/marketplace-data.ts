import type {
  AgentPublicProfile,
  City,
  District,
  HeatingType,
  ListingType,
  Neighborhood,
  PaginatedResponse,
  PropertyDetail,
  PropertyType,
} from '@/types/api';

export const mockCities: City[] = [
  { id: 'city-34', name: 'İstanbul', code: '34' },
  { id: 'city-06', name: 'Ankara', code: '06' },
  { id: 'city-35', name: 'İzmir', code: '35' },
  { id: 'city-07', name: 'Antalya', code: '07' },
  { id: 'city-16', name: 'Bursa', code: '16' },
  { id: 'city-48', name: 'Muğla', code: '48' },
];

export const mockDistricts: District[] = [
  { id: 'district-kadikoy', cityId: 'city-34', name: 'Kadıköy' },
  { id: 'district-besiktas', cityId: 'city-34', name: 'Beşiktaş' },
  { id: 'district-uskudar', cityId: 'city-34', name: 'Üsküdar' },
  { id: 'district-beykoz', cityId: 'city-34', name: 'Beykoz' },
  { id: 'district-sisli', cityId: 'city-34', name: 'Şişli' },
  { id: 'district-cankaya', cityId: 'city-06', name: 'Çankaya' },
  { id: 'district-yenimahalle', cityId: 'city-06', name: 'Yenimahalle' },
  { id: 'district-karsiyaka', cityId: 'city-35', name: 'Karşıyaka' },
  { id: 'district-urla', cityId: 'city-35', name: 'Urla' },
  { id: 'district-konak', cityId: 'city-35', name: 'Konak' },
  { id: 'district-muratpasa', cityId: 'city-07', name: 'Muratpaşa' },
  { id: 'district-konyaalti', cityId: 'city-07', name: 'Konyaaltı' },
  { id: 'district-nilufer', cityId: 'city-16', name: 'Nilüfer' },
  { id: 'district-bodrum', cityId: 'city-48', name: 'Bodrum' },
];

export const mockNeighborhoods: Neighborhood[] = [
  { id: 'neighborhood-moda', districtId: 'district-kadikoy', name: 'Moda' },
  { id: 'neighborhood-caddebostan', districtId: 'district-kadikoy', name: 'Caddebostan' },
  { id: 'neighborhood-acibadem', districtId: 'district-kadikoy', name: 'Acıbadem' },
  { id: 'neighborhood-etiler', districtId: 'district-besiktas', name: 'Etiler' },
  { id: 'neighborhood-kuzguncuk', districtId: 'district-uskudar', name: 'Kuzguncuk' },
  { id: 'neighborhood-riva', districtId: 'district-beykoz', name: 'Riva' },
  { id: 'neighborhood-bomonti', districtId: 'district-sisli', name: 'Bomonti' },
  { id: 'neighborhood-oran', districtId: 'district-cankaya', name: 'Oran' },
  { id: 'neighborhood-bahcelievler', districtId: 'district-cankaya', name: 'Bahçelievler' },
  { id: 'neighborhood-yasamkent', districtId: 'district-cankaya', name: 'Yaşamkent' },
  { id: 'neighborhood-cukurambar', districtId: 'district-cankaya', name: 'Çukurambar' },
  { id: 'neighborhood-batikent', districtId: 'district-yenimahalle', name: 'Batıkent' },
  { id: 'neighborhood-bostanli', districtId: 'district-karsiyaka', name: 'Bostanlı' },
  { id: 'neighborhood-mavisehir', districtId: 'district-karsiyaka', name: 'Mavişehir' },
  { id: 'neighborhood-alaybey', districtId: 'district-karsiyaka', name: 'Alaybey' },
  { id: 'neighborhood-urla-iskele', districtId: 'district-urla', name: 'İskele' },
  { id: 'neighborhood-alsancak', districtId: 'district-konak', name: 'Alsancak' },
  { id: 'neighborhood-lara', districtId: 'district-muratpasa', name: 'Lara' },
  { id: 'neighborhood-guzeloba', districtId: 'district-muratpasa', name: 'Güzeloba' },
  { id: 'neighborhood-uncali', districtId: 'district-konyaalti', name: 'Uncalı' },
  { id: 'neighborhood-odunluk', districtId: 'district-nilufer', name: 'Odunluk' },
  { id: 'neighborhood-gorukle', districtId: 'district-nilufer', name: 'Görükle' },
  { id: 'neighborhood-yalikavak', districtId: 'district-bodrum', name: 'Yalıkavak' },
  { id: 'neighborhood-gundogan', districtId: 'district-bodrum', name: 'Gündoğan' },
];

export const mockAgents: AgentPublicProfile[] = [
  {
    slug: 'marmara-evim',
    companyName: 'Marmara Evim Gayrimenkul',
    phone: '+90 216 555 14 34',
    email: 'merhaba@marmaraevim.example',
    city: 'İstanbul',
    district: 'Kadıköy',
    description:
      'İstanbul ve Bursa’da konut alım satım ve kiralama süreçlerinde yerel uzmanlık sunan bağımsız bir danışmanlık ofisi.',
    logoUrl: null,
  },
  {
    slug: 'baskent-portfoy',
    companyName: 'Başkent Portföy',
    phone: '+90 312 555 06 26',
    email: 'ofis@baskentportfoy.example',
    city: 'Ankara',
    district: 'Çankaya',
    description:
      'Ankara’nın merkezi mahallelerinde satılık ve kiralık konut portföyüyle hizmet veren örnek emlak ofisi.',
    logoUrl: null,
  },
  {
    slug: 'ege-yasam',
    companyName: 'Ege Yaşam Emlak',
    phone: '+90 232 555 35 48',
    email: 'iletisim@egeyasam.example',
    city: 'İzmir',
    district: 'Karşıyaka',
    description:
      'İzmir ve Muğla çevresindeki yaşam alanları için bölge bilgisi ve şeffaf danışmanlık sunan örnek ekip.',
    logoUrl: null,
  },
  {
    slug: 'akdeniz-anahtar',
    companyName: 'Akdeniz Anahtar Gayrimenkul',
    phone: '+90 242 555 07 07',
    email: 'bilgi@akdenizanahtar.example',
    city: 'Antalya',
    district: 'Muratpaşa',
    description:
      'Antalya’da aile konutları ve sahil yaşamına yönelik kiralık ve satılık seçenekler sunan örnek emlak ofisi.',
    logoUrl: null,
  },
];

type ListingLocation = Pick<
  PropertyDetail,
  | 'cityId'
  | 'districtId'
  | 'neighborhoodId'
  | 'city'
  | 'district'
  | 'neighborhood'
>;

const locations = {
  moda: {
    cityId: 'city-34', districtId: 'district-kadikoy', neighborhoodId: 'neighborhood-moda',
    city: 'İstanbul', district: 'Kadıköy', neighborhood: 'Moda',
  },
  caddebostan: {
    cityId: 'city-34', districtId: 'district-kadikoy', neighborhoodId: 'neighborhood-caddebostan',
    city: 'İstanbul', district: 'Kadıköy', neighborhood: 'Caddebostan',
  },
  acibadem: {
    cityId: 'city-34', districtId: 'district-kadikoy', neighborhoodId: 'neighborhood-acibadem',
    city: 'İstanbul', district: 'Kadıköy', neighborhood: 'Acıbadem',
  },
  etiler: {
    cityId: 'city-34', districtId: 'district-besiktas', neighborhoodId: 'neighborhood-etiler',
    city: 'İstanbul', district: 'Beşiktaş', neighborhood: 'Etiler',
  },
  kuzguncuk: {
    cityId: 'city-34', districtId: 'district-uskudar', neighborhoodId: 'neighborhood-kuzguncuk',
    city: 'İstanbul', district: 'Üsküdar', neighborhood: 'Kuzguncuk',
  },
  riva: {
    cityId: 'city-34', districtId: 'district-beykoz', neighborhoodId: 'neighborhood-riva',
    city: 'İstanbul', district: 'Beykoz', neighborhood: 'Riva',
  },
  bomonti: {
    cityId: 'city-34', districtId: 'district-sisli', neighborhoodId: 'neighborhood-bomonti',
    city: 'İstanbul', district: 'Şişli', neighborhood: 'Bomonti',
  },
  oran: {
    cityId: 'city-06', districtId: 'district-cankaya', neighborhoodId: 'neighborhood-oran',
    city: 'Ankara', district: 'Çankaya', neighborhood: 'Oran',
  },
  bahcelievler: {
    cityId: 'city-06', districtId: 'district-cankaya', neighborhoodId: 'neighborhood-bahcelievler',
    city: 'Ankara', district: 'Çankaya', neighborhood: 'Bahçelievler',
  },
  yasamkent: {
    cityId: 'city-06', districtId: 'district-cankaya', neighborhoodId: 'neighborhood-yasamkent',
    city: 'Ankara', district: 'Çankaya', neighborhood: 'Yaşamkent',
  },
  cukurambar: {
    cityId: 'city-06', districtId: 'district-cankaya', neighborhoodId: 'neighborhood-cukurambar',
    city: 'Ankara', district: 'Çankaya', neighborhood: 'Çukurambar',
  },
  batikent: {
    cityId: 'city-06', districtId: 'district-yenimahalle', neighborhoodId: 'neighborhood-batikent',
    city: 'Ankara', district: 'Yenimahalle', neighborhood: 'Batıkent',
  },
  bostanli: {
    cityId: 'city-35', districtId: 'district-karsiyaka', neighborhoodId: 'neighborhood-bostanli',
    city: 'İzmir', district: 'Karşıyaka', neighborhood: 'Bostanlı',
  },
  mavisehir: {
    cityId: 'city-35', districtId: 'district-karsiyaka', neighborhoodId: 'neighborhood-mavisehir',
    city: 'İzmir', district: 'Karşıyaka', neighborhood: 'Mavişehir',
  },
  alaybey: {
    cityId: 'city-35', districtId: 'district-karsiyaka', neighborhoodId: 'neighborhood-alaybey',
    city: 'İzmir', district: 'Karşıyaka', neighborhood: 'Alaybey',
  },
  urla: {
    cityId: 'city-35', districtId: 'district-urla', neighborhoodId: 'neighborhood-urla-iskele',
    city: 'İzmir', district: 'Urla', neighborhood: 'İskele',
  },
  alsancak: {
    cityId: 'city-35', districtId: 'district-konak', neighborhoodId: 'neighborhood-alsancak',
    city: 'İzmir', district: 'Konak', neighborhood: 'Alsancak',
  },
  lara: {
    cityId: 'city-07', districtId: 'district-muratpasa', neighborhoodId: 'neighborhood-lara',
    city: 'Antalya', district: 'Muratpaşa', neighborhood: 'Lara',
  },
  guzeloba: {
    cityId: 'city-07', districtId: 'district-muratpasa', neighborhoodId: 'neighborhood-guzeloba',
    city: 'Antalya', district: 'Muratpaşa', neighborhood: 'Güzeloba',
  },
  uncali: {
    cityId: 'city-07', districtId: 'district-konyaalti', neighborhoodId: 'neighborhood-uncali',
    city: 'Antalya', district: 'Konyaaltı', neighborhood: 'Uncalı',
  },
  odunluk: {
    cityId: 'city-16', districtId: 'district-nilufer', neighborhoodId: 'neighborhood-odunluk',
    city: 'Bursa', district: 'Nilüfer', neighborhood: 'Odunluk',
  },
  gorukle: {
    cityId: 'city-16', districtId: 'district-nilufer', neighborhoodId: 'neighborhood-gorukle',
    city: 'Bursa', district: 'Nilüfer', neighborhood: 'Görükle',
  },
  yalikavak: {
    cityId: 'city-48', districtId: 'district-bodrum', neighborhoodId: 'neighborhood-yalikavak',
    city: 'Muğla', district: 'Bodrum', neighborhood: 'Yalıkavak',
  },
  gundogan: {
    cityId: 'city-48', districtId: 'district-bodrum', neighborhoodId: 'neighborhood-gundogan',
    city: 'Muğla', district: 'Bodrum', neighborhood: 'Gündoğan',
  },
} satisfies Record<string, ListingLocation>;

type ListingSeed = {
  id: string;
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: PropertyType;
  price: string;
  grossAreaM2: string;
  netAreaM2?: string | null;
  rooms: number;
  livingRooms: number;
  buildingAge?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  heatingType?: HeatingType | null;
  address: string;
  latitude: string;
  longitude: string;
  isFurnished?: boolean;
  hasBalcony?: boolean;
  hasElevator?: boolean;
  hasParking?: boolean;
  inSite?: boolean;
  location: ListingLocation;
  agentSlug: string;
  daysAgo: number;
  photoIndex: number;
};

const photoIds = [
  'photo-1600596542815-ffad4c1539a9',
  'photo-1600607687939-ce8a6c25118c',
  'photo-1600566753086-00f18fb6b3ea',
  'photo-1600585154340-be6161a56a0c',
  'photo-1600047509807-ba8f99d2cdde',
  'photo-1600566752355-35792bedcfea',
  'photo-1600585154526-990dced4db0d',
  'photo-1600573472550-8090b5e0745f',
  'photo-1600566753376-12c8ab7fb75b',
  'photo-1600607687644-c7171b42498f',
  'photo-1600607688969-a5bfcd646154',
  'photo-1600566753190-17f0baa2a6c3',
];

const imageUrl = (index: number, width = 1200) =>
  `https://images.unsplash.com/${photoIds[index % photoIds.length]}?auto=format&fit=crop&w=${width}&q=82`;

const daysAgo = (count: number) => {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date.toISOString();
};

const agentBySlug = Object.fromEntries(
  mockAgents.map((agent) => [agent.slug, agent]),
) as Record<string, AgentPublicProfile>;

const listingSeeds: ListingSeed[] = [
  {
    id: 'mock-property-001', title: 'Moda’da geniş balkonlu, yenilenmiş 3+1 daire',
    description: 'Moda’nın sakin bir sokağında, gün ışığı alan ve yakın zamanda yenilenen ferah daire. Sahile, çarşıya ve toplu ulaşıma yürüme mesafesindedir.',
    listingType: 'SALE', propertyType: 'APARTMENT', price: '18950000.00', grossAreaM2: '142.00', netAreaM2: '126.00', rooms: 3, livingRooms: 1, buildingAge: 12, floor: 4, totalFloors: 6, heatingType: 'COMBI',
    address: 'Moda Caddesi No: 24, Kadıköy', latitude: '40.985400', longitude: '29.027100', isFurnished: false, hasBalcony: true, hasElevator: true, hasParking: false, inSite: false,
    location: locations.moda, agentSlug: 'marmara-evim', daysAgo: 1, photoIndex: 0,
  },
  {
    id: 'mock-property-002', title: 'Caddebostan sahile yakın eşyalı kiralık daire',
    description: 'Bakımlı binada, açık plan mutfaklı ve eşyalı kiralık daire. Sahil parkına ve marketlere kısa yürüyüş mesafesindedir.',
    listingType: 'RENT', propertyType: 'APARTMENT', price: '62500.00', grossAreaM2: '118.00', netAreaM2: '104.00', rooms: 2, livingRooms: 1, buildingAge: 8, floor: 3, totalFloors: 8, heatingType: 'COMBI',
    address: 'Bağdat Caddesi No: 318, Kadıköy', latitude: '40.963900', longitude: '29.064100', isFurnished: true, hasBalcony: true, hasElevator: true, hasParking: true, inSite: true,
    location: locations.caddebostan, agentSlug: 'marmara-evim', daysAgo: 2, photoIndex: 1,
  },
  {
    id: 'mock-property-003', title: 'Etiler’de özel bahçeli müstakil villa',
    description: 'Geniş bahçesi, kapalı otoparkı ve ayrı çalışma odası bulunan müstakil villa. Aile yaşamına uygun, bakımlı bir portföy örneğidir.',
    listingType: 'SALE', propertyType: 'VILLA', price: '78500000.00', grossAreaM2: '365.00', netAreaM2: '318.00', rooms: 5, livingRooms: 2, buildingAge: 9, floor: 0, totalFloors: 3, heatingType: 'FLOOR_HEATING',
    address: 'Nispetiye Mahallesi No: 18, Beşiktaş', latitude: '41.078500', longitude: '29.045400', hasBalcony: true, hasElevator: false, hasParking: true, inSite: false,
    location: locations.etiler, agentSlug: 'marmara-evim', daysAgo: 4, photoIndex: 2,
  },
  {
    id: 'mock-property-004', title: 'Bomonti’de metroya yakın modern kiralık 2+1',
    description: 'Yeni binada, kullanışlı planlı kiralık daire. Metro ve günlük ihtiyaç noktalarına yakındır; açık mutfak ve balkon bulunur.',
    listingType: 'RENT', propertyType: 'APARTMENT', price: '48500.00', grossAreaM2: '96.00', netAreaM2: '82.00', rooms: 2, livingRooms: 1, buildingAge: 4, floor: 7, totalFloors: 12, heatingType: 'COMBI',
    address: 'Silahşör Caddesi No: 11, Şişli', latitude: '41.056800', longitude: '28.985500', hasBalcony: true, hasElevator: true, hasParking: true, inSite: true,
    location: locations.bomonti, agentSlug: 'marmara-evim', daysAgo: 5, photoIndex: 3,
  },
  {
    id: 'mock-property-005', title: 'Kuzguncuk’ta restore edilmiş tarihi müstakil ev',
    description: 'Kuzguncuk dokusuna uygun şekilde yenilenmiş, avlulu ve yüksek tavanlı müstakil ev. Sahil hattına ve semt pazarına yakındır.',
    listingType: 'SALE', propertyType: 'HOUSE', price: '24750000.00', grossAreaM2: '205.00', netAreaM2: '176.00', rooms: 4, livingRooms: 1, buildingAge: 45, floor: 0, totalFloors: 2, heatingType: 'COMBI',
    address: 'İcadiye Caddesi No: 37, Üsküdar', latitude: '41.034500', longitude: '29.030100', hasBalcony: true, hasElevator: false, hasParking: false, inSite: false,
    location: locations.kuzguncuk, agentSlug: 'marmara-evim', daysAgo: 7, photoIndex: 4,
  },
  {
    id: 'mock-property-006', title: 'Riva’da doğa içinde imarlı konut arsası',
    description: 'Yerleşim alanına yakın, konut imarlı arsa örneği. İmar ve tapu bilgileri demo amaçlıdır; gerçek işlem öncesinde resmî kayıtlar doğrulanmalıdır.',
    listingType: 'SALE', propertyType: 'LAND', price: '13800000.00', grossAreaM2: '510.00', netAreaM2: null, rooms: 0, livingRooms: 0, buildingAge: null, floor: null, totalFloors: null, heatingType: null,
    address: 'Çayağzı Yolu No: 6, Beykoz', latitude: '41.207700', longitude: '29.273200', hasBalcony: false, hasElevator: false, hasParking: false, inSite: false,
    location: locations.riva, agentSlug: 'marmara-evim', daysAgo: 9, photoIndex: 5,
  },
  {
    id: 'mock-property-007', title: 'Oran’da güvenlikli sitede manzaralı 4+1',
    description: 'Geniş salonu, kapalı otoparkı ve site sosyal alanları bulunan aile dairesi. Güney cepheli odaları gün boyunca doğal ışık alır.',
    listingType: 'SALE', propertyType: 'APARTMENT', price: '14250000.00', grossAreaM2: '198.00', netAreaM2: '172.00', rooms: 4, livingRooms: 1, buildingAge: 6, floor: 10, totalFloors: 18, heatingType: 'CENTRAL',
    address: 'Kudüs Caddesi No: 52, Çankaya', latitude: '39.849200', longitude: '32.823700', hasBalcony: true, hasElevator: true, hasParking: true, inSite: true,
    location: locations.oran, agentSlug: 'baskent-portfoy', daysAgo: 1, photoIndex: 6,
  },
  {
    id: 'mock-property-008', title: 'Bahçelievler’de metroya yakın kiralık 3+1',
    description: 'Aydınlık odaları ve ayrı mutfağı bulunan bakımlı daire. Üniversitelere, metroya ve semt içi alışveriş noktalarına kolay ulaşım sağlar.',
    listingType: 'RENT', propertyType: 'APARTMENT', price: '36500.00', grossAreaM2: '132.00', netAreaM2: '116.00', rooms: 3, livingRooms: 1, buildingAge: 18, floor: 2, totalFloors: 5, heatingType: 'COMBI',
    address: 'Aşkabat Caddesi No: 9, Çankaya', latitude: '39.920800', longitude: '32.818200', hasBalcony: true, hasElevator: true, hasParking: false, inSite: false,
    location: locations.bahcelievler, agentSlug: 'baskent-portfoy', daysAgo: 3, photoIndex: 7,
  },
  {
    id: 'mock-property-009', title: 'Batıkent’te aile yaşamına uygun 3+1 daire',
    description: 'Toplu ulaşıma ve parka yakın, kullanışlı planlı daire. Kapalı mutfak, balkon ve açık otopark imkânı vardır.',
    listingType: 'SALE', propertyType: 'APARTMENT', price: '6950000.00', grossAreaM2: '126.00', netAreaM2: '111.00', rooms: 3, livingRooms: 1, buildingAge: 14, floor: 5, totalFloors: 9, heatingType: 'COMBI',
    address: 'Başkent Bulvarı No: 74, Yenimahalle', latitude: '39.967900', longitude: '32.731500', hasBalcony: true, hasElevator: true, hasParking: true, inSite: true,
    location: locations.batikent, agentSlug: 'baskent-portfoy', daysAgo: 6, photoIndex: 8,
  },
  {
    id: 'mock-property-010', title: 'Yaşamkent’te geniş teraslı müstakil villa',
    description: 'Bahçeli, geniş teraslı ve kapalı garajlı villa. Isı yalıtımı, yerden ısıtma ve ebeveyn banyosu gibi özelliklerle tasarlanmıştır.',
    listingType: 'SALE', propertyType: 'VILLA', price: '26800000.00', grossAreaM2: '322.00', netAreaM2: '281.00', rooms: 5, livingRooms: 2, buildingAge: 3, floor: 0, totalFloors: 3, heatingType: 'FLOOR_HEATING',
    address: '3220. Cadde No: 16, Çankaya', latitude: '39.873100', longitude: '32.695300', hasBalcony: true, hasElevator: false, hasParking: true, inSite: true,
    location: locations.yasamkent, agentSlug: 'baskent-portfoy', daysAgo: 8, photoIndex: 9,
  },
  {
    id: 'mock-property-011', title: 'Çukurambar’da ofis kullanımına uygun geniş daire',
    description: 'Merkezi konumu ve ayrı odalarıyla konut ya da ofis kullanımı için değerlendirilebilecek geniş bir portföy örneği.',
    listingType: 'SALE', propertyType: 'WORKPLACE', price: '15750000.00', grossAreaM2: '214.00', netAreaM2: '187.00', rooms: 5, livingRooms: 0, buildingAge: 10, floor: 3, totalFloors: 10, heatingType: 'CENTRAL',
    address: 'Dumlupınar Bulvarı No: 31, Çankaya', latitude: '39.906300', longitude: '32.810900', hasBalcony: false, hasElevator: true, hasParking: true, inSite: true,
    location: locations.cukurambar, agentSlug: 'baskent-portfoy', daysAgo: 10, photoIndex: 10,
  },
  {
    id: 'mock-property-012', title: 'Bostanlı’da gün ışığı alan balkonlu 3+1',
    description: 'Vapur iskelesine, sahil yürüyüş yoluna ve çarşıya yakın daire. Ayrı mutfak, balkon ve kapalı otopark avantajı sunar.',
    listingType: 'SALE', propertyType: 'APARTMENT', price: '15300000.00', grossAreaM2: '164.00', netAreaM2: '143.00', rooms: 3, livingRooms: 1, buildingAge: 7, floor: 6, totalFloors: 10, heatingType: 'COMBI',
    address: 'Cemal Gürsel Caddesi No: 88, Karşıyaka', latitude: '38.455500', longitude: '27.102500', hasBalcony: true, hasElevator: true, hasParking: true, inSite: false,
    location: locations.bostanli, agentSlug: 'ege-yasam', daysAgo: 1, photoIndex: 11,
  },
  {
    id: 'mock-property-013', title: 'Mavişehir’de deniz manzaralı kiralık 3+1',
    description: 'Site içinde, deniz manzaralı ve bakımlı kiralık daire. Güvenlik, kapalı otopark ve ortak kullanım alanları bulunur.',
    listingType: 'RENT', propertyType: 'APARTMENT', price: '58500.00', grossAreaM2: '152.00', netAreaM2: '132.00', rooms: 3, livingRooms: 1, buildingAge: 5, floor: 11, totalFloors: 20, heatingType: 'CENTRAL',
    address: 'Cahar Dudayev Bulvarı No: 42, Karşıyaka', latitude: '38.470900', longitude: '27.076300', hasBalcony: true, hasElevator: true, hasParking: true, inSite: true,
    location: locations.mavisehir, agentSlug: 'ege-yasam', daysAgo: 2, photoIndex: 0,
  },
  {
    id: 'mock-property-014', title: 'Urla İskele’de bahçeli taş ev',
    description: 'Bahçesi ve geniş verandası olan taş ev. Sahil ve yerel üretici pazarlarına yakın konumdadır; yazlık veya sürekli yaşam için uygundur.',
    listingType: 'SALE', propertyType: 'HOUSE', price: '32750000.00', grossAreaM2: '238.00', netAreaM2: '204.00', rooms: 4, livingRooms: 1, buildingAge: 16, floor: 0, totalFloors: 2, heatingType: 'COMBI',
    address: 'Mithatpaşa Caddesi No: 13, Urla', latitude: '38.361500', longitude: '26.765700', hasBalcony: true, hasElevator: false, hasParking: true, inSite: false,
    location: locations.urla, agentSlug: 'ege-yasam', daysAgo: 4, photoIndex: 1,
  },
  {
    id: 'mock-property-015', title: 'Alsancak’ta cadde cepheli kiralık işyeri',
    description: 'Yaya trafiği yüksek bir noktada bulunan, vitrinli ve kullanıma hazır ticari alan. Farklı işletme türlerine göre düzenlenebilir.',
    listingType: 'RENT', propertyType: 'WORKPLACE', price: '52000.00', grossAreaM2: '104.00', netAreaM2: '92.00', rooms: 2, livingRooms: 0, buildingAge: 20, floor: 0, totalFloors: 5, heatingType: 'COMBI',
    address: 'Kıbrıs Şehitleri Caddesi No: 106, Konak', latitude: '38.436200', longitude: '27.143700', hasBalcony: false, hasElevator: false, hasParking: false, inSite: false,
    location: locations.alsancak, agentSlug: 'ege-yasam', daysAgo: 5, photoIndex: 2,
  },
  {
    id: 'mock-property-016', title: 'Alaybey’de sahile yakın uygun kiralık 2+1',
    description: 'Bakımlı binada, toplu ulaşıma ve sahil yoluna yakın kiralık daire. Günlük ihtiyaç noktalarına yürüyerek ulaşılabilir.',
    listingType: 'RENT', propertyType: 'APARTMENT', price: '31500.00', grossAreaM2: '108.00', netAreaM2: '94.00', rooms: 2, livingRooms: 1, buildingAge: 19, floor: 2, totalFloors: 6, heatingType: 'COMBI',
    address: '1671. Sokak No: 22, Karşıyaka', latitude: '38.456100', longitude: '27.111700', hasBalcony: true, hasElevator: true, hasParking: false, inSite: false,
    location: locations.alaybey, agentSlug: 'ege-yasam', daysAgo: 7, photoIndex: 3,
  },
  {
    id: 'mock-property-017', title: 'Yalıkavak’ta özel havuzlu çağdaş villa',
    description: 'Deniz manzaralı, özel havuzlu ve geniş teraslı villa. Bodrum merkezine ve marinaya araçla kolay erişim sunar.',
    listingType: 'SALE', propertyType: 'VILLA', price: '92500000.00', grossAreaM2: '342.00', netAreaM2: '296.00', rooms: 5, livingRooms: 2, buildingAge: 4, floor: 0, totalFloors: 2, heatingType: 'FLOOR_HEATING',
    address: 'Gökçebel Mahallesi No: 5, Bodrum', latitude: '37.111800', longitude: '27.286500', hasBalcony: true, hasElevator: false, hasParking: true, inSite: true,
    location: locations.yalikavak, agentSlug: 'ege-yasam', daysAgo: 9, photoIndex: 4,
  },
  {
    id: 'mock-property-018', title: 'Gündoğan’da sezonluk kiralık bahçeli villa',
    description: 'Bahçe ve özel havuz kullanımına sahip, eşyalı sezonluk villa. Kira koşulları örnek amaçlıdır ve gerçek bir teklif oluşturmaz.',
    listingType: 'RENT', propertyType: 'VILLA', price: '145000.00', grossAreaM2: '276.00', netAreaM2: '238.00', rooms: 4, livingRooms: 2, buildingAge: 6, floor: 0, totalFloors: 2, heatingType: 'COMBI',
    address: 'Sahil Yolu No: 19, Bodrum', latitude: '37.163500', longitude: '27.344500', isFurnished: true, hasBalcony: true, hasElevator: false, hasParking: true, inSite: false,
    location: locations.gundogan, agentSlug: 'ege-yasam', daysAgo: 11, photoIndex: 5,
  },
  {
    id: 'mock-property-019', title: 'Lara’da geniş teraslı aile dairesi',
    description: 'Gün ışığı alan geniş salonu, ebeveyn banyosu ve kapalı otoparkı bulunan site dairesi. Sahil ve alışveriş noktalarına yakındır.',
    listingType: 'SALE', propertyType: 'APARTMENT', price: '13750000.00', grossAreaM2: '174.00', netAreaM2: '151.00', rooms: 4, livingRooms: 1, buildingAge: 5, floor: 7, totalFloors: 12, heatingType: 'COMBI',
    address: 'Fener Mahallesi No: 42, Muratpaşa', latitude: '36.857900', longitude: '30.758600', hasBalcony: true, hasElevator: true, hasParking: true, inSite: true,
    location: locations.lara, agentSlug: 'akdeniz-anahtar', daysAgo: 2, photoIndex: 6,
  },
  {
    id: 'mock-property-020', title: 'Konyaaltı Uncalı’da eşyalı kiralık villa',
    description: 'Bahçeli, eşyalı ve kapalı otoparklı villa. Geniş aile yaşamına uygun planı ve toplu ulaşıma erişimiyle öne çıkar.',
    listingType: 'RENT', propertyType: 'VILLA', price: '89000.00', grossAreaM2: '248.00', netAreaM2: '216.00', rooms: 4, livingRooms: 2, buildingAge: 7, floor: 0, totalFloors: 2, heatingType: 'COMBI',
    address: 'Uncalı Caddesi No: 58, Konyaaltı', latitude: '36.891300', longitude: '30.650900', isFurnished: true, hasBalcony: true, hasElevator: false, hasParking: true, inSite: false,
    location: locations.uncali, agentSlug: 'akdeniz-anahtar', daysAgo: 4, photoIndex: 7,
  },
  {
    id: 'mock-property-021', title: 'Güzeloba’da yatırım için konut imarlı arsa',
    description: 'Yerleşim alanı içinde, ana ulaşım akslarına yakın arsa örneği. İmar koşulları ve ada-parsel bilgileri demo verisidir.',
    listingType: 'SALE', propertyType: 'LAND', price: '8950000.00', grossAreaM2: '420.00', netAreaM2: null, rooms: 0, livingRooms: 0, buildingAge: null, floor: null, totalFloors: null, heatingType: null,
    address: 'Güzeloba Mahallesi No: 15, Muratpaşa', latitude: '36.850300', longitude: '30.790700', hasBalcony: false, hasElevator: false, hasParking: false, inSite: false,
    location: locations.guzeloba, agentSlug: 'akdeniz-anahtar', daysAgo: 6, photoIndex: 8,
  },
  {
    id: 'mock-property-022', title: 'Nilüfer Odunluk’ta site içinde yeni 3+1',
    description: 'Yeni binada, ankastre mutfaklı ve ebeveyn banyolu daire. Site güvenliği, kapalı otopark ve ortak bahçe kullanımına sahiptir.',
    listingType: 'SALE', propertyType: 'APARTMENT', price: '11950000.00', grossAreaM2: '158.00', netAreaM2: '137.00', rooms: 3, livingRooms: 1, buildingAge: 2, floor: 8, totalFloors: 15, heatingType: 'CENTRAL',
    address: 'Akpınar Caddesi No: 36, Nilüfer', latitude: '40.209300', longitude: '28.995600', hasBalcony: true, hasElevator: true, hasParking: true, inSite: true,
    location: locations.odunluk, agentSlug: 'marmara-evim', daysAgo: 3, photoIndex: 9,
  },
  {
    id: 'mock-property-023', title: 'Görükle’de üniversiteye yakın kiralık 1+1',
    description: 'Üniversite kampüsüne ve toplu ulaşıma yakın, kullanışlı bir daire. Öğrenci veya tek kişilik haneler için uygun bir örnek portföydür.',
    listingType: 'RENT', propertyType: 'APARTMENT', price: '23500.00', grossAreaM2: '72.00', netAreaM2: '61.00', rooms: 1, livingRooms: 1, buildingAge: 5, floor: 4, totalFloors: 9, heatingType: 'COMBI',
    address: 'Üniversite Caddesi No: 80, Nilüfer', latitude: '40.229400', longitude: '28.837200', hasBalcony: true, hasElevator: true, hasParking: true, inSite: true,
    location: locations.gorukle, agentSlug: 'marmara-evim', daysAgo: 8, photoIndex: 10,
  },
  {
    id: 'mock-property-024', title: 'Acıbadem’de ulaşımı kolay bakımlı 2+1',
    description: 'Metro ve metrobüs bağlantılarına yakın, bakımlı binada daire. Ayrı mutfak ve balkonu bulunur; günlük yaşam noktalarına erişimi rahattır.',
    listingType: 'SALE', propertyType: 'APARTMENT', price: '15800000.00', grossAreaM2: '116.00', netAreaM2: '101.00', rooms: 2, livingRooms: 1, buildingAge: 16, floor: 3, totalFloors: 7, heatingType: 'COMBI',
    address: 'Acıbadem Caddesi No: 102, Kadıköy', latitude: '41.000900', longitude: '29.048200', hasBalcony: true, hasElevator: true, hasParking: false, inSite: false,
    location: locations.acibadem, agentSlug: 'marmara-evim', daysAgo: 12, photoIndex: 11,
  },
];

export const mockProperties: PropertyDetail[] = listingSeeds.map((seed) => {
  const agent = agentBySlug[seed.agentSlug];
  const coverImageUrl = imageUrl(seed.photoIndex);

  return {
    id: seed.id,
    title: seed.title,
    description: seed.description,
    listingType: seed.listingType,
    propertyType: seed.propertyType,
    status: 'ACTIVE',
    price: seed.price,
    currency: 'TRY',
    grossAreaM2: seed.grossAreaM2,
    netAreaM2: seed.netAreaM2 ?? null,
    rooms: seed.rooms,
    livingRooms: seed.livingRooms,
    buildingAge: seed.buildingAge ?? null,
    floor: seed.floor ?? null,
    totalFloors: seed.totalFloors ?? null,
    heatingType: seed.heatingType ?? null,
    ...seed.location,
    address: seed.address,
    latitude: seed.latitude,
    longitude: seed.longitude,
    isFurnished: seed.isFurnished ?? false,
    hasBalcony: seed.hasBalcony ?? false,
    hasElevator: seed.hasElevator ?? false,
    hasParking: seed.hasParking ?? false,
    inSite: seed.inSite ?? false,
    createdAt: daysAgo(seed.daysAgo),
    coverImageUrl,
    isFavorite: false,
    agent: {
      slug: agent.slug,
      companyName: agent.companyName,
      phone: agent.phone,
      logoUrl: agent.logoUrl,
    },
    images: [0, 1, 2].map((offset) => ({
      id: `${seed.id}-image-${offset + 1}`,
      url: imageUrl(seed.photoIndex + offset),
      sortOrder: offset,
      isCover: offset === 0,
    })),
  };
});

const matchesOptionalText = (value: string, filter: string | undefined) =>
  !filter || value === filter;

const optionalNumber = (value: string | number | undefined) => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const cardFromDetail = ({ images: _images, agent, ...property }: PropertyDetail) => ({
  ...property,
  agent: { slug: agent.slug, companyName: agent.companyName },
});

export function listMockProperties(
  query: {
    page?: number;
    limit?: number;
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
    sort?: 'newest' | 'price_asc' | 'price_desc';
  },
  agentSlug?: string,
): PaginatedResponse<ReturnType<typeof cardFromDetail>> {
  const minPrice = optionalNumber(query.minPrice);
  const maxPrice = optionalNumber(query.maxPrice);
  const minArea = optionalNumber(query.minArea);
  const maxArea = optionalNumber(query.maxArea);

  const filtered = mockProperties.filter((property) =>
    (!agentSlug || property.agent.slug === agentSlug) &&
    (!query.listingType || property.listingType === query.listingType) &&
    (!query.propertyType || property.propertyType === query.propertyType) &&
    matchesOptionalText(property.city, query.city) &&
    matchesOptionalText(property.district, query.district) &&
    matchesOptionalText(property.neighborhood, query.neighborhood) &&
    (minPrice === undefined || Number(property.price) >= minPrice) &&
    (maxPrice === undefined || Number(property.price) <= maxPrice) &&
    (query.rooms === undefined || property.rooms === query.rooms) &&
    (query.livingRooms === undefined || property.livingRooms === query.livingRooms) &&
    (minArea === undefined || Number(property.grossAreaM2) >= minArea) &&
    (maxArea === undefined || Number(property.grossAreaM2) <= maxArea),
  );

  const sorted = [...filtered].sort((a, b) => {
    if (query.sort === 'price_asc') return Number(a.price) - Number(b.price);
    if (query.sort === 'price_desc') return Number(b.price) - Number(a.price);
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });

  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(query.limit ?? 20)));
  const start = (page - 1) * limit;

  return {
    items: sorted.slice(start, start + limit).map(cardFromDetail),
    page,
    limit,
    total: sorted.length,
  };
}

export function getMockProperty(id: string): PropertyDetail | undefined {
  return mockProperties.find((property) => property.id === id);
}

export function getMockAgent(slug: string): AgentPublicProfile | undefined {
  return mockAgents.find((agent) => agent.slug === slug);
}

export function listMockAgentProperties(
  slug: string,
  query: Parameters<typeof listMockProperties>[0],
) {
  return listMockProperties(query, slug);
}

export const getMockDistricts = (cityId: string) =>
  mockDistricts.filter((district) => district.cityId === cityId);

export const getMockNeighborhoods = (districtId: string) =>
  mockNeighborhoods.filter((neighborhood) => neighborhood.districtId === districtId);
