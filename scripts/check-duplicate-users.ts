import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL || '', { 
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkDuplicateUsers() {
  try {
    console.log('Checking for duplicate users by email...');
    
    // Find duplicate emails
    const duplicateEmails = await client`
      SELECT email, COUNT(*) as count, ARRAY_AGG(id) as user_ids
      FROM users 
      WHERE email IS NOT NULL
      GROUP BY email 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    console.log('\nDuplicate email addresses:');
    console.table(duplicateEmails);

    // Find users with duplicate clerk_ids
    const duplicateClerkIds = await client`
      SELECT clerk_id, COUNT(*) as count, ARRAY_AGG(id) as user_ids
      FROM users 
      WHERE clerk_id IS NOT NULL
      GROUP BY clerk_id 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    console.log('\nDuplicate clerk_ids:');
    console.table(duplicateClerkIds);

    // Find users with null clerk_ids
    const nullClerkIds = await client`
      SELECT id, email, created_at 
      FROM users 
      WHERE clerk_id IS NULL
      ORDER BY created_at DESC
    `;

    console.log('\nUsers with NULL clerk_id:');
    console.table(nullClerkIds);

  } catch (error) {
    console.error('Error checking for duplicate users:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

checkDuplicateUsers();
