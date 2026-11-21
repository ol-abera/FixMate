// FixMate — comprehensive mock dataset + domain types (frontend-only MVP)

export type UserRole = "customer" | "provider" | "admin" | "guest";

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  avgPrice: number;
  providerCount: number;
}

export interface Review {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  text: string;
}

export interface PricingTier {
  name: string;
  price: number;
  unit: string;
  features: string[];
  serviceId?: string;
}

export interface ProviderService {
  id: string;
  title: string;
  description: string;
  price: number;
  durationMins: number;
  categoryId: string;
  categoryName: string;
  active: boolean;
}

export interface PortfolioItem {
  id: string;
  image: string;
  caption: string;
}

export type Availability = "AVAILABLE" | "BUSY" | "OFFLINE";

export interface Provider {
  id: string;
  userId?: number;
  name: string;
  title: string;
  avatar: string;
  cover: string;
  categoryIds: string[];
  city: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  minJobPrice: number;
  verified: boolean;
  instantBook: boolean;
  availableNow: boolean;
  yearsExperience: number;
  jobsCompleted: number;
  responseTimeMins: number;
  bio: string;
  skills: string[];
  gallery: string[];
  tiers: PricingTier[];
  reviews: Review[];
  services?: ProviderService[];
  portfolio?: PortfolioItem[];
  favoritesCount?: number;
  availability?: Availability;
  verificationStatus?: "PENDING" | "VERIFIED" | "REJECTED";
  hasLocation?: boolean;
  /** Exact coordinates; only returned to the provider themselves. */
  pin?: { lat: number; lng: number; isCityCenter: boolean } | null;
}

export type BookingStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "declined"
  | "cancelled";

export interface TimelineEntry {
  status: BookingStatus;
  label: string;
  time: string;
}

export interface BookingRequest {
  id: string;
  providerId: string;
  providerName: string;
  customerName: string;
  categoryId: string;
  serviceName: string;
  description: string;
  date: string;
  timeSlot: string;
  address: string;
  contact: string;
  status: BookingStatus;
  estimate: number;
  createdAt: string;
  timeline: TimelineEntry[];
  finalPrice?: number | null;
  canReview?: boolean;
  hasReview?: boolean;
  customerId?: number;
  serviceId?: string;
  review?: { id: string; rating: number; comment: string } | null;
  notes?: string;
  photos?: { id: string; url: string }[];
  payment?: BookingPayment | null;
  canPay?: boolean;
}

export interface BookingPayment {
  status: "pending" | "paid" | "failed";
  amount: number;
  paidAt: string | null;
}

export interface Message {
  id: string;
  sender: "me" | "them";
  text: string;
  time: string;
  attachment?: string;
}

export interface Conversation {
  id: string;
  providerId: string;
  providerName: string;
  avatar: string;
  online: boolean;
  lastMessage: string;
  messages: Message[];
  unread?: number;
}

export interface NotificationItem {
  id: string;
  type: "booking" | "message" | "system";
  title: string;
  body: string;
  time: string;
  read: boolean;
  bookingId?: string;
  conversationId?: string;
}

export interface AuthUser {
  id?: number;
  name: string;
  role: UserRole;
  email: string;
  avatar: string;
  providerId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
  bio?: string;
  hasAvatar?: boolean;
}

export interface PublicStats {
  verifiedProviders: number;
  jobsCompleted: number;
  avgRating: number;
  cities: string[];
  citiesCount: number;
  featuredReviews: { id: string; author: string; avatar: string; rating: number; text: string; providerName: string; city: string }[];
}

