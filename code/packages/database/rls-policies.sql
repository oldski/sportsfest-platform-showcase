-- Showcase note: row-level security policies applied by hand on the Supabase project. They key on
-- auth.uid(), so they guard the Supabase REST surface. The app itself signs in with Auth.js and
-- queries through a plain Postgres pool, so its own queries are scoped by organizationId and
-- eventYearId in the data layer and server actions. These policies are a second lock, not the first.

-- Enable RLS on all SportsFest tables
ALTER TABLE "companyTeam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "playerEventInterest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teamRoster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eventRoster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "superAdminAction" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on new Event Registration tables
ALTER TABLE "productCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizationPricing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orderPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tentPurchaseTracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orderInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cartSession" ENABLE ROW LEVEL SECURITY;


-- Company Team Policies
CREATE POLICY "Users can view company teams from their organization" ON "companyTeam"
FOR SELECT USING (
             "organizationId" IN (
             SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
             )
             );

CREATE POLICY "Users can insert company teams for their organization" ON "companyTeam"
FOR INSERT WITH CHECK (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
  )
);

CREATE POLICY "Users can update company teams in their organization" ON "companyTeam"
FOR UPDATE USING (
                    "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
                    )
                    ) WITH CHECK (
                    "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
                    )
                    );

CREATE POLICY "Super admins can manage all company teams" ON "companyTeam"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Player Policies
CREATE POLICY "Users can view players from their organization" ON "player"
FOR SELECT USING (
                    "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    );

CREATE POLICY "Users can insert players to their organization" ON "player"
FOR INSERT WITH CHECK (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
  )
);

CREATE POLICY "Users can update players in their organization" ON "player"
FOR UPDATE USING (
                    "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    ) WITH CHECK (
                    "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    );

CREATE POLICY "Super admins can manage all players" ON "player"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Player Event Interest Policies
CREATE POLICY "Users can view player interests from their organization" ON "playerEventInterest"
FOR SELECT USING (
                    "playerId" IN (
                    SELECT "id" FROM "player" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    );

CREATE POLICY "Users can insert player interests for their organization" ON "playerEventInterest"
FOR INSERT WITH CHECK (
  "playerId" IN (
    SELECT "id" FROM "player" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
    )
  )
);

CREATE POLICY "Users can update player interests in their organization" ON "playerEventInterest"
FOR UPDATE USING (
                    "playerId" IN (
                    SELECT "id" FROM "player" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    ) WITH CHECK (
                    "playerId" IN (
                    SELECT "id" FROM "player" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    );

CREATE POLICY "Super admins can manage all player interests" ON "playerEventInterest"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Team Roster Policies
CREATE POLICY "Users can view team rosters from their organization" ON "teamRoster"
FOR SELECT USING (
                    "companyTeamId" IN (
                    SELECT "id" FROM "companyTeam" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    );

CREATE POLICY "Users can assign players to their company teams" ON "teamRoster"
FOR INSERT WITH CHECK (
  "companyTeamId" IN (
    SELECT "id" FROM "companyTeam" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
    )
  )
);

CREATE POLICY "Users can update team rosters in their organization" ON "teamRoster"
FOR UPDATE USING (
                    "companyTeamId" IN (
                    SELECT "id" FROM "companyTeam" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    ) WITH CHECK (
                    "companyTeamId" IN (
                    SELECT "id" FROM "companyTeam" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    );

CREATE POLICY "Super admins can manage all team rosters" ON "teamRoster"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Event Roster Policies
CREATE POLICY "Users can view event rosters from their organization" ON "eventRoster"
FOR SELECT USING (
                    "companyTeamId" IN (
                    SELECT "id" FROM "companyTeam" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    );

CREATE POLICY "Users can assign players to event rosters" ON "eventRoster"
FOR INSERT WITH CHECK (
  "companyTeamId" IN (
    SELECT "id" FROM "companyTeam" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
    )
  )
);

CREATE POLICY "Users can update event rosters in their organization" ON "eventRoster"
FOR UPDATE USING (
                    "companyTeamId" IN (
                    SELECT "id" FROM "companyTeam" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    ) WITH CHECK (
                    "companyTeamId" IN (
                    SELECT "id" FROM "companyTeam" WHERE "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    )
                    );

CREATE POLICY "Super admins can manage all event rosters" ON "eventRoster"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);


-- Payment Policies
CREATE POLICY "Users can view payments from their organization" ON "payment"
FOR SELECT USING (
                    "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                    )
                    );

CREATE POLICY "Admins can create payments for their organization" ON "payment"
FOR INSERT WITH CHECK (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
  )
);

CREATE POLICY "Admins can update payments in their organization" ON "payment"
FOR UPDATE USING (
                    "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
                    )
                    ) WITH CHECK (
                    "organizationId" IN (
                    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
                    )
                    );

CREATE POLICY "Super admins can manage all payments" ON "payment"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Super Admin Action Policies
CREATE POLICY "Only super admins can access admin action logs" ON "superAdminAction"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- ========================================================================
-- EVENT REGISTRATION SYSTEM POLICIES
-- ========================================================================

-- Product Category Policies (Admin-only management)
CREATE POLICY "Only super admins can manage product categories" ON "productCategory"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

CREATE POLICY "Users can view product categories" ON "productCategory"
FOR SELECT USING (true); -- All authenticated users can view categories

-- Product Policies (Admin-only management, users can view)
CREATE POLICY "Only super admins can manage products" ON "product"
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

CREATE POLICY "Only super admins can update products" ON "product"
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

CREATE POLICY "Only super admins can delete products" ON "product"
FOR DELETE USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

CREATE POLICY "Users can view active products" ON "product"
FOR SELECT USING ("status" = 'active'); -- All users can view active products

-- Organization Pricing Policies (Admin manages, orgs can view their pricing)
CREATE POLICY "Super admins can manage all organization pricing" ON "organizationPricing"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

CREATE POLICY "Users can view pricing for their organization" ON "organizationPricing"
FOR SELECT USING (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
  )
);

-- Order Policies (Organization isolation)
CREATE POLICY "Users can view orders from their organization" ON "order"
FOR SELECT USING (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
  )
);

CREATE POLICY "Organization admins can create orders for their organization" ON "order"
FOR INSERT WITH CHECK (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
  )
);

CREATE POLICY "Organization admins can update orders in their organization" ON "order"
FOR UPDATE USING (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
  )
) WITH CHECK (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
  )
);

