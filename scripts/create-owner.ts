/**
 * Creates the single owner account (or resets its password).
 *
 *   npm run create-owner                      (prompts for email and password)
 *   npm run create-owner -- --email owner@example.com [--name "Varshika Rajput"] [--reset-password]
 *
 * PowerShell strips a bare `--`, so there the flags may not arrive; the script then prompts.
 * OWNER_EMAIL / OWNER_NAME environment variables also work.
 *
 * The password is read from the OWNER_PASSWORD environment variable if set, otherwise it is
 * prompted for on the terminal. It is never accepted as a command-line argument (which would
 * leak into shell history).
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function promptPassword(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput?: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  out._writeToOutput = (s: string) => {
    if (!muted) out.output.write(s);
  };
  const question = rl.question("Owner password (min 8 chars, letters and numbers): ");
  muted = true;
  const answer = await question;
  rl.close();
  stdout.write("\n");
  return answer;
}

async function main() {
  const reset = process.argv.includes("--reset-password") || process.env.npm_config_reset_password === "true";
  // Without `--` (e.g. in PowerShell) npm keeps the flags and forwards only their values.
  const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--"));
  let email = (arg("email") ?? process.env.OWNER_EMAIL ?? positional.find((a) => a.includes("@")))?.trim().toLowerCase();
  if (!email && stdin.isTTY) email = (await ask("Owner email: ")).toLowerCase();
  const name = arg("name") ?? process.env.OWNER_NAME ?? positional.find((a) => !a.includes("@")) ?? "Varshika Rajput";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error("Usage: npm run create-owner -- --email owner@example.com [--name \"Varshika Rajput\"] [--reset-password]");
    process.exit(1);
  }

  const { connectDB, disconnectDB } = await import("../src/server/db");
  const { User } = await import("../src/server/models");
  const { hashPassword, validatePasswordStrength } = await import("../src/server/auth/password");
  await connectDB();

  const existingOwner = await User.findOne({ role: "owner" });
  if (existingOwner && !reset) {
    console.error(`An owner account already exists (${existingOwner.email}). Use --reset-password to change its password.`);
    await disconnectDB();
    process.exit(1);
  }

  const password = process.env.OWNER_PASSWORD ?? (await promptPassword());
  const problem = validatePasswordStrength(password);
  if (problem) {
    console.error(problem);
    await disconnectDB();
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);

  if (existingOwner) {
    existingOwner.passwordHash = passwordHash;
    await existingOwner.save();
    const { Session } = await import("../src/server/models");
    await Session.deleteMany({ userId: existingOwner._id });
    console.log(`Password reset for owner ${existingOwner.email}. All sessions signed out.`);
  } else {
    if (await User.exists({ email, isGuest: false })) {
      console.error("Another account already uses this email.");
      await disconnectDB();
      process.exit(1);
    }
    await User.create({
      name,
      email,
      role: "owner",
      passwordHash,
      staff: { title: "Owner & Stylist", bookable: true },
    });
    console.log(`Owner account created for ${name} <${email}>. Sign in at /login.`);
  }
  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