export const CATEGORIES: ServiceCategory[] = [
  { id: "plumbing", name: "Plumbing", icon: "Wrench", description: "Leaks, installs, drainage & water systems", avgPrice: 85, providerCount: 142 },
  { id: "electrical", name: "Electrical", icon: "Lightning", description: "Wiring, fixtures, panels & smart setups", avgPrice: 95, providerCount: 118 },
  { id: "cleaning", name: "Cleaning", icon: "Sparkle", description: "Deep, recurring & move-out cleaning", avgPrice: 60, providerCount: 236 },
  { id: "painting", name: "Painting", icon: "PaintBucket", description: "Interior, exterior & decorative finishes", avgPrice: 70, providerCount: 97 },
  { id: "carpentry", name: "Carpentry", icon: "Scissors", description: "Furniture, shelving & custom builds", avgPrice: 78, providerCount: 64 },
  { id: "hvac", name: "HVAC", icon: "Fan", description: "Heating, cooling, vents & air quality", avgPrice: 110, providerCount: 73 },
  { id: "landscaping", name: "Landscaping", icon: "Drop", description: "Lawns, gardens, decks & outdoor design", avgPrice: 65, providerCount: 88 },
  { id: "appliance", name: "Appliance Repair", icon: "FirstAid", description: "Fridges, washers, ovens & dryers", avgPrice: 90, providerCount: 51 },
  { id: "handyman", name: "Handyman", icon: "Wrench", description: "Mounting, assembly & small fixes", avgPrice: 55, providerCount: 205 },
  { id: "pest", name: "Pest Control", icon: "ShieldCheck", description: "Inspection, treatment & prevention", avgPrice: 72, providerCount: 44 },
  { id: "computer-repair", name: "Computer Repair", icon: "Wrench", description: "Laptops, desktops, data recovery & networking", avgPrice: 55, providerCount: 0 },
  { id: "phone-repair", name: "Phone Repair", icon: "Wrench", description: "Screens, batteries & diagnostics", avgPrice: 60, providerCount: 0 },
  { id: "mechanic", name: "Mechanic", icon: "Wrench", description: "Servicing, brakes & roadside repairs", avgPrice: 65, providerCount: 0 },
  { id: "tutor", name: "Tutor", icon: "Users", description: "School subjects, languages & exam prep", avgPrice: 40, providerCount: 0 },
];

export const CITIES = ["Austin", "Round Rock", "Cedar Park", "Pflugerville", "Georgetown", "San Marcos"];

const AVATARS = ["12","15","20","24","33","36","41","48","51","56","60","64"];

type RawTuple = [
  string, string, string, string[], string, number, number, number,
  number, number, boolean, boolean, boolean, number, number, number, string
];

// id,name,title,cats,city,dist,rating,reviews,rate,minJob,verif,instant,avail,yrs,jobs,resp,skills(|)
const RAW: RawTuple[] = [
  ["p1","Alex Rivera","Master Plumber",["plumbing","handyman"],"Austin",2.1,4.9,312,95,120,true,true,true,12,1840,14,"Leak repair|Water heaters|Drainage|Pipe relining"],
  ["p2","Maya Chen","Licensed Electrician",["electrical","handyman"],"Round Rock",5.4,4.8,204,110,140,true,true,false,9,1120,22,"Panel upgrade|EV chargers|Smart home|Rewire"],
  ["p3","Diego Santos","Pro Cleaner",["cleaning"],"Austin",1.6,4.9,521,48,80,true,true,true,6,3210,9,"Deep clean|Move-out|Eco products|Post-build"],
  ["p4","Priya Nair","Interior Painter",["painting","carpentry"],"Cedar Park",7.2,4.7,158,72,200,true,false,false,8,640,31,"Wall finish|Cabinet spray|Faux texture|Trim"],
  ["p5","Sam Okafor","HVAC Specialist",["hvac","appliance"],"Pflugerville",4.3,4.8,276,125,180,true,true,true,14,1490,18,"AC repair|Furnace|Ductwork|Thermostats"],
  ["p6","Lena Park","Carpentry & Builds",["carpentry","handyman"],"Austin",3.0,4.9,189,88,150,true,false,true,11,720,27,"Custom shelving|Decks|Doors|Furniture"],
  ["p7","Marcus Bell","Landscape Designer",["landscaping","handyman"],"Georgetown",9.5,4.6,132,70,250,true,false,false,10,510,40,"Xeriscaping|Patios|Irrigation|Lighting"],
  ["p8","Sofia Rossi","Appliance Technician",["appliance","hvac"],"Round Rock",6.1,4.8,241,98,110,true,true,true,13,1610,16,"Fridges|Washers|Ovens|Dryers"],
  ["p9","Tariq Hassan","Handyman Hero",["handyman","carpentry","cleaning"],"Austin",1.9,4.7,430,58,60,true,true,true,7,2980,11,"TV mounting|Assembly|Fixes|Caulking"],
  ["p10","Grace Liu","Pest Control Pro",["pest","cleaning"],"Cedar Park",8.0,4.9,167,82,95,true,true,false,9,880,20,"Inspection|Termite|Rodent|Eco-safe"],
  ["p11","Noah Kim","Electrical & Solar",["electrical","hvac"],"Pflugerville",5.0,4.7,119,118,160,true,false,true,12,610,25,"Solar install|Inverters|Backup|Meter"],
  ["p12","Isabella Cruz","Deep Clean Studio",["cleaning","painting"],"Austin",2.6,5.0,298,52,90,true,true,true,5,2140,8,"Steam clean|Odor removal|Windows|Carpet"],
];

