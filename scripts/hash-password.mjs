#!/usr/bin/env node
/**
 * Argon2id hash generator, for creating the FIRST administrator account —
 * the one that cannot be created through the admin API, because there is no
 * administrator yet to authorise it.
 *
 *   node scripts/hash-password.mjs
 *
 * Reads the password from a prompt with echo OFF, so it never appears on
 * screen, and never as an argument, because arguments land in your shell
 * history and in the process list where any other user on the machine can
 * read them. Prints the PHC string and the exact SQL to paste into Supabase.
 *
 * The parameters match api/_auth.ts exactly (OWASP: 19 MiB, t=2, p=1). A hash
 * made here is verified by the running site without any further step.
 */
import { createInterface } from 'node:readline';
import { stdin, stdout, argv, exit } from 'node:process';
import { hash, Algorithm } from '@node-rs/argon2';

const ARGON = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const MIN_LENGTH = 12;

/**
 * Ask for a secret twice without showing it.
 *
 * A TTY gets a readline prompt whose echo is suppressed: every keystroke
 * redraws the bare prompt, so the password never appears on screen and never
 * reaches the scrollback. A pipe (CI, a smoke test) has nothing to hide and
 * no interactivity, so stdin is drained once and read as lines — asking a
 * closed stream a second question is what would otherwise hang.
 */
async function readSecrets(questions) {
  if (!stdin.isTTY) {
    const chunks = [];
    for await (const chunk of stdin) chunks.push(chunk);
    const lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
    return questions.map((_, i) => lines[i] ?? '');
  }

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const answers = [];
  for (const question of questions) {
    answers.push(
      await new Promise((resolve) => {
        const hide = () => stdout.write(`\u001b[2K\u001b[200D${question}`);
        stdin.on('data', hide);
        rl.question(question, (answer) => {
          stdin.off('data', hide);
          stdout.write('\n');
          resolve(answer);
        });
      })
    );
  }
  rl.close();
  return answers;
}

const email = (argv[2] ?? '').trim().toLowerCase();
const name = (argv[3] ?? '').trim();
// Third argument picks the role. Defaults to the safer of the two: a new
// account gets gate access, not the power to create more accounts.
const role = (argv[4] ?? 'volunteer').trim().toLowerCase();
if (!['volunteer', 'admin'].includes(role)) {
  console.error(`Role must be "volunteer" or "admin", not "${role}".`);
  exit(1);
}

const [password, again] = await readSecrets([
  'Password (not shown as you type): ',
  'Repeat password: ',
]);
if (password.length < MIN_LENGTH) {
  console.error(`\nPassword must be at least ${MIN_LENGTH} characters.`);
  exit(1);
}
if (password !== again) {
  console.error('\nThe two passwords did not match.');
  exit(1);
}

const phc = await hash(password, ARGON);

console.log('\nArgon2id hash (safe to paste; it is not reversible):\n');
console.log(phc);

if (email && name) {
  // Quoting: the hash is base64 and contains no quote characters, and the
  // name/email are yours, but doubling any single quote keeps it correct for
  // names like O'Brien.
  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  console.log('\nSQL for the Supabase editor:\n');
  console.log(
    `insert into public.volunteers (full_name, email, password_hash, role, active)\n` +
      `values (${q(name)}, ${q(email)}, ${q(phc)}, ${q(role)}, true)\n` +
      `on conflict ((lower(email))) do update\n` +
      `  set password_hash = excluded.password_hash,\n` +
      `      role = ${q(role)},\n` +
      `      active = true,\n` +
      `      failed_attempts = 0,\n` +
      `      locked_until = null,\n` +
      `      updated_at = now();`
  );
  console.log(`\nRole: ${role}. Re-running for the same email RESETS that`);
  console.log('account\'s password and unlocks it, rather than failing.');
} else {
  console.log(
    '\nTip: pass an email and name to get the full SQL, e.g.\n' +
      '  node scripts/hash-password.mjs admin@example.edu.in "Full Name"'
  );
}
