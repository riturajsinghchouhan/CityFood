import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodRestaurantOutletTimings } from '../src/modules/food/restaurant/models/outletTimings.model.js';
import { FoodCategory } from '../src/modules/food/admin/models/category.model.js';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';
import { FoodZone } from '../src/modules/food/admin/models/zone.model.js';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';

const CATEGORIES_DATA = [
    { name: 'Biryani', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80', foodTypeScope: 'Both' },
    { name: 'North Indian', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80', foodTypeScope: 'Both' },
    { name: 'Fast Food', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80', foodTypeScope: 'Both' },
    { name: 'Rolls', image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80', foodTypeScope: 'Both' },
    { name: 'Pizza', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80', foodTypeScope: 'Both' },
    { name: 'Beverages', image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=400&q=80', foodTypeScope: 'Both' },
    { name: 'Desserts', image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&q=80', foodTypeScope: 'Veg' }
];

const MENU_ITEMS = [
    {
        name: 'Hyderabadi Chicken Dum Biryani',
        category: 'Biryani',
        foodType: 'Non-Veg',
        price: 280,
        description: 'Fragrant basmati rice layered with spiced marinated chicken and slow-cooked in dum style.',
        image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&q=80'
    },
    {
        name: 'Royal Veg Dum Biryani',
        category: 'Biryani',
        foodType: 'Veg',
        price: 220,
        description: 'Aromatic basmati rice cooked with fresh seasonal vegetables and authentic spices.',
        image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&q=80'
    },
    {
        name: 'Paneer Butter Masala',
        category: 'North Indian',
        foodType: 'Veg',
        price: 240,
        description: 'Cottage cheese cubes simmered in a rich, creamy makhani gravy with butter.',
        image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&q=80'
    },
    {
        name: 'Dal Makhani Special',
        category: 'North Indian',
        foodType: 'Veg',
        price: 210,
        description: 'Black lentils slow cooked overnight with butter and fresh cream.',
        image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80'
    },
    {
        name: 'Butter Naan',
        category: 'North Indian',
        foodType: 'Veg',
        price: 45,
        description: 'Fresh tandoor baked leavened bread brushed generously with pure butter.',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=80'
    },
    {
        name: 'Crispy Veg Supreme Burger',
        category: 'Fast Food',
        foodType: 'Veg',
        price: 120,
        description: 'Crunchy golden patty with fresh lettuce, sliced onions, tomatoes, and house mayo.',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80'
    },
    {
        name: 'Paneer Tikka Roll',
        category: 'Rolls',
        foodType: 'Veg',
        price: 150,
        description: 'Smoky grilled paneer chunks wrapped in a soft layered paratha with mint chutney.',
        image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500&q=80'
    },
    {
        name: 'Chilled Cold Coffee',
        category: 'Beverages',
        foodType: 'Veg',
        price: 90,
        description: 'Classic creamy iced blended coffee topped with chocolate powder.',
        image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&q=80'
    },
    {
        name: 'Hot Gulab Jamun (2 Pcs)',
        category: 'Desserts',
        foodType: 'Veg',
        price: 70,
        description: 'Soft milk solids dumplings fried to golden brown and soaked in cardamom syrup.',
        image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&q=80'
    }
];

async function seed() {
    try {
        console.log('Connecting to database...');
        await connectDB();

        const phone = '9755633147';
        const phoneDigits = '9755633147';
        const phoneLast10 = '9755633147';
        const address = 'Corporate House, 169, RNT Marg, Indore, Madhya Pradesh 452001';
        const lat = 22.7169;
        const lng = 75.8732;

        // 1. Find or verify Zone
        let zone = await FoodZone.findOne({ name: /indore/i, isActive: true });
        if (!zone) {
            console.log('Zone not found by regex, trying first active zone...');
            zone = await FoodZone.findOne({ isActive: true });
        }
        if (!zone) {
            throw new Error('No active Zone found in database! Please create a zone first.');
        }
        console.log(`Using Zone: "${zone.name}" (ID: ${zone._id})`);

        // 2. Ensure Categories exist
        const categoryMap = {};
        for (let i = 0; i < CATEGORIES_DATA.length; i++) {
            const catData = CATEGORIES_DATA[i];
            let category = await FoodCategory.findOne({ name: { $regex: new RegExp(`^${catData.name}$`, 'i') } });
            if (!category) {
                category = await FoodCategory.create({
                    name: catData.name,
                    image: catData.image,
                    foodTypeScope: catData.foodTypeScope,
                    isActive: true,
                    isApproved: true,
                    sortOrder: i + 1
                });
                console.log(`Created Category: ${category.name}`);
            }
            categoryMap[catData.name] = category._id;
        }

        // 3. Upsert Restaurant
        console.log(`\nUpserting Restaurant with Phone: ${phone}...`);
        let restaurant = await FoodRestaurant.findOne({
            $or: [
                { ownerPhone: phone },
                { ownerPhoneDigits: phoneDigits },
                { primaryContactNumber: phone }
            ]
        });

        const restaurantPayload = {
            restaurantName: 'Corporate Kitchen',
            restaurantNameNormalized: 'corporate kitchen',
            ownerName: 'Corporate House Partner',
            ownerPhone: phone,
            ownerPhoneDigits: phoneDigits,
            ownerPhoneLast10: phoneLast10,
            primaryContactNumber: phone,
            ownerEmail: `corporate${phone}@cityfood.in`,
            pureVegRestaurant: false,
            city: 'Indore',
            state: 'Madhya Pradesh',
            area: 'RNT Marg',
            addressLine1: 'Corporate House, RNT Marg',
            pincode: '452001',
            landmark: 'Near RNT Marg',
            location: {
                type: 'Point',
                coordinates: [lng, lat],
                latitude: lat,
                longitude: lng,
                formattedAddress: address,
                address: address,
                addressLine1: 'Corporate House, RNT Marg',
                area: 'RNT Marg',
                city: 'Indore',
                state: 'Madhya Pradesh',
                pincode: '452001',
                landmark: 'Near RNT Marg'
            },
            zoneId: zone._id,
            cuisines: ['North Indian', 'Biryani', 'Fast Food', 'Beverages', 'Desserts'],
            rating: 4.8,
            totalRatings: 128,
            status: 'approved',
            approvedAt: new Date(),
            isAcceptingOrders: true,
            openingTime: '08:00',
            closingTime: '23:00',
            openDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            estimatedDeliveryTime: '25-30 mins',
            estimatedDeliveryTimeMinutes: 28,
            profileImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80',
            coverImages: [
                'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&q=80',
                'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1000&q=80'
            ],
            diningSettings: {
                isEnabled: true,
                maxGuests: 8,
                diningType: ['family-dining']
            }
        };

        if (restaurant) {
            Object.assign(restaurant, restaurantPayload);
            await restaurant.save();
            console.log(`Updated existing Restaurant: "${restaurant.restaurantName}" (ID: ${restaurant._id})`);
        } else {
            restaurant = await FoodRestaurant.create(restaurantPayload);
            console.log(`Created new Restaurant: "${restaurant.restaurantName}" (ID: ${restaurant._id})`);
        }

        // Ensure Outlet Timings (Always open 08:00 - 23:00)
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const timings = days.map((day) => ({
            day,
            isOpen: true,
            openingTime: '08:00',
            closingTime: '23:00'
        }));
        await FoodRestaurantOutletTimings.findOneAndUpdate(
            { restaurantId: restaurant._id },
            { $set: { timings } },
            { upsert: true, new: true }
        );
        console.log(`Configured 7-day open outlet timings for restaurant.`);

        // 4. Seed Food Items
        console.log('\nSeeding Food Items for Restaurant...');
        let seededFoodCount = 0;
        for (const item of MENU_ITEMS) {
            const catId = categoryMap[item.category];
            const existing = await FoodItem.findOne({
                restaurantId: restaurant._id,
                name: item.name
            });

            if (!existing) {
                await FoodItem.create({
                    restaurantId: restaurant._id,
                    categoryId: catId,
                    categoryName: item.category,
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    image: item.image,
                    foodType: item.foodType,
                    isAvailable: true,
                    isRecommended: true,
                    approvalStatus: 'approved',
                    approvedAt: new Date()
                });
                seededFoodCount++;
            }
        }
        console.log(`Added ${seededFoodCount} new Food Items (Total available: ${MENU_ITEMS.length}).`);

        // 5. Upsert Delivery Partner (Rider)
        console.log(`\nUpserting Delivery Partner with Phone: ${phone}...`);
        let partner = await FoodDeliveryPartner.findOne({ phone });

        const partnerPayload = {
            name: 'Corporate Delivery Express',
            phone: phone,
            countryCode: '+91',
            email: `rider${phone}@cityfood.in`,
            address: address,
            city: 'Indore',
            state: 'Madhya Pradesh',
            vehicleType: 'Bike',
            vehicleName: 'Hero Splendor Plus',
            vehicleNumber: 'MP09AB9755',
            drivingLicenseNumber: 'MP0920249755633',
            panNumber: 'ABCDE9755F',
            aadharNumber: '975563314712',
            status: 'approved',
            approvedAt: new Date(),
            availabilityStatus: 'online',
            lastLocation: {
                type: 'Point',
                coordinates: [lng, lat]
            },
            lastLat: lat,
            lastLng: lng,
            lastLocationAt: new Date(),
            profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            rating: 4.9,
            totalRatings: 64
        };

        if (partner) {
            Object.assign(partner, partnerPayload);
            await partner.save();
            console.log(`Updated existing Delivery Partner: "${partner.name}" (ID: ${partner._id})`);
        } else {
            partner = await FoodDeliveryPartner.create(partnerPayload);
            console.log(`Created new Delivery Partner: "${partner.name}" (ID: ${partner._id})`);
        }

        console.log('\n=============================================');
        console.log('✅ SEEDING COMPLETED SUCCESSFULLY!');
        console.log('=============================================');
        console.log('RESTAURANT DETAILS:');
        console.log({
            id: restaurant._id,
            name: restaurant.restaurantName,
            phone: restaurant.ownerPhone,
            zone: zone.name,
            address: restaurant.addressLine1,
            status: restaurant.status,
            isAcceptingOrders: restaurant.isAcceptingOrders,
            itemsCount: MENU_ITEMS.length
        });
        console.log('\nDELIVERY PARTNER DETAILS:');
        console.log({
            id: partner._id,
            name: partner.name,
            phone: partner.phone,
            vehicle: `${partner.vehicleName} (${partner.vehicleNumber})`,
            status: partner.status,
            availability: partner.availabilityStatus,
            location: `Lat: ${partner.lastLat}, Lng: ${partner.lastLng} (${partner.city})`
        });
        console.log('=============================================\n');

        await disconnectDB();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed with error:', err);
        await disconnectDB();
        process.exit(1);
    }
}

seed();
