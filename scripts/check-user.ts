import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL || '', { 
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUser() {
  const clerkId = 'user_31elaM4lwJmnMc98F1zjoUaXUjv';
  
  try {
    console.log(`Checking for user with clerkId: ${clerkId}`);
    
    // Check specific user
    const userResult = await client`
      SELECT id, clerk_id, email, created_at 
      FROM users 
      WHERE clerk_id = ${clerkId}
      LIMIT 1
    `;

    if (userResult.length > 0) {
      console.log('User found:', userResult[0]);
    } else {
      console.log('User not found');
      
      // Check if any users exist
      const allUsers = await client`
        SELECT id, clerk_id, email, created_at 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      
      console.log('First 5 users in database:');
      console.table(allUsers);
    }
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

checkUser();
