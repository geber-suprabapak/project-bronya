import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Public schema tables from Supabase
 */

// absences
export const absences = pgTable(
  "absences",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    date: date("date").notNull(),
    reason: text("reason"),
    photoUrl: text("photo_url"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    status: text("status").notNull(),
  },
  (t) => [
    sql`CONSTRAINT absences_status_check CHECK (${t.status} = ANY (ARRAY['Hadir','Terlambat','Pulang','Alpha']))`,
  ],
);

// user_profiles
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).notNull().primaryKey(),
    userId: uuid("user_id").notNull(),
    nis: text("nis"),
    fullName: text("full_name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    absenceNumber: text("absence_number"),
    className: text("class_name"),
    gender: text("gender"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    role: text("role"),
  },
  (t) => [uniqueIndex("user_profiles_user_id_unique").on(t.userId)],
);

export const absencesRelations = relations(absences, ({ one }) => ({
  userProfile: one(userProfiles, {
    fields: [absences.userId],
    references: [userProfiles.userId],
  }),
}));

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  perizinan: many(perizinan),
  absences: many(absences),
}));

// perizinan
export const perizinan = pgTable(
  "perizinan",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).notNull().primaryKey(),
    userId: uuid("user_id").notNull(),
    tanggal: timestamp("tanggal", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    kategoriIzin: text("kategori_izin").notNull(),
    deskripsi: text("deskripsi"),
    linkFoto: text("link_foto"),
    approvalStatus: text("approval_status").default(sql`'pending'`).notNull(),
    status: boolean("status").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: text("rejected_by"),
    tanggalUtcDate: date("tanggal_utc_date"),
  },
  (t) => [
    sql`CONSTRAINT perizinan_kategori_izin_check CHECK (${t.kategoriIzin} = ANY (ARRAY['sakit','pergi']))`,
    sql`CONSTRAINT perizinan_approval_status_check CHECK (${t.approvalStatus} = ANY (ARRAY['pending','approved','rejected']))`,
  ],
);

export const perizinanRelations = relations(perizinan, ({ one }) => ({
  userProfile: one(userProfiles, {
    fields: [perizinan.userId],
    references: [userProfiles.userId],
  }),
}));

// biodata_siswa
export const biodataSiswa = pgTable("biodata_siswa", {
  nis: bigint("nis", { mode: "bigint" }).primaryKey().notNull(),
  nama: text("nama"),
  kelas: text("kelas"),
  absen: integer("absen"),
  kelamin: text("kelamin"),
  activated: boolean("activated").default(false).notNull(),
});

// location
export const location = pgTable("location", {
  id: integer("id").primaryKey().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  longitude: doublePrecision("longitude").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  distance: integer("distance").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// jadwal_absensi
export const jadwalAbsensi = pgTable("jadwal_absensi", {
  id: integer("id").primaryKey().notNull(),
  hari: varchar("hari", { length: 20 }).notNull(),
  mulaiMasuk: varchar("mulai_masuk", { length: 8 }).notNull(),
  selesaiMasuk: varchar("selesai_masuk", { length: 8 }).notNull(),
  mulaiPulang: varchar("mulai_pulang", { length: 8 }).notNull(),
  selesaiPulang: varchar("selesai_pulang", { length: 8 }).notNull(),
  kompensasiWaktu: integer("kompensasi_waktu").notNull().default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