const REVIEW_POOL: Omit<Review, "id">[] = [
  { author: "Jordan M.", avatar: "https://i.pravatar.cc/80?img=5", rating: 5, date: "2 days ago", text: "Absolutely flawless. Showed up on time, explained everything, and the result exceeded expectations." },
  { author: "Casey T.", avatar: "https://i.pravatar.cc/80?img=9", rating: 5, date: "1 week ago", text: "Professional, tidy, and fairly priced. Already booked a follow-up for another room." },
  { author: "Riley P.", avatar: "https://i.pravatar.cc/80?img=13", rating: 4, date: "2 weeks ago", text: "Great work overall. Communication was solid and they finished slightly ahead of schedule." },
  { author: "Avery S.", avatar: "https://i.pravatar.cc/80?img=25", rating: 5, date: "3 weeks ago", text: "Trustworthy and skilled. Cleaned up perfectly after the job. Highly recommend." },
];

function buildTiers(rate: number): PricingTier[] {
  return [
    { name: "Essential", price: rate, unit: "/hr", features: ["Diagnostic visit", "Labor included", "Same-day quote"] },
    { name: "Standard", price: Math.round(rate * 3.2), unit: "/job", features: ["Full service", "Parts up to $50", "7-day warranty"] },
    { name: "Premium", price: Math.round(rate * 6), unit: "/job", features: ["Priority scheduling", "Premium parts", "12-month warranty"] },
  ];
}

export const PROVIDERS: Provider[] = RAW.map((r, i) => {
  const [id, name, title, categoryIds, city, distanceKm, rating, reviewCount, hourlyRate, minJobPrice, verified, instantBook, availableNow, yearsExperience, jobsCompleted, responseTimeMins, skillsStr] = r;
  const reviews = REVIEW_POOL.slice(0, (i % 2) + 3).map((rv, j) => ({ ...rv, id: `${id}-r${j}` }));
  return {
    id, name, title, categoryIds, city, distanceKm, rating, reviewCount, hourlyRate, minJobPrice,
    verified, instantBook, availableNow, yearsExperience, jobsCompleted, responseTimeMins,
    avatar: `https://i.pravatar.cc/160?img=${AVATARS[i % AVATARS.length]}`,
    cover: `https://picsum.photos/seed/fixmate-${id}/1200/400`,
    bio: `${name} is a ${title.toLowerCase()} serving ${city} with ${yearsExperience}+ years of hands-on experience and ${jobsCompleted.toLocaleString()} completed jobs. Known for transparent pricing, punctual arrivals, and a spotless finish. Every project starts with a clear, no-pressure estimate.`,
    skills: skillsStr.split("|"),
    gallery: [1, 2, 3, 4].map((n) => `https://picsum.photos/seed/${id}-g${n}/600/420`),
    tiers: buildTiers(hourlyRate),
    reviews,
  };
});

export const HOW_IT_WORKS = [
  { icon: "MagnifyingGlass", title: "Search & compare", text: "Browse verified pros by trade, price, rating and availability near you." },
  { icon: "Calendar", title: "Book in 6 steps", text: "Describe your job, pick a slot, and get an instant estimate." },
  { icon: "SealCheck", title: "Get it fixed", text: "Track progress, message your pro, and pay only when the job is done." },
];

export const STATS = [
  { label: "Verified pros", value: "2,400+" },
  { label: "Jobs completed", value: "180k" },
  { label: "Avg. rating", value: "4.8" },
  { label: "Cities served", value: "36" },
];

