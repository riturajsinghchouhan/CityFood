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
        festBannerImages: {
            type: [String],
            default: []
        },
        stats: {
            restaurants: { type: String, default: '3,00,000+' },
            cities: { type: String, default: '800+' },
            orders: { type: String, default: '3 billion+' }
        },
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

