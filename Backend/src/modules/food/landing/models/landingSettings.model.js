import mongoose from 'mongoose';

const foodLandingSettingsSchema = new mongoose.Schema(
    {
        exploreMoreHeading: {
            type: String,
            default: 'Explore more'
        },
        recommendedRestaurantIds: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'FoodRestaurant',
            default: []
        },
        showHeroBanners: {
            type: Boolean,
            default: true
        },
        showUnder250: {
            type: Boolean,
            default: true
        },
        showDining: {
            type: Boolean,
            default: true
        },
        showExploreIcons: {
            type: Boolean,
            default: true
        },
        showTop10: {
            type: Boolean,
            default: true
        },
        showGourmet: {
            type: Boolean,
            default: true
        },
        under250PriceLimit: {
            type: Number,
            default: 250,
            min: 1,
            max: 10000
        },
        mealsUnder: {
            enabled: { type: Boolean, default: true },
            title: { type: String, default: 'Meals under' },
            priceLimit: { type: Number, default: 200, min: 1, max: 10000 },
            maxItems: { type: Number, default: 20, min: 1, max: 100 }
        },
        festBannerImages: {
            type: [String],
            default: []
        },
        stats: {
            restaurants: { type: String, default: '3,00,000+' },
            cities: { type: String, default: '800+' },
            orders: { type: String, default: '3 billion+' }
        },
        heroHeadline: { type: String, default: "India’s #1 food delivery app" },
        heroSubtitle: { type: String, default: "Experience fast & easy online ordering on the CityFood app" },
        appsSectionSubtitle: { type: String, default: "EVERYTHING YOU NEED, DELIVERED IN MINUTES" },
        userAppTitle: { type: String, default: "cityfood user" },
        userAppDesc: { type: String, default: "Get the app now to start ordering your favorite food & groceries!" },
        userAppLink: { type: String, default: "/food/user" },
        userAppIcon: { type: String, default: "" },
        restaurantAppTitle: { type: String, default: "cityfood restaurant" },
        restaurantAppDesc: { type: String, default: "Partner with us to grow your restaurant business & manage orders!" },
        restaurantAppLink: { type: String, default: "/res/landingpage" },
        restaurantAppIcon: { type: String, default: "" },
        sellerAppTitle: { type: String, default: "cityfood franchise" },
        sellerAppDesc: { type: String, default: "Join CityFood as our exclusive city franchise partner & grow exponentially!" },
        sellerAppLink: { type: String, default: "/franchise/landingpage" },
        sellerAppIcon: { type: String, default: "" },
        deliveryAppTitle: { type: String, default: "cityfood delivery" },
        deliveryAppDesc: { type: String, default: "Deliver with CityFood & earn flexible daily income with zero hassle!" },
        deliveryAppLink: { type: String, default: "/deli/landingpage" },
        deliveryAppIcon: { type: String, default: "" },
        qrCodeHeadline: { type: String, default: "Download the app now!" },
        qrCodeSubtitle: { type: String, default: "Experience seamless online ordering only on the CityFood app" },
        qrCodeText: { type: String, default: "Scan the QR code to download the app" },
        qrCodeImage: { type: String, default: "" },
        appLinks: {
            playStore: { type: String, default: 'https://play.google.com/store/apps/details?id=com.indian.Tuggo.user' },
            appStore: { type: String, default: '' }
        },
        socialLinks: {
            instagram: { type: String, default: '' },
            twitter: { type: String, default: '' },
            facebook: { type: String, default: '' },
            linkedin: { type: String, default: '' },
            youtube: { type: String, default: '' }
        },
        footerLinks: {
            about: {
                type: Array, default: [
                    { label: 'Who We Are', url: '#' },
                    { label: 'Blog', url: '#' },
                    { label: 'Work With Us', url: '#' },
                    { label: 'Investor Relations', url: '#' },
                    { label: 'Report Fraud', url: '#' }
                ]
            },
            forRestaurants: {
                type: Array, default: [
                    { label: 'Partner With Us', url: '#' },
                    { label: 'Apps For You', url: '#' }
                ]
            },
            learnMore: {
                type: Array, default: [
                    { label: 'Privacy', url: '#' },
                    { label: 'Security', url: '#' },
                    { label: 'Terms', url: '#' },
                    { label: 'Sitemap', url: '#' }
                ]
            }
        },
        copyrightText: {
            type: String,
            default: '© 2026 CityFood™ Ltd. All rights reserved.'
        },
        heroSlides: {
            type: Array,
            default: [
                {
                    id: 1,
                    type: 'image',
                    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2070&auto=format&fit=crop",
                    title: "Master Chef",
                    subtitle: "Experience the art of fine dining"
                },
                {
                    id: 2,
                    type: 'image',
                    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop",
                    title: "Exquisite Taste",
                    subtitle: "High-class Professional Service"
                },
                {
                    id: 3,
                    type: 'image',
                    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop",
                    title: "Tradition & Passion",
                    subtitle: "Only the best ingredients for our dishes"
                }
            ]
        }
    },
    {
        collection: 'food_landing_settings',
        timestamps: true
    }
);

export const FoodLandingSettings = mongoose.model('FoodLandingSettings', foodLandingSettingsSchema);

