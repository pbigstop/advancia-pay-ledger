import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding Advancia Pay Ledger database...\n");

  // ── Demo Users ──────────────────────────────────────────────────────────
  const users = [
    { email: "admin@advanciapayledger.com", password: "Admin@2025!", firstName: "System", lastName: "Admin", role: "admin", facilityId: "facility_hq" },
    { email: "cfo@advanciapayledger.com", password: "Demo@2025!", firstName: "Grace", lastName: "Okonkwo", role: "cfo", facilityId: "facility_northeast" },
    { email: "amaka@advanciapayledger.com", password: "Demo@2025!", firstName: "Amaka", lastName: "Nwosu", role: "provider", facilityId: "facility_northeast" },
    { email: "patient@advanciapayledger.com", password: "Demo@2025!", firstName: "James", lastName: "Okafor", role: "patient", facilityId: "facility_northeast" },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`  ⏭  User exists: ${u.email}`);
      continue;
    }

    const hashed = await bcrypt.hash(u.password, 12);
    const user = await prisma.user.create({
      data: { email: u.email, password: hashed, firstName: u.firstName, lastName: u.lastName, role: u.role, facilityId: u.facilityId },
    });
    console.log(`  ✅ Created user: ${u.email} (${u.role})`);

    // ── Wallets for CFO account ──────────────────────────────────────────
    if (u.role === "cfo") {
      const wallets = [
        { currency: "USD", balance: 309950, type: "fiat" },
        { currency: "EUR", balance: 210000, type: "fiat" },
        { currency: "GBP", balance: 155000, type: "fiat" },
        { currency: "CAD", balance: 245000, type: "fiat" },
        { currency: "BTC", balance: 5.12, type: "crypto", address: "0xf9171abdf5c140bb9c3cee287bcf129c" },
        { currency: "ETH", balance: 42.6, type: "crypto", address: "0xda3c50a825164c17ac308849704633dc" },
        { currency: "SOL", balance: 1840, type: "crypto", address: "0xec6e0005cebb4acf91b5c3e01fee5e56" },
        { currency: "USDT", balance: 120000, type: "crypto", address: "0x8fc46b44546b4fe5a4f767886e9d96ea" },
      ];

      for (const w of wallets) {
        await prisma.wallet.create({
          data: { userId: user.id, currency: w.currency, balance: w.balance, type: w.type, address: w.address ?? null },
        });
      }
      console.log(`  💰 Created ${wallets.length} wallets for CFO`);

      // ── Seed transactions ──────────────────────────────────────────────
      const transactions = [
        { type: "exchange", status: "completed", fromCurrency: "USD", toCurrency: "BTC", fromAmount: 50000, toAmount: 0.832, fee: 450, description: "Exchange USD → BTC", reference: "EXC-A1B2C3D4" },
        { type: "transfer", status: "completed", fromCurrency: "CAD", toCurrency: "CAD", fromAmount: 245000, toAmount: 243775, fee: 1225, description: "Salary — Northeast Medical Group", reference: "TXN-E5F6G7H8" },
        { type: "withdrawal", status: "processing", fromCurrency: "USD", fromAmount: 25000, fee: 125, description: "Bank withdrawal — GTB account", reference: "WTH-I9J0K1L2" },
        { type: "exchange", status: "completed", fromCurrency: "ETH", toCurrency: "USDT", fromAmount: 1.5, toAmount: 3487.5, fee: 35.5, description: "Exchange ETH → USDT", reference: "EXC-M3N4O5P6" },
        { type: "deposit", status: "completed", fromCurrency: "USD", fromAmount: 100000, fee: 0, description: "Wire deposit — Facilitix Corp", reference: "DEP-Q7R8S9T0" },
        { type: "transfer", status: "completed", fromCurrency: "BTC", toCurrency: "BTC", fromAmount: 0.5, toAmount: 0.4975, fee: 0.0025, description: "Transfer to cold storage", reference: "TXN-U1V2W3X4" },
        { type: "exchange", status: "completed", fromCurrency: "CAD", toCurrency: "USD", fromAmount: 50000, toAmount: 36700, fee: 367, description: "Exchange CAD → USD", reference: "EXC-Y5Z6A7B8" },
        { type: "withdrawal", status: "completed", fromCurrency: "ETH", fromAmount: 5, fee: 0.005, description: "Crypto withdrawal to cold wallet", reference: "WTH-C9D0E1F2" },
        { type: "deposit", status: "completed", fromCurrency: "BTC", fromAmount: 2, fee: 0, description: "BTC received from escrow", reference: "DEP-G3H4I5J6" },
        { type: "transfer", status: "failed", fromCurrency: "EUR", toCurrency: "EUR", fromAmount: 15000, fee: 75, description: "Transfer rejected — limit exceeded", reference: "TXN-K7L8M9N0" },
      ];

      for (const tx of transactions) {
        await prisma.transaction.create({
          data: {
            type: tx.type,
            status: tx.status,
            fromCurrency: tx.fromCurrency,
            toCurrency: tx.toCurrency ?? null,
            fromAmount: tx.fromAmount,
            toAmount: tx.toAmount ?? null,
            fee: tx.fee,
            description: tx.description,
            reference: tx.reference,
            senderId: user.id,
          },
        });
      }
      console.log(`  📋 Created ${transactions.length} transactions`);
    }

    // ── Basic wallet for other users ────────────────────────────────────
    if (u.role === "admin") {
      await prisma.wallet.create({ data: { userId: user.id, currency: "USD", balance: 500000, type: "fiat" } });
      await prisma.wallet.create({ data: { userId: user.id, currency: "BTC", balance: 10.5, type: "crypto", address: "0xadmin0001" } });
      console.log("  💰 Created 2 wallets for Admin");
    }
    if (u.role === "provider") {
      await prisma.wallet.create({ data: { userId: user.id, currency: "USD", balance: 85000, type: "fiat" } });
      await prisma.wallet.create({ data: { userId: user.id, currency: "NGN", balance: 45000000, type: "fiat" } });
      console.log("  💰 Created 2 wallets for Provider");
    }
    if (u.role === "patient") {
      await prisma.wallet.create({ data: { userId: user.id, currency: "USD", balance: 2500, type: "fiat" } });
      console.log("  💰 Created 1 wallet for Patient");
    }
  }

  console.log("\n✅ Seed complete!\n");
  console.log("Demo accounts:");
  console.log("  admin@advanciapayledger.com   / Admin@2025!");
  console.log("  cfo@advanciapayledger.com     / Demo@2025!");
  console.log("  amaka@advanciapayledger.com   / Demo@2025!");
  console.log("  patient@advanciapayledger.com / Demo@2025!");
}

seed()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
