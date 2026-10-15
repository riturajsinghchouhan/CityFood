import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// ----- Inline Schemas to avoid ESM Path issues ----- //
const geoPointSchema = new mongoose.Schema({
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: undefined },
    latitude: { type: Number },
    longitude: { type: Number },
}, { _id: false });

const zoneSchema = new mongoose.Schema({
    name: { type: String, required: true },
    country: { type: String, default: 'India' },
    coordinates: { type: [mongoose.Schema.Types.Mixed], required: true },
    isActive: { type: Boolean, default: true }
}, { collection: 'food_zones' });

const restaurantSchema = new mongoose.Schema({
    restaurantName: { type: String, required: true },
    ownerName: { type: String, required: true },
    ownerPhone: { type: String, required: true },
    city: { type: String },
    pureVegRestaurant: { type: Boolean, default: false },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone' },
    status: { type: String, default: 'approved' },
    location: geoPointSchema,
    rating: { type: Number, default: 0 },
    estimatedDeliveryTime: { type: String },
    estimatedDeliveryTimeMinutes: { type: Number },
    coverImages: { type: [String], default: [] },
    profileImage: { type: String },
    cuisines: { type: [String], default: [] },
    isAcceptingOrders: { type: Boolean, default: true },
    zoneRank: { type: Number, default: null } // used for premium restaurants
}, { collection: 'food_restaurants', strict: false });

const menuSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true },
    sections: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { collection: 'food_restaurant_menus' });

const deliveryPartnerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    city: { type: String },
    status: { type: String, default: 'approved' },
    availabilityStatus: { type: String, default: 'online' },
    rating: { type: Number, default: 4.5 }
}, { collection: 'food_delivery_partners', strict: false });

const heroBannerSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    title: { type: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
}, { collection: 'food_hero_banners' });

const foodCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        image: { type: String, trim: true, default: '' },
        type: { type: String, trim: true, default: '' },
        foodTypeScope: { type: String, enum: ['Veg', 'Non-Veg', 'Both'], default: 'Both', index: true },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0, index: true },
        isApproved: { type: Boolean, default: true }
    },
    {
        collection: 'food_categories',
        timestamps: true
    }
);

// ----- Models ----- //
const Zone = mongoose.models.FoodZone || mongoose.model('FoodZone', zoneSchema);
const Restaurant = mongoose.models.FoodRestaurant || mongoose.model('FoodRestaurant', restaurantSchema);
const Menu = mongoose.models.FoodRestaurantMenu || mongoose.model('FoodRestaurantMenu', menuSchema);
const DeliveryPartner = mongoose.models.FoodDeliveryPartner || mongoose.model('FoodDeliveryPartner', deliveryPartnerSchema);
const HeroBanner = mongoose.models.FoodHeroBanner || mongoose.model('FoodHeroBanner', heroBannerSchema);
const FoodCategory = mongoose.models.FoodCategory || mongoose.model('FoodCategory', foodCategorySchema);

const foodItemSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory' },
    categoryName: { type: String, trim: true, default: '' },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    image: { type: String, default: '' },
    foodType: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Non-Veg' },
    isAvailable: { type: Boolean, default: true },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }
}, { collection: 'food_items' });

const FoodItem = mongoose.models.FoodItem || mongoose.model('FoodItem', foodItemSchema);

// ----- Seed Data Configuration ----- //
const ZONES_DATA = [
    { name: 'Indore', coords: [75.8, 22.7] },
    { name: 'Punjab', coords: [75.3, 31.1] },
    { name: 'Mumbai', coords: [72.8, 19.0] },
    { name: 'Bangalore', coords: [77.5, 12.9] }
];

