import { pgTable, text, serial, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    brand: text('brand').notNull(),
    role: text('role').default('vendor').notNull(), // 'admin' or 'vendor'
    vatNumber: text('vat_number'),
    warehouseAddress: jsonb('warehouse_address'), // { street, city, zip, country }
    shippingCountries: jsonb('shipping_countries').default([]), // Array of country codes e.g. ['NL', 'BE', 'DE']
    createdAt: timestamp('created_at').defaultNow(),
});

export const vendorApplications = pgTable('vendor_applications', {
    id: serial('id').primaryKey(),
    companyName: text('company_name').notNull(),
    email: text('email').notNull(),
    vatNumber: text('vat_number').notNull(),
    country: text('country').notNull(), // ISO code e.g. 'FR', 'DE'
    warehouseAddress: jsonb('warehouse_address').notNull(),
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

export const saleorAuth = pgTable('saleor_auth', {
    saleorApiUrl: text('saleor_api_url').primaryKey().notNull(),
    token: text('token').notNull(),
    appId: text('app_id').notNull(),
    jwks: text('jwks'),
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