export const TESTIMONIALS = [
  { name: "Emily Watson", avatar: "https://i.pravatar.cc/80?img=44", role: "Homeowner, Austin", text: "FixMate connected me with a plumber who fixed a hidden leak the same evening. The booking flow took two minutes.", rating: 5 },
  { name: "David Park", avatar: "https://i.pravatar.cc/80?img=68", role: "Property manager", text: "I manage 40 units and FixMate is now my default. Accept/decline, chat and invoices all live in one dashboard.", rating: 5 },
  { name: "Rachel Adams", avatar: "https://i.pravatar.cc/80?img=32", role: "First-time buyer", text: "As a new homeowner I had no idea who to call. The verified badges and reviews made the choice easy.", rating: 4 },
];


const futureDate = (daysFromToday: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
};

export const SEED_BOOKINGS: BookingRequest[] = [
  { id: "b1", providerId: "p1", providerName: "Alex Rivera", customerName: "Sarah Jenkins", categoryId: "plumbing", serviceName: "Kitchen sink leak", description: "Water pooling under the sink cabinet, slow drip from the P-trap.", date: futureDate(2), timeSlot: "09:00 - 11:00", address: "1420 Oak Hollow Ln, Austin", contact: "(512) 555-0142", status: "in_progress", estimate: 165, createdAt: "2026-07-15T08:12:00Z", timeline: [ { status: "pending", label: "Request sent", time: "Jul 15, 8:12 AM" }, { status: "accepted", label: "Alex accepted", time: "Jul 15, 8:26 AM" }, { status: "in_progress", label: "Job in progress", time: "Jul 18, 9:05 AM" } ] },
  { id: "b2", providerId: "p3", providerName: "Diego Santos", customerName: "Sarah Jenkins", categoryId: "cleaning", serviceName: "Deep clean (2 bed)", description: "Full deep clean before moving in, appliances and windows included.", date: futureDate(5), timeSlot: "13:00 - 17:00", address: "88 Cedar Ridge Dr, Austin", contact: "(512) 555-0177", status: "accepted", estimate: 240, createdAt: "2026-07-16T14:40:00Z", timeline: [ { status: "pending", label: "Request sent", time: "Jul 16, 2:40 PM" }, { status: "accepted", label: "Diego accepted", time: "Jul 16, 3:02 PM" } ] },
  { id: "b3", providerId: "p2", providerName: "Maya Chen", customerName: "Tom Reyes", categoryId: "electrical", serviceName: "EV charger install", description: "Install a Level 2 charger in the garage, dedicated 240V circuit.", date: futureDate(-2), timeSlot: "10:00 - 12:00", address: "512 Summit Ave, Round Rock", contact: "(512) 555-0190", status: "completed", estimate: 520, createdAt: "2026-07-10T09:00:00Z", timeline: [ { status: "pending", label: "Request sent", time: "Jul 10, 9:00 AM" }, { status: "accepted", label: "Maya accepted", time: "Jul 10, 9:31 AM" }, { status: "in_progress", label: "Job in progress", time: "Jul 14, 10:00 AM" }, { status: "completed", label: "Completed", time: "Jul 14, 1:15 PM" } ] },
  { id: "b4", providerId: "p1", providerName: "Alex Rivera", customerName: "Nina Foster", categoryId: "plumbing", serviceName: "Water heater flush", description: "Annual flush and inspection of a 50-gal tank heater.", date: futureDate(7), timeSlot: "15:00 - 16:00", address: "77 Willow Bend, Austin", contact: "(512) 555-0155", status: "pending", estimate: 130, createdAt: "2026-07-17T11:20:00Z", timeline: [ { status: "pending", label: "Request sent", time: "Jul 17, 11:20 AM" } ] },
  { id: "b5", providerId: "p1", providerName: "Alex Rivera", customerName: "Owen Blake", categoryId: "plumbing", serviceName: "Bathroom remodel leak", description: "Suspected slab leak, need camera inspection and quote.", date: futureDate(10), timeSlot: "08:00 - 10:00", address: "9 Maple Court, Pflugerville", contact: "(512) 555-0121", status: "pending", estimate: 280, createdAt: "2026-07-17T16:05:00Z", timeline: [ { status: "pending", label: "Request sent", time: "Jul 17, 4:05 PM" } ] },
  { id: "b6", providerId: "p1", providerName: "Alex Rivera", customerName: "Grace Liu", categoryId: "handyman", serviceName: "Faucet replacement", description: "Swap two worn kitchen faucets, bring new units.", date: futureDate(-4), timeSlot: "11:00 - 12:00", address: "340 Birch St, Austin", contact: "(512) 555-0102", status: "declined", estimate: 90, createdAt: "2026-07-09T10:00:00Z", timeline: [ { status: "pending", label: "Request sent", time: "Jul 9, 10:00 AM" }, { status: "declined", label: "Declined - fully booked", time: "Jul 9, 10:40 AM" } ] },
];

