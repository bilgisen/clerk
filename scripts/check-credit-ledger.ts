import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL || '', { 
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkCreditLedger() {
  try {
    console.log('Checking credit_ledger table...');
    
    // Get total count of entries
    const countResult = await client`SELECT COUNT(*) as total FROM credit_ledger`;
    console.log(`Total credit ledger entries: ${countResult[0].total}`);
    
    // Get recent entries
    const recentEntries = await client`
      SELECT cl.id, cl.user_id, u.email, cl.amount, cl.reason, cl.source, cl.created_at 
      FROM credit_ledger cl
      LEFT JOIN users u ON cl.user_id = u.id
      ORDER BY cl.created_at DESC 
      LIMIT 10
    `;
    
    console.log('\nRecent credit ledger entries:');
    console.table(recentEntries);
    
    // Check if there are any signup bonuses
    const signupBonuses = await client`
      SELECT cl.id, cl.user_id, u.email, cl.amount, cl.created_at 
      FROM credit_ledger cl
      LEFT JOIN users u ON cl.user_id = u.id
      WHERE cl.reason = 'signup_bonus'
      ORDER BY cl.created_at DESC
    `;
    
    console.log('\nSignup bonuses:');
    console.table(signupBonuses);
    
  } catch (error) {
    console.error('Error checking credit ledger:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

checkCreditLedger();