CREATE POLICY "Super admins can manage all orders" ON "order"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Order Item Policies (Follow order permissions)
CREATE POLICY "Users can view order items from their organization orders" ON "orderItem"
FOR SELECT USING (
  "orderId" IN (
    SELECT "id" FROM "order" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
    )
  )
);

CREATE POLICY "Organization admins can manage order items for their orders" ON "orderItem"
FOR INSERT WITH CHECK (
  "orderId" IN (
    SELECT "id" FROM "order" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
    )
  )
);

CREATE POLICY "Organization admins can update order items in their organization" ON "orderItem"
FOR UPDATE USING (
  "orderId" IN (
    SELECT "id" FROM "order" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
    )
  )
) WITH CHECK (
  "orderId" IN (
    SELECT "id" FROM "order" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
    )
  )
);

CREATE POLICY "Super admins can manage all order items" ON "orderItem"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Order Payment Policies (Follow order permissions)
CREATE POLICY "Users can view payments for their organization orders" ON "orderPayment"
FOR SELECT USING (
  "orderId" IN (
    SELECT "id" FROM "order" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
    )
  )
);

CREATE POLICY "Organization admins can create payments for their orders" ON "orderPayment"
FOR INSERT WITH CHECK (
  "orderId" IN (
    SELECT "id" FROM "order" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
    )
  )
);

CREATE POLICY "Organization admins can update payments for their orders" ON "orderPayment"
FOR UPDATE USING (
  "orderId" IN (
    SELECT "id" FROM "order" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
    )
  )
) WITH CHECK (
  "orderId" IN (
    SELECT "id" FROM "order" WHERE "organizationId" IN (
      SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
    )
  )
);

CREATE POLICY "Super admins can manage all order payments" ON "orderPayment"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Tent Purchase Tracking Policies (Organization isolation)
CREATE POLICY "Users can view tent purchases from their organization" ON "tentPurchaseTracking"
FOR SELECT USING (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
  )
);

