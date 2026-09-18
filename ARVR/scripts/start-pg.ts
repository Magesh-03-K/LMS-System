import embeddedPostgres from 'embedded-postgres';
import path from 'path';

async function startLocalPostgres() {
  const dbPath = path.join(process.cwd(), '.postgres-data');
  const pg = new embeddedPostgres({
    databaseDir: dbPath,
    port: 54322,
    user: 'postgres',
    password: 'password',
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (e) {
    // Already initialized
  }

  try {
    await pg.start();
    console.log('🐘 Local PostgreSQL started on port 54322.');
  } catch (e: any) {
    if (e.message?.includes('already running') || e.message?.includes('lock file')) {
      console.log('🐘 Local PostgreSQL is already running on port 54322.');
    } else {
      console.error('PostgreSQL start error:', e.message);
    }
  }

  try {
    await pg.createDatabase('arvr');
    console.log("Database 'arvr' ready.");
  } catch {
    // Database already exists
  }
}

startLocalPostgres().catch(console.error);
