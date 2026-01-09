import { db } from "./src/db";
import { users } from "./src/db/schema";
import { isNotNull, isNull, and } from "drizzle-orm";

async function checkVendors() {
  const vendors = await db.select()
    .from(users)
    .where(and(
      isNotNull(users.saleorPageSlug),
      isNull(users.payloadBrandPageId)
    ));
  
  console.log(`Found ${vendors.length} vendors ready for migration:`);
  vendors.forEach(v => {
    console.log(`- ID: ${v.id}, Slug: ${v.saleorPageSlug}, Brand: ${v.brandName || v.brand}`);
  });
  process.exit(0);
}

checkVendors().catch(err => {
  console.error(err);
  process.exit(1);
});
