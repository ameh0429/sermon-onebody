import bcrypt from 'bcryptjs';
import { sequelize } from '../config/database.js';
import { User } from '../models/index.js';

/** Creates (or promotes) the first admin using ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD from the environment. */
async function main() {
  const name = process.env.ADMIN_NAME ?? 'Admin';
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in the environment.');
  }

  await sequelize.sync();
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    await existing.update({ role: 'admin' });
    console.log(`Promoted existing user ${email} to admin.`);
  } else {
    await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
    console.log(`Created admin ${email}.`);
  }
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
