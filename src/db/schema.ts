import { pgTable, text, serial, timestamp, jsonb, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    brand: text('brand').notNull(),
    role: text('role').default('vendor').notNull(), // 'admin' or 'vendor'
    vatNumber: text('vat_number'),
    legalBusinessName: text('legal_business_name'),
    brandName: text('brand_name'),
    registrationNumber: text('registration_number'),
    saleorPageSlug: text('saleor_page_slug'),
    eoriNumber: text('eori_number'),
    phoneNumber: text('phone_number'),
    websiteUrl: text('website_url'),
    street: text('street'),
    city: text('city'),
    postalCode: text('postal_code'),
    countryCode: text('country_code'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    geocodedAt: timestamp('geocoded_at'),
    warehouseAddress: jsonb('warehouse_address'), // { street, city, zip, country }
    shippingCountries: jsonb('shipping_countries').default([]), // Array of country codes e.g. ['NL', 'BE', 'DE']
    twoFactorSecret: text('two_factor_secret'),
    twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
    resetToken: text('reset_token'),
    resetTokenExpiry: timestamp('reset_token_expiry'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const saleorAuth = pgTable('saleor_auth', {
    saleorApiUrl: text('saleor_api_url').primaryKey().notNull(),
    token: text('token').notNull(),
    appId: text('app_id').notNull(),
    jwks: text('jwks'),
});

export const vendorApplications = pgTable('vendor_applications', {
    id: serial('id').primaryKey(),
    companyName: text('company_name').notNull(),
    email: text('email').notNull(),
    vatNumber: text('vat_number').notNull(),
    legalBusinessName: text('legal_business_name'),
    brandName: text('brand_name'),
    registrationNumber: text('registration_number'),
    eoriNumber: text('eori_number'),
    phoneNumber: text('phone_number'),
    websiteUrl: text('website_url'),
    street: text('street'),
    city: text('city'),
    postalCode: text('postal_code'),
    countryCode: text('country_code'),
    country: text('country'), // KEEP FOR MIGRATION
    warehouseAddress: jsonb('warehouse_address'), // KEEP FOR MIGRATION
    status: text('status').default('pending').notNull(), // 'pending', 'approved', 'rejected'
    createdAt: timestamp('created_at').defaultNow(),
    processedAt: timestamp('processed_at'),
});

export const integrations = pgTable('integrations', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    provider: text('provider').notNull(), // 'shopify', 'woocommerce'
    storeUrl: text('store_url').notNull(),
    accessToken: text('access_token').notNull(),
    status: text('status').default('active').notNull(),
    settings: jsonb('settings'), // { sync_inventory: boolean, shipping_provider: string }
    createdAt: timestamp('created_at').defaultNow(),
});

export const featureRequests = pgTable('feature_requests', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    priority: text('priority').default('medium').notNull(), // 'low', 'medium', 'high'
    status: text('status').default('pending').notNull(), // 'pending', 'approved', 'rejected', 'implemented'
    createdAt: timestamp('created_at').defaultNow(),
});

export const productOverrides = pgTable('product_overrides', {
    id: serial('id').primaryKey(),
    productId: text('product_id').notNull().unique(), // Saleor Product ID
    shippingCountries: jsonb('shipping_countries').notNull(), // Array of country codes
    updatedAt: timestamp('updated_at').defaultNow(),
});