CREATE POLICY "Organization admins can create tent purchases for their organization" ON "tentPurchaseTracking"
FOR INSERT WITH CHECK (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
  )
);

CREATE POLICY "Organization admins can update tent purchases in their organization" ON "tentPurchaseTracking"
FOR UPDATE USING (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
  )
) WITH CHECK (
  "organizationId" IN (
    SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
  )
);

CREATE POLICY "Super admins can manage all tent purchases" ON "tentPurchaseTracking"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);


-- Users can view invoices from their organization orders
  CREATE POLICY "Users can view invoices from their organization orders" ON "orderInvoice"
  FOR SELECT USING (
                        "orderId" IN (
                        SELECT "id" FROM "order" WHERE "organizationId" IN (
                        SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid()
                        )
                        )
                        );

-- Organization admins can create invoices for their organization orders
CREATE POLICY "Organization admins can create invoices for their orders" ON "orderInvoice"
  FOR INSERT WITH CHECK (
    "orderId" IN (
      SELECT "id" FROM "order" WHERE "organizationId" IN (
        SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
      )
    )
  );

  -- Organization admins can update invoices for their organization orders
  CREATE POLICY "Organization admins can update invoices for their orders" ON "orderInvoice"
  FOR UPDATE USING (
                        "orderId" IN (
                        SELECT "id" FROM "order" WHERE "organizationId" IN (
                        SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
                        )
                        )
                        ) WITH CHECK (
                        "orderId" IN (
                        SELECT "id" FROM "order" WHERE "organizationId" IN (
                        SELECT "organizationId" FROM "membership" WHERE "userId" = auth.uid() AND "role" = 'admin'
                        )
                        )
                        );

-- Super admins can manage all invoices
CREATE POLICY "Super admins can manage all invoices" ON "orderInvoice"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
  );


 -- Cart Session Policies
  CREATE POLICY "Users can manage their own cart sessions" ON "cartSession"
  FOR ALL USING (
    -- User can access their own cart sessions
    "userId" = auth.uid() OR
    -- Organization members can access carts for their organization
    EXISTS (
      SELECT 1 FROM "membership" m
      WHERE m."userId" = auth.uid()
      AND m."organizationId" = "cartSession"."organizationId"
    )
  ) WITH CHECK (
    -- Same conditions for inserts/updates
    "userId" = auth.uid() OR
    EXISTS (
      SELECT 1 FROM "membership" m
      WHERE m."userId" = auth.uid()
      AND m."organizationId" = "cartSession"."organizationId"
    )
  );

  CREATE POLICY "Super admins can manage all cart sessions" ON "cartSession"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
  );

-- ========================================================================
-- SETTINGS TABLE POLICIES
-- ========================================================================
-- The settings table stores sensitive application configuration values
-- (API tokens, secrets, etc.) and should only be accessible by super admins.
-- Service role automatically bypasses RLS for backend operations.

ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage application settings
CREATE POLICY "Only super admins can manage settings" ON "settings"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- ========================================================================
-- COUPON TABLE POLICIES
-- ========================================================================
-- Coupons are admin-managed but viewable by users during checkout

ALTER TABLE "coupon" ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all coupons
CREATE POLICY "Super admins can manage all coupons" ON "coupon"
FOR ALL USING (
  EXISTS (SELECT 1 FROM "user" WHERE "id" = auth.uid() AND "isSportsFestAdmin" = true)
);

-- Organization members can view active coupons that apply to them
CREATE POLICY "Users can view applicable active coupons" ON "coupon"
FOR SELECT USING (
  "isActive" = true AND
  (
    -- Coupon is available to anyone
    "organizationRestriction" = 'anyone' OR
    -- Or user is in an organization that this coupon applies to
    (
      "organizationRestriction" = 'specific' AND
      EXISTS (
        SELECT 1 FROM "membership" m
        WHERE m."userId" = auth.uid()
        AND m."organizationId"::text IN (
          SELECT jsonb_array_elements_text("restrictedOrganizations")
        )
      )
    )
  )
);