const CATEGORIES_DATA = [
    { name: 'Pizza', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80' },
    { name: 'Burger', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
    { name: 'Rolls', image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80' },
    { name: 'Thali', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80' },
    { name: 'Biryani', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80' },
    { name: 'Noodles', image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&q=80' },
    { name: 'Pasta', image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=400&q=80' },
    { name: 'Chinese', image: 'https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=400&q=80' },
    { name: 'South Indian', image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400&q=80' },
    { name: 'Sweets', image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&q=80' },
    { name: 'Gourmet', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&q=80' }
];

const RESTAURANTS_DATA = [
    {
        city: 'Indore',
        name: 'The Royal Maratha',
        cuisines: ['North Indian', 'Maharashtrian', 'Thali'],
        rating: 4.8,
        coverImages: ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80'],
        profileImage: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&q=80',
        rank: 1,
        foods: [
            { name: 'Puran Poli Thali', category: 'Thali', price: 299, type: 'veg', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80' },
            { name: 'Misal Pav Special', category: 'South Indian', price: 149, type: 'veg', image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80' },
            { name: 'Gulab Jamun', category: 'Sweets', price: 99, type: 'veg', image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&q=80' }
        ]
    },
    {
        city: 'Indore',
        name: 'Sarafa Street Bites',
        cuisines: ['Street Food', 'Desserts', 'Snacks'],
        rating: 4.6,
        coverImages: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80'],
        profileImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80',
        rank: 2,
        foods: [
            { name: 'Indori Poha Jalebi', category: 'Sweets', price: 99, type: 'veg', image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&q=80' },
            { name: 'Paneer Kati Roll', category: 'Rolls', price: 120, type: 'veg', image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80' },
            { name: 'Hakka Noodles', category: 'Noodles', price: 140, type: 'veg', image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&q=80' }
        ]
    },
    {
        city: 'Punjab',
        name: 'Amritsari Tadka',
        cuisines: ['Punjabi', 'North Indian', 'Biryani'],
        rating: 4.9,
        coverImages: ['https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80'],
        profileImage: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=400&q=80',
        rank: 1,
        foods: [
            { name: 'Chicken Biryani', category: 'Biryani', price: 349, type: 'non-veg', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80' },
            { name: 'Amritsari Kulcha Thali', category: 'Thali', price: 199, type: 'veg', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80' },
            { name: 'Chicken Roll', category: 'Rolls', price: 150, type: 'non-veg', image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80' }
        ]
    },
    {
        city: 'Punjab',
        name: 'The Pind Cafe',
        cuisines: ['Chinese', 'Fast Food', 'Pizza'],
        rating: 4.5,
        coverImages: ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80'],
        profileImage: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400&q=80',
        rank: 2,
        foods: [
            { name: 'Farmhouse Pizza', category: 'Pizza', price: 299, type: 'veg', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80' },
            { name: 'Paneer Tikka Burger', category: 'Burger', price: 149, type: 'veg', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
            { name: 'Veg Manchurian', category: 'Chinese', price: 180, type: 'veg', image: 'https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=400&q=80' }
        ]
    },
    {
        city: 'Mumbai',
        name: 'Bombay Brasserie',
        cuisines: ['Seafood', 'Pasta', 'Asian'],
        rating: 4.7,
        coverImages: ['https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80'],
        profileImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80',
        rank: 1,
        foods: [
            { name: 'Penne Arrabiata', category: 'Pasta', price: 220, type: 'veg', image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=400&q=80' },
            { name: 'Vada Pav Sliders Burger', category: 'Burger', price: 120, type: 'veg', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
            { name: 'Prawn Biryani', category: 'Biryani', price: 450, type: 'non-veg', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80' }
        ]
    },
    {
        city: 'Mumbai',
        name: 'Marine Drive Cafe',
        cuisines: ['Italian', 'Continental', 'Pizza'],
        rating: 4.4,
        coverImages: ['https://images.unsplash.com/photo-1466978913421-bac8c050aed7?w=800&q=80'],
        profileImage: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=400&q=80',
        rank: 2,
        foods: [
            { name: 'Woodfire Margherita', category: 'Pizza', price: 450, type: 'veg', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80' },
            { name: 'Creamy Alfredo Pasta', category: 'Pasta', price: 300, type: 'veg', image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=400&q=80' },
            { name: 'Veg Noodles', category: 'Noodles', price: 180, type: 'veg', image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&q=80' }
        ]
    },
    {
        city: 'Bangalore',
        name: 'The Brew Estate',
        cuisines: ['Continental', 'Bar Food', 'Burger'],
        rating: 4.8,
        coverImages: ['https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80'],
        profileImage: 'https://images.unsplash.com/photo-1525648199074-cee30ba79a4a?w=400&q=80',
        rank: 1,
        foods: [
            { name: 'Gourmet Cheeseburger', category: 'Burger', price: 350, type: 'non-veg', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
            { name: 'Truffle Fries Roll', category: 'Rolls', price: 200, type: 'veg', image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80' },
            { name: 'Cheesy Pizza', category: 'Pizza', price: 400, type: 'veg', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80' }
        ]
    },
    {
        city: 'Bangalore',
        name: 'South Indian Dosa House',
        cuisines: ['South Indian', 'Breakfast', 'Thali'],
        rating: 4.6,
        coverImages: ['https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=800&q=80'],
        profileImage: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80',
        rank: 2,
        foods: [
            { name: 'Mysore Masala Dosa', category: 'South Indian', price: 150, type: 'veg', image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400&q=80' },
            { name: 'Mini South Thali', category: 'Thali', price: 180, type: 'veg', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80' },
            { name: 'Idli Sambar', category: 'South Indian', price: 80, type: 'veg', image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400&q=80' }
        ]
    }
];

const BANNERS_DATA = [
    { title: 'Craving Pizza?', image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=2070&auto=format&fit=crop' },
    { title: 'Healthy Salads', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=2070&auto=format&fit=crop' },
    { title: 'Dessert Time', image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=2070&auto=format&fit=crop' },
    { title: 'Burger Bash', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2070&auto=format&fit=crop' }
];

async function run() {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Tuggo';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB successfully!');

        // 1. Delete Old Demo Data (Old restaurants like Indore Special Poha, Sarafa Night Sweets)
        await Restaurant.deleteMany({ restaurantName: { $in: ['Indore Special Poha', 'Sarafa Night Sweets', 'Demo Restaurant'] } });
        console.log('Cleared old placeholder restaurants.');

        // Also delete any existing test data to prevent duplicates on multiple runs
        await Restaurant.deleteMany({ ownerName: 'CityFood Demo' });
        await DeliveryPartner.deleteMany({ name: { $regex: 'CityFood Rider' } });
        await HeroBanner.deleteMany({ publicId: { $regex: 'demo_banner_' } });

        await FoodItem.deleteMany({ name: { $regex: 'CityFood' } }); // Clear previous demo items if any

        // Clear and seed categories
        await FoodCategory.deleteMany({});
        const categoryMap = {};
        for (let i = 0; i < CATEGORIES_DATA.length; i++) {
            const cat = await FoodCategory.create({
                name: CATEGORIES_DATA[i].name,
                image: CATEGORIES_DATA[i].image,
                sortOrder: i + 1,
                isApproved: true
            });
            categoryMap[CATEGORIES_DATA[i].name] = cat._id;
        }
        console.log('Seeded Food Categories.');

        // 2. Create Zones
        const zoneMap = {};
        for (const z of ZONES_DATA) {
            let zone = await Zone.findOne({ name: `${z.name} Zone` });
            if (!zone) {
                zone = await Zone.create({
                    name: `${z.name} Zone`,
                    coordinates: [
                        { latitude: z.coords[1], longitude: z.coords[0] },
                        { latitude: z.coords[1] + 0.1, longitude: z.coords[0] },
                        { latitude: z.coords[1] + 0.1, longitude: z.coords[0] + 0.1 },
                        { latitude: z.coords[1], longitude: z.coords[0] + 0.1 }
                    ]
                });
            }
            zoneMap[z.name] = zone;
        }
        console.log('Zones verified.');

        // 3. Create Restaurants and Menus
        let phoneCounter = 9000000000;
        for (const restData of RESTAURANTS_DATA) {
            const z = ZONES_DATA.find(z => z.name === restData.city);

            const restaurant = await Restaurant.create({
                restaurantName: restData.name,
                ownerName: 'CityFood Demo',
                ownerPhone: String(phoneCounter++),
                city: restData.city,
                zoneId: zoneMap[restData.city]._id,
                rating: restData.rating,
                coverImages: restData.coverImages,
                profileImage: restData.profileImage,
                cuisines: restData.cuisines,
                zoneRank: restData.rank,
                estimatedDeliveryTime: '25-35 mins',
                estimatedDeliveryTimeMinutes: 30,
                location: {
                    type: 'Point',
                    coordinates: [z.coords[0] + (Math.random() * 0.05), z.coords[1] + (Math.random() * 0.05)],
                    latitude: z.coords[1] + (Math.random() * 0.05),
                    longitude: z.coords[0] + (Math.random() * 0.05)
                }
            });

            // Create Menu
            const menuSections = [{
                name: "Recommended",
                items: restData.foods.map((f) => ({
                    menuItemId: new mongoose.Types.ObjectId().toString(),
                    name: f.name,
                    category: f.category,
                    price: f.price,
                    type: f.type,
                    image: f.image,
                    description: `Premium ${f.name} made with authentic ingredients.`,
                    isAvailable: true
                }))
            }];
            await Menu.create({
                restaurantId: restaurant._id,
                sections: menuSections
            });

            // Create FoodItems for public categories filtering
            for (const item of menuSections[0].items) {
                if (item.category && categoryMap[item.category]) {
                    await FoodItem.create({
                        restaurantId: restaurant._id,
                        categoryId: categoryMap[item.category],
                        categoryName: item.category,
                        name: item.name,
                        description: item.description,
                        price: item.price,
                        image: item.image,
                        foodType: item.type === 'veg' ? 'Veg' : 'Non-Veg',
                        isAvailable: true,
                        approvalStatus: 'approved'
                    });
                }
            }
        }
        console.log('Created 8 Premium Restaurants, Menus & FoodItems.');

        // 4. Create Delivery Partners
        let dpCounter = 8000000000;
        for (const z of ZONES_DATA) {
            await DeliveryPartner.create({
                name: `CityFood Rider ${z.name}`,
                phone: String(dpCounter++),
                city: z.name,
                vehicleType: 'bike',
                availabilityStatus: 'online'
            });
        }
        console.log('Created 4 Delivery Partners.');

        // 5. Create Banners
        let bOrder = 1;
        for (const b of BANNERS_DATA) {
            await HeroBanner.create({
                title: b.title,
                imageUrl: b.image,
                publicId: `demo_banner_${bOrder}`,
                sortOrder: bOrder++
            });
        }
        console.log('Created Promotional Banners.');

        console.log('Database seeding completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Error during seeding:', error);
        process.exit(1);
    }
}

run();
