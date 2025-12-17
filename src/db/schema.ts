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