export const SEED_CONVERSATIONS: Conversation[] = [
  { id: "c1", providerId: "p1", providerName: "Alex Rivera", avatar: "https://i.pravatar.cc/160?img=12", online: true, lastMessage: "I'll bring a replacement P-trap too.", messages: [
    { id: "m1", sender: "me", text: "Hi Alex, the leak under the kitchen sink is getting worse. Can you take a look today?", time: "8:02 AM" },
    { id: "m2", sender: "them", text: "Morning Sarah! Yes, I can be there between 9 and 11. Is the cabinet empty?", time: "8:05 AM" },
    { id: "m3", sender: "me", text: "Just cleared it out. The drip is near the back pipe.", time: "8:07 AM" },
    { id: "m4", sender: "them", text: "Perfect. I'll bring a replacement P-trap too.", time: "8:09 AM" },
  ] },
  { id: "c2", providerId: "p3", providerName: "Diego Santos", avatar: "https://i.pravatar.cc/160?img=20", online: false, lastMessage: "Sounds good, see you on the 22nd!", messages: [
    { id: "m1", sender: "me", text: "Hey Diego, do you handle inside the oven and fridge for a deep clean?", time: "Yesterday" },
    { id: "m2", sender: "them", text: "Absolutely, both are included in the deep clean package.", time: "Yesterday" },
    { id: "m3", sender: "me", text: "Great, I'll keep the 1pm slot then.", time: "Yesterday" },
    { id: "m4", sender: "them", text: "Sounds good, see you on the 22nd!", time: "Yesterday" },
  ] },
  { id: "c3", providerId: "p2", providerName: "Maya Chen", avatar: "https://i.pravatar.cc/160?img=24", online: true, lastMessage: "Invoice sent, thanks again!", messages: [
    { id: "m1", sender: "them", text: "Hi! Just finished the EV charger install and tested the circuit. All green.", time: "Jul 14" },
    { id: "m2", sender: "me", text: "Awesome, thank you! Can you send the invoice?", time: "Jul 14" },
    { id: "m3", sender: "them", text: "Invoice sent, thanks again!", time: "Jul 14" },
  ] },
];

export const SEED_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", type: "booking", title: "Alex accepted your request", body: "Kitchen sink leak is confirmed for Jul 18, 9:00 - 11:00.", time: "2h ago", read: false },
  { id: "n2", type: "message", title: "New message from Diego", body: "Sounds good, see you on the 22nd!", time: "5h ago", read: false },
  { id: "n3", type: "system", title: "Payment received", body: "Maya's EV charger job was paid ($520).", time: "1d ago", read: true },
  { id: "n4", type: "booking", title: "2 new requests waiting", body: "Providers inbox has pending jobs to review.", time: "1d ago", read: true },
  { id: "n5", type: "system", title: "Verification complete", body: "Your FixMate pro badge is now active.", time: "3d ago", read: true },
];

export const CUSTOMER_USER: AuthUser = { name: "Sarah Jenkins", role: "customer", email: "sarah@fixmate.io", avatar: "https://i.pravatar.cc/160?img=47" };
export const PROVIDER_USER: AuthUser = { name: "Alex Rivera", role: "provider", email: "alex@fixmate.io", avatar: "https://i.pravatar.cc/160?img=12", providerId: "p1" };

export const PROVIDER_AUTO_REPLIES = [
  "Thanks for the details! I can fit that in.",
  "Got it. I'll bring the right parts for the job.",
  "Sounds good. Want me to send a revised estimate?",
  "Appreciate you reaching out. I'll confirm shortly.",
  "No problem at all. See you then!",
];

export const findPro = (id: string) => PROVIDERS.find((p) => p.id === id);
export const getCategory = (id: string) => CATEGORIES.find((c) => c.id === id);