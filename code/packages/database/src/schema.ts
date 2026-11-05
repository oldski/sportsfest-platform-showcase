// Showcase note: an excerpt of the Drizzle schema (about a third of it). Kept: the tenant core
// (user, organization, membership), the event-year scope, and the SportsFest tables that hang off
// it: players and their event interests, company teams and rosters, products, orders, payments,
// invoices, tents and coupons. Every SportsFest row carries organizationId and eventYearId;
// that pair is what scopes each query. The Auth.js tables and the template's CRM tables are omitted.

import {relations, sql} from 'drizzle-orm';
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

// Custom Types
// ---------------------------------------------------------------------------
// Showcase excerpt. Omitted from the full schema (83 definitions):
//   bytea, ActionType, ActorType, ContactRecord, ContactStage, ContactTaskStatus
//   DayOfWeek, FeedbackCategory, InvitationStatus, JoinRequestStatus, WebhookTrigger, actionTypeEnum
//   actorTypeEnum, contactRecordEnum, contactStageEnum, contactTaskStatusEnum, dayOfWeekEnum, feedbackCategoryEnum
//   invitationStatusEnum, joinRequestStatusEnum, webhookTriggerEnum, apiKeyTable, authenticatorAppTable, changeEmailRequestTable
//   contactTable, contactCommentTable, contactNoteTable, contactPageVisitTable, contactImageTable, contactTaskTable
//   favoriteTable, invitationTable, contactTagTable, accountTable, feedbackTable, notificationTable
//   resetPasswordRequestTable, userImageTable, sessionTable, verificationTokenTable, workHoursTable, workTimeSlotTable
//   contactActivityTable, webhookTable, organizationLogoTable, organizationJoinRequestTable, subscriptionTable, subscriptionItemTable
//   contactToContactTagTable, superAdminActionTable, paymentTable, apiKeyRelations, authenticatorAppRelations, organizationJoinRequestRelations
//   changeEmailRequestRelations, contactRelations, contactCommentRelations, contactNoteRelations, contactPageVisitRelations, contactTaskRelations
//   favoriteRelations, invitationRelations, accountRelations, feedbackRelations, notificationRelations, sessionRelations
//   workHoursRelations, workTimeSlotRelations, contactActivityRelations, webhookRelations, organizationLogoRelations, subscriptionRelations
//   subscriptionItemRelations, contactTagRelations, contactToContactTagRelations, productImageTable, paymentRelations, productImageRelations
//   cartSessionTable, cartSessionRelations, settingsTable, cartSession, productImage
// ---------------------------------------------------------------------------

export enum Role {
  MEMBER = 'member',
  ADMIN = 'admin'
}

export enum EventType {
  BEACH_VOLLEYBALL = 'beach_volleyball',
  TUG_OF_WAR = 'tug_of_war',
  CORN_TOSS = 'corn_toss',
  BOTE_BEACH_CHALLENGE = 'bote_beach_challenge',
  BEACH_DODGEBALL = 'beach_dodgeball'
}

export enum PlayerStatus {
  REGISTERED = 'registered',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  NO_SHOW = 'no_show',
  INACTIVE = 'inactive'
}

export enum ParticipationType {
  PLAYER = 'player',
  SPECTATOR = 'spectator',
  SUBSTITUTE = 'substitute'
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  NON_BINARY = 'non_binary',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say'
}

export enum TShirtSize {
  XS = 'xs',
  S = 's',
  M = 'm',
  L = 'l',
  XL = 'xl',
  XXL = 'xxl',
  XXXL = 'xxxl'
}

export enum PaymentType {
  TEAM_REGISTRATION = 'team_registration',
  TENT_RENTAL = 'tent_rental',
  PRODUCT_PURCHASE = 'product_purchase',
  DEPOSIT_PAYMENT = 'deposit_payment',
  BALANCE_PAYMENT = 'balance_payment'
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum ProductType {
  TENT_RENTAL = 'tent_rental',
  TEAM_REGISTRATION = 'team_registration', 
  MERCHANDISE = 'merchandise',
  EQUIPMENT = 'equipment',
  SERVICES = 'services'
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived'
}

export enum OrderStatus {
  PENDING = 'pending',
  PAYMENT_PROCESSING = 'payment_processing',
  CONFIRMED = 'confirmed',
  DEPOSIT_PAID = 'deposit_paid',
  FULLY_PAID = 'fully_paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

function enumToPgEnum<T extends Record<string, string>>(myEnum: T) {
  return Object.values(myEnum).map((value) => `${value}`) as [
    T[keyof T],
    ...T[keyof T][]
  ];
}

export const eventTypeEnum = pgEnum('eventtype', enumToPgEnum(EventType));

export const genderEnum = pgEnum('gender', enumToPgEnum(Gender));

export const tshirtSizeEnum = pgEnum('tshirtsize', enumToPgEnum(TShirtSize));

export const playerStatusEnum = pgEnum('playerstatus', enumToPgEnum(PlayerStatus));

export const participationTypeEnum = pgEnum('participationtype', enumToPgEnum(ParticipationType));

export const paymentTypeEnum = pgEnum('paymenttype', enumToPgEnum(PaymentType));

export const paymentStatusEnum = pgEnum('paymentstatus', enumToPgEnum(PaymentStatus));

export const productTypeEnum = pgEnum('producttype', enumToPgEnum(ProductType));

export const productStatusEnum = pgEnum('productstatus', enumToPgEnum(ProductStatus));

export const orderStatusEnum = pgEnum('orderstatus', enumToPgEnum(OrderStatus));

export const roleEnum = pgEnum('Role', enumToPgEnum(Role));

export const userTable = pgTable(
  'user',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text('email').unique(),
    emailVerified: timestamp('emailVerified', { precision: 3, mode: 'date' }),
    password: varchar('password', { length: 60 }),
    lastLogin: timestamp('lastLogin', { precision: 3, mode: 'date' }),
    locale: varchar('locale', { length: 8 }).default('en-US').notNull(),
    completedOnboarding: boolean('completedOnboarding')
      .default(false)
      .notNull(),
    enabledContactsNotifications: boolean('enabledContactsNotifications')
      .default(false)
      .notNull(),
    enabledInboxNotifications: boolean('enabledInboxNotifications')
      .default(false)
      .notNull(),
    enabledNewsletter: boolean('enabledNewsletter').default(false).notNull(),
    enabledProductUpdates: boolean('enabledProductUpdates')
      .default(false)
      .notNull(),
    enabledWeeklySummary: boolean('enabledWeeklySummary')
      .default(false)
      .notNull(),
    image: varchar('image', { length: 2048 }),
    name: varchar('name', { length: 64 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    referralSource: varchar('referralSource', { length: 255 }),
    referralSourceDetails: varchar('referralSourceDetails', { length: 500 }),
    isSportsFestAdmin: boolean('isSportsFestAdmin').default(false).notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex('IX_user_email_unique').using(
      'btree',
      table.email.asc().nullsLast().op('text_ops')
    ),
    index('IX_user_name').using(
      'btree',
      table.name.asc().nullsLast().op('text_ops')
    )
  ]
);

export const membershipTable = pgTable(
  'membership',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    organizationId: uuid('organizationId')
      .notNull()
      .references(() => organizationTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    userId: uuid('userId')
      .notNull()
      .references(() => userTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    role: roleEnum('role').default(Role.MEMBER).notNull(),
    isOwner: boolean('isOwner').default(false).notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex('IX_membership_organizationId_userId_unique').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops'),
      table.userId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_membership_userId').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_membership_organizationId').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    )
  ]
);

export const organizationTable = pgTable(
  'organization',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    address: varchar('address', { length: 255 }),
    address2: varchar('address2', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 50 }),
    zip: varchar('zip', { length: 10 }),
    email: varchar('email', { length: 255 }),
    website: varchar('website', { length: 2000 }),
    phone: varchar('phone', { length: 32 }),
    facebookPage: varchar('facebookPage', { length: 2000 }),
    instagramProfile: varchar('instagramProfile', { length: 2000 }),
    linkedInProfile: varchar('linkedInProfile', { length: 2000 }),
    tikTokProfile: varchar('tikTokProfile', { length: 2000 }),
    xProfile: varchar('xProfile', { length: 2000 }),
    youTubeChannel: varchar('youTubeChannel', { length: 2000 }),
    logo: varchar('logo', { length: 2048 }),
    slug: varchar('slug', { length: 255 }).notNull(),
    billingCustomerId: varchar('billingCustomerId', { length: 255 }),
    billingEmail: varchar('billingEmail', { length: 255 }),
    billingLine1: varchar('billingLine1', { length: 255 }),
    billingLine2: varchar('billingLine2', { length: 255 }),
    billingCountry: varchar('billingCountry', { length: 3 }),
    billingPostalCode: varchar('billingPostalCode', { length: 16 }),
    billingCity: varchar('billingCity', { length: 255 }),
    billingState: varchar('billingState', { length: 255 })
  },
  (table) => [
    index('IX_organization_billingCustomerId').using(
      'btree',
      table.billingCustomerId.asc().nullsLast().op('text_ops')
    ),
    uniqueIndex('IX_organization_slug_unique').using(
      'btree',
      table.slug.asc().nullsLast().op('text_ops')
    )
  ]
);

export const eventYearTable = pgTable(
  'eventYear',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    year: integer('year').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    eventStartDate: timestamp('eventStartDate', { precision: 3, mode: 'date' }).notNull(),
    eventEndDate: timestamp('eventEndDate', { precision: 3, mode: 'date' }).notNull(),
    registrationOpen: timestamp('registrationOpen', { precision: 3, mode: 'date' }).notNull(),
    registrationClose: timestamp('registrationClose', { precision: 3, mode: 'date' }).notNull(),
    locationName: varchar('locationName', { length: 255 }).notNull(),
    address: varchar('address', { length: 255 }).notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    state: varchar('state', { length: 50 }).notNull(),
    zipCode: varchar('zipCode', { length: 20 }).notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    isActive: boolean('isActive').default(false).notNull(),
    isDeleted: boolean('isDeleted').default(false).notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull()
  },
  (table) => [
    uniqueIndex('IX_eventYear_year_unique').using(
      'btree',
      table.year.asc().nullsLast()
    )
  ]
);

export const playerTable = pgTable(
  'player',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    organizationId: uuid('organizationId')
    .notNull()
    .references(() => organizationTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    eventYearId: uuid('eventYearId')
    .notNull()
    .references(() => eventYearTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    firstName: varchar('firstName', { length: 100 }).notNull(),
    lastName: varchar('lastName', { length: 100 }).notNull(),
    dateOfBirth: timestamp('dateOfBirth', { precision: 3, mode: 'date' }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }), // Optional
    gender: genderEnum('gender').notNull(),
    tshirtSize: tshirtSizeEnum('tshirtSize').notNull(),
    accuracyConfirmed: boolean('accuracyConfirmed').default(false).notNull(),
    waiverSigned: boolean('waiverSigned').default(false).notNull(),
    status: playerStatusEnum('status').default(PlayerStatus.REGISTERED).notNull(),
    participationType: participationTypeEnum('participationType').default(ParticipationType.PLAYER).notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
  },
  (table) => [
    // Email unique across ALL organizations AND event years
    uniqueIndex('IX_player_email_eventYear_unique').using(
      'btree',
      table.email.asc().nullsLast().op('text_ops'),
      table.eventYearId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_player_organizationId').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    // Age validation constraint
    sql`CHECK (EXTRACT(YEAR FROM AGE(dateOfBirth)) >= 18)`
  ]
);

export const companyTeamTable = pgTable(
  'companyTeam',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    organizationId: uuid('organizationId')
    .notNull()
    .references(() => organizationTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    eventYearId: uuid('eventYearId')
    .notNull()
    .references(() => eventYearTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    teamNumber: integer('teamNumber').notNull(), // 1, 2, 3, etc.
    name: varchar('name', { length: 255 }), // "Acme Warriors", "Tech Titans"
    isPaid: boolean('isPaid').default(false).notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
  },
  (table) => [
    // Unique team numbers per organization per year
    uniqueIndex('IX_companyTeam_org_eventYear_number_unique').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops'),
      table.eventYearId.asc().nullsLast().op('uuid_ops'),
      table.teamNumber.asc().nullsLast()
    ),
    index('IX_companyTeam_organizationId').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    )
  ]
);

export const playerEventInterestTable = pgTable(
  'playerEventInterest',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    playerId: uuid('playerId')
    .notNull()
    .references(() => playerTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    eventType: eventTypeEnum('eventType').notNull(),
    interestRating: integer('interestRating').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex('IX_playerEventInterest_playerId_eventType_unique').using(
      'btree',
      table.playerId.asc().nullsLast().op('uuid_ops'),
      table.eventType.asc().nullsLast()
    ),
    // Constraint: ratings must be 1-5
    sql`CHECK (interestRating >= 1 AND interestRating <= 5)`
  ]
);

export const teamRosterTable = pgTable(
  'teamRoster',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    companyTeamId: uuid('companyTeamId')
    .notNull()
    .references(() => companyTeamTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    playerId: uuid('playerId')
    .notNull()
    .references(() => playerTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    isCaptain: boolean('isCaptain').default(false).notNull(),
    assignedAt: timestamp('assignedAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull()
  },
  (table) => [
    // Player can only be on one company team (but captains can move them)
    uniqueIndex('IX_teamRoster_playerId_unique').using(
      'btree',
      table.playerId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_teamRoster_companyTeamId').using(
      'btree',
      table.companyTeamId.asc().nullsLast().op('uuid_ops')
    )
  ]
);

export const eventRosterTable = pgTable(
  'eventRoster',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    companyTeamId: uuid('companyTeamId')
    .notNull()
    .references(() => companyTeamTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    playerId: uuid('playerId')
    .notNull()
    .references(() => playerTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade'
    }),
    eventType: eventTypeEnum('eventType').notNull(),
    isStarter: boolean('isStarter').default(true).notNull(), // Starter vs backup
    squadLeader: boolean('squadLeader').default(false).notNull(), // One per event per team
    assignedAt: timestamp('assignedAt', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull()
  },
  (table) => [
    // Player can be in multiple events but only once per event per company team
    uniqueIndex('IX_eventRoster_player_companyTeam_event_unique').using(
      'btree',
      table.playerId.asc().nullsLast().op('uuid_ops'),
      table.companyTeamId.asc().nullsLast().op('uuid_ops'),
      table.eventType.asc().nullsLast()
    ),
    index('IX_eventRoster_companyTeamId').using(
      'btree',
      table.companyTeamId.asc().nullsLast().op('uuid_ops')
    )
  ]
);

export const organizationRelations = relations(
  organizationTable,
  ({ many }) => ({
    memberships: many(membershipTable),
    // SportsFest relations
    players: many(playerTable),
    companyTeams: many(companyTeamTable)
  })
);

export const userRelations = relations(userTable, ({ many }) => ({
  memberships: many(membershipTable)
}));

export const membershipRelations = relations(membershipTable, ({ one }) => ({
  user: one(userTable, {
    fields: [membershipTable.userId],
    references: [userTable.id]
  }),
  organization: one(organizationTable, {
    fields: [membershipTable.organizationId],
    references: [organizationTable.id]
  })
}));

export const eventYearRelations = relations(eventYearTable, ({ many }) => ({
  players: many(playerTable),
  companyTeams: many(companyTeamTable)
}));

export const playerRelations = relations(playerTable, ({ one, many }) => ({
  organization: one(organizationTable, {
    fields: [playerTable.organizationId],
    references: [organizationTable.id]
  }),
  eventYear: one(eventYearTable, {
    fields: [playerTable.eventYearId],
    references: [eventYearTable.id]
  }),
  eventInterests: many(playerEventInterestTable),
  teamMembership: one(teamRosterTable), // Player can only be on one company team
  eventRosters: many(eventRosterTable) // But can be in multiple event rosters
}));

export const productCategoryTable = pgTable(
  'productCategory',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    displayOrder: integer('displayOrder').default(0),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex('IX_productCategory_name_unique').using(
      'btree',
      table.name.asc().nullsLast().op('text_ops')
    )
  ]
);

export const productTable = pgTable(
  'product',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    categoryId: uuid('categoryId')
      .notNull()
      .references(() => productCategoryTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    eventYearId: uuid('eventYearId')
      .notNull()
      .references(() => eventYearTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    image: varchar('image', { length: 2048 }),
    type: productTypeEnum('type').notNull(),
    status: productStatusEnum('status').default(ProductStatus.ACTIVE).notNull(),
    basePrice: doublePrecision('basePrice').notNull(),
    requiresDeposit: boolean('requiresDeposit').default(false).notNull(),
    depositAmount: doublePrecision('depositAmount'),
    maxQuantityPerOrg: integer('maxQuantityPerOrg'),
    totalInventory: integer('totalInventory'),
    soldCount: integer('soldcount').default(0).notNull(),
    reservedCount: integer('reservedcount').default(0).notNull(),
    displayOrder: integer('displayOrder').default(0),
    metadata: jsonb('metadata'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index('IX_product_categoryId').using(
      'btree',
      table.categoryId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_product_eventYearId').using(
      'btree',
      table.eventYearId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_product_status').using(
      'btree',
      table.status.asc().nullsLast()
    )
  ]
);

export const organizationPricingTable = pgTable(
  'organizationPricing',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    productId: uuid('productId')
      .notNull()
      .references(() => productTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    organizationId: uuid('organizationId')
      .notNull()
      .references(() => organizationTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    customPrice: doublePrecision('customPrice'),
    customDepositAmount: doublePrecision('customDepositAmount'),
    maxQuantity: integer('maxQuantity'),
    isWaived: boolean('isWaived').default(false).notNull(),
    waiverReason: text('waiverReason'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex('IX_organizationPricing_product_org_unique').using(
      'btree',
      table.productId.asc().nullsLast().op('uuid_ops'),
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_organizationPricing_productId').using(
      'btree',
      table.productId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_organizationPricing_organizationId').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    )
  ]
);

export const orderTable = pgTable(
  'order',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    orderNumber: varchar('orderNumber', { length: 50 }).notNull(),
    organizationId: uuid('organizationId')
      .notNull()
      .references(() => organizationTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    eventYearId: uuid('eventYearId')
      .notNull()
      .references(() => eventYearTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    status: orderStatusEnum('status').default(OrderStatus.PENDING).notNull(),
    totalAmount: doublePrecision('totalAmount').notNull(),
    depositAmount: doublePrecision('depositAmount').default(0).notNull(),
    balanceOwed: doublePrecision('balanceOwed').notNull(),
    stripeSessionId: varchar('stripeSessionId', { length: 255 }),
    stripePaymentIntentId: varchar('stripePaymentIntentId', { length: 255 }),
    isManuallyCreated: boolean('isManuallyCreated').default(false).notNull(),
    isSponsorship: boolean('isSponsorship').default(false).notNull(),
    notes: text('notes'),
    metadata: jsonb('metadata').$type<{
      cartItems?: any[];
      paymentType?: 'full' | 'deposit';
      originalTotal?: number;
      couponDiscount?: number;
      appliedCoupon?: {
        id: string;
        code: string;
        discountType: 'percentage' | 'fixed_amount';
        discountValue: number;
        calculatedDiscount: number;
      } | null;
      sponsorship?: {
        baseAmount: number;
        processingFee: number;
        description?: string;
      };
      lastPaymentFailure?: {
        paymentIntentId: string;
        failedAt: string;
        error: string;
      };
    }>(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex('IX_order_orderNumber_unique').using(
      'btree',
      table.orderNumber.asc().nullsLast().op('text_ops')
    ),
    index('IX_order_organizationId').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_order_eventYearId').using(
      'btree',
      table.eventYearId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_order_status').using(
      'btree',
      table.status.asc().nullsLast()
    ),
    index('IX_order_isSponsorship').using(
      'btree',
      table.isSponsorship.asc().nullsLast()
    )
  ]
);

export const orderItemTable = pgTable(
  'orderItem',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    orderId: uuid('orderId')
      .notNull()
      .references(() => orderTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    productId: uuid('productId')
      .notNull()
      .references(() => productTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    quantity: integer('quantity').notNull(),
    unitPrice: doublePrecision('unitPrice').notNull(),
    depositPrice: doublePrecision('depositPrice').default(0).notNull(),
    totalPrice: doublePrecision('totalPrice').notNull(),
    productSnapshot: jsonb('productSnapshot'), // Store product details at time of order
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index('IX_orderItem_orderId').using(
      'btree',
      table.orderId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_orderItem_productId').using(
      'btree',
      table.productId.asc().nullsLast().op('uuid_ops')
    )
  ]
);

export const orderPaymentTable = pgTable(
  'orderPayment',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    orderId: uuid('orderId')
      .notNull()
      .references(() => orderTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    type: paymentTypeEnum('type').notNull(),
    status: paymentStatusEnum('status').default(PaymentStatus.PENDING).notNull(),
    amount: doublePrecision('amount').notNull(),
    stripePaymentIntentId: varchar('stripePaymentIntentId', { length: 255 }),
    stripeChargeId: varchar('stripeChargeId', { length: 255 }),
    paymentMethodType: varchar('paymentMethodType', { length: 50 }),
    last4: varchar('last4', { length: 4 }),
    failureReason: text('failureReason'),
    processedAt: timestamp('processedAt', { precision: 3, mode: 'date' }),
    refundedAt: timestamp('refundedAt', { precision: 3, mode: 'date' }),
    refundAmount: doublePrecision('refundAmount'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index('IX_orderPayment_orderId').using(
      'btree',
      table.orderId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_orderPayment_status').using(
      'btree',
      table.status.asc().nullsLast()
    ),
    index('IX_orderPayment_stripePaymentIntentId').using(
      'btree',
      table.stripePaymentIntentId.asc().nullsLast().op('text_ops')
    )
  ]
);

export const orderInvoiceTable = pgTable(
  'orderInvoice',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    orderId: uuid('orderId')
      .notNull()
      .references(() => orderTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    invoiceNumber: varchar('invoiceNumber', { length: 50 }).notNull(),
    totalAmount: doublePrecision('totalAmount').notNull(),
    paidAmount: doublePrecision('paidAmount').default(0).notNull(),
    balanceOwed: doublePrecision('balanceOwed').notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, sent, paid, overdue, cancelled
    dueDate: timestamp('dueDate', { precision: 3, mode: 'date' }),
    paidAt: timestamp('paidAt', { precision: 3, mode: 'date' }),
    sentAt: timestamp('sentAt', { precision: 3, mode: 'date' }),
    stripeInvoiceId: varchar('stripeInvoiceId', { length: 255 }),
    downloadUrl: text('downloadUrl'),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex('IX_orderInvoice_invoiceNumber_unique').using(
      'btree',
      table.invoiceNumber.asc().nullsLast().op('text_ops')
    ),
    index('IX_orderInvoice_orderId').using(
      'btree',
      table.orderId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_orderInvoice_status').using(
      'btree',
      table.status.asc().nullsLast().op('text_ops')
    )
  ]
);

export const tentPurchaseTrackingTable = pgTable(
  'tentPurchaseTracking',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    organizationId: uuid('organizationId')
      .notNull()
      .references(() => organizationTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    eventYearId: uuid('eventYearId')
      .notNull()
      .references(() => eventYearTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    tentProductId: uuid('tentProductId')
      .notNull()
      .references(() => productTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    quantityPurchased: integer('quantityPurchased').notNull(),
    maxAllowed: integer('maxAllowed').notNull(),
    remainingAllowed: integer('remainingAllowed').notNull(),
    companyTeamCount: integer('companyTeamCount').notNull().default(0),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex('IX_tentPurchaseTracking_org_eventYear_product_unique').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops'),
      table.eventYearId.asc().nullsLast().op('uuid_ops'),
      table.tentProductId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_tentPurchaseTracking_organizationId').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_tentPurchaseTracking_eventYearId').using(
      'btree',
      table.eventYearId.asc().nullsLast().op('uuid_ops')
    )
  ]
);

export const playerEventInterestRelations = relations(playerEventInterestTable, ({ one }) => ({
  player: one(playerTable, {
    fields: [playerEventInterestTable.playerId],
    references: [playerTable.id]
  })
}));

export const companyTeamRelations = relations(companyTeamTable, ({ one, many }) => ({
  organization: one(organizationTable, {
    fields: [companyTeamTable.organizationId],
    references: [organizationTable.id]
  }),
  eventYear: one(eventYearTable, {
    fields: [companyTeamTable.eventYearId],
    references: [eventYearTable.id]
  }),
  teamRoster: many(teamRosterTable),
  eventRosters: many(eventRosterTable)
}));

export const teamRosterRelations = relations(teamRosterTable, ({ one }) => ({
  companyTeam: one(companyTeamTable, {
    fields: [teamRosterTable.companyTeamId],
    references: [companyTeamTable.id]
  }),
  player: one(playerTable, {
    fields: [teamRosterTable.playerId],
    references: [playerTable.id]
  })
}));

export const eventRosterRelations = relations(eventRosterTable, ({ one }) => ({
  companyTeam: one(companyTeamTable, {
    fields: [eventRosterTable.companyTeamId],
    references: [companyTeamTable.id]
  }),
  player: one(playerTable, {
    fields: [eventRosterTable.playerId],
    references: [playerTable.id]
  })
}));

export const productCategoryRelations = relations(productCategoryTable, ({ many }) => ({
  products: many(productTable)
}));

export const productRelations = relations(productTable, ({ one, many }) => ({
  category: one(productCategoryTable, {
    fields: [productTable.categoryId],
    references: [productCategoryTable.id]
  }),
  eventYear: one(eventYearTable, {
    fields: [productTable.eventYearId],
    references: [eventYearTable.id]
  }),
  organizationPricing: many(organizationPricingTable),
  orderItems: many(orderItemTable),
  tentPurchases: many(tentPurchaseTrackingTable)
}));

export const organizationPricingRelations = relations(organizationPricingTable, ({ one }) => ({
  product: one(productTable, {
    fields: [organizationPricingTable.productId],
    references: [productTable.id]
  }),
  organization: one(organizationTable, {
    fields: [organizationPricingTable.organizationId],
    references: [organizationTable.id]
  })
}));

export const orderRelations = relations(orderTable, ({ one, many }) => ({
  organization: one(organizationTable, {
    fields: [orderTable.organizationId],
    references: [organizationTable.id]
  }),
  eventYear: one(eventYearTable, {
    fields: [orderTable.eventYearId],
    references: [eventYearTable.id]
  }),
  orderItems: many(orderItemTable),
  payments: many(orderPaymentTable),
  invoices: many(orderInvoiceTable)
}));

export const orderItemRelations = relations(orderItemTable, ({ one }) => ({
  order: one(orderTable, {
    fields: [orderItemTable.orderId],
    references: [orderTable.id]
  }),
  product: one(productTable, {
    fields: [orderItemTable.productId],
    references: [productTable.id]
  })
}));

export const orderPaymentRelations = relations(orderPaymentTable, ({ one }) => ({
  order: one(orderTable, {
    fields: [orderPaymentTable.orderId],
    references: [orderTable.id]
  })
}));

export const orderInvoiceRelations = relations(orderInvoiceTable, ({ one }) => ({
  order: one(orderTable, {
    fields: [orderInvoiceTable.orderId],
    references: [orderTable.id]
  })
}));

export const tentPurchaseTrackingRelations = relations(tentPurchaseTrackingTable, ({ one }) => ({
  organization: one(organizationTable, {
    fields: [tentPurchaseTrackingTable.organizationId],
    references: [organizationTable.id]
  }),
  eventYear: one(eventYearTable, {
    fields: [tentPurchaseTrackingTable.eventYearId],
    references: [eventYearTable.id]
  }),
  tentProduct: one(productTable, {
    fields: [tentPurchaseTrackingTable.tentProductId],
    references: [productTable.id]
  })
}));

export const couponTable = pgTable(
  'coupon',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    eventYearId: uuid('eventYearId')
      .notNull()
      .references(() => eventYearTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      }),
    discountType: varchar('discountType', { length: 20 }).notNull(), // 'percentage' | 'fixed_amount'
    discountValue: doublePrecision('discountValue').notNull(),
    organizationRestriction: varchar('organizationRestriction', { length: 20 }).default('anyone').notNull(), // 'anyone' | 'specific'
    restrictedOrganizations: jsonb('restrictedOrganizations'), // Array of organization IDs when restriction is 'specific'
    maxUses: integer('maxUses').default(1).notNull(),
    currentUses: integer('currentUses').default(0).notNull(),
    minimumOrderAmount: doublePrecision('minimumOrderAmount').default(0).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    expiresAt: timestamp('expiresAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index('IX_coupon_code').using(
      'btree',
      table.code.asc().nullsLast().op('text_ops')
    ),
    index('IX_coupon_eventYearId').using(
      'btree',
      table.eventYearId.asc().nullsLast().op('uuid_ops')
    ),
    index('IX_coupon_isActive').using(
      'btree',
      table.isActive.asc().nullsLast()
    ),
    index('IX_coupon_expiresAt').using(
      'btree',
      table.expiresAt.asc().nullsLast()
    )
  ]
);

export const couponRelations = relations(couponTable, ({ one }) => ({
  eventYear: one(eventYearTable, {
    fields: [couponTable.eventYearId],
    references: [eventYearTable.id]
  })
}));

export const coupon = couponTable;

export const order = orderTable;

export const orderItem = orderItemTable;

export const orderPayment = orderPaymentTable;

export const orderInvoice = orderInvoiceTable;

export const product = productTable;

export const productCategory = productCategoryTable;

export const organizationPricing = organizationPricingTable;

export const tentPurchaseTracking = tentPurchaseTrackingTable;
