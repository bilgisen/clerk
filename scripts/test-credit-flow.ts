import { db } from '@/lib/db/server';
import { users } from '@/db/schema';
import { creditService } from '@/lib/services/credits/credit-service';
import { eq } from 'drizzle-orm';

async function testCreditFlow() {
  try {
    console.log('Starting credit flow test...');
    
    // 1. Create a test user
    console.log('Creating test user...');
    const [testUser] = await db.insert(users).values({
      clerkId: 'test_user_' + Date.now(),
      email: `test_${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      role: 'MEMBER',
      isActive: true,
      permissions: ['read:books'],
      subscriptionStatus: 'TRIAL',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning({ id: users.id, email: users.email });

    console.log('Created test user:', testUser);

    // 2. Award signup bonus
    console.log('\nAwarding signup bonus...');
    const bonusResult = await creditService.awardSignupBonus(testUser.id);
    console.log('Signup bonus result:', bonusResult);

    // 3. Check balance
    console.log('\nChecking balance...');
    const balance = await creditService.getBalance(testUser.id);
    console.log('Current balance:', balance);

    // 4. Get recent activities
    console.log('\nFetching recent activities...');
    const activities = await creditService.getRecentActivities(testUser.id, 5);
    console.log('Recent activities:', activities);

    // 5. Verify in database
    console.log('\nVerifying database entries...');
    const ledgerEntries = await db.query.creditLedger.findMany({
      where: (ledger, { eq }) => eq(ledger.userId, testUser.id),
      orderBy: (ledger, { desc }) => [desc(ledger.createdAt)]
    });
    console.log('Credit ledger entries:', ledgerEntries);

    const activityEntries = await db.query.activity.findMany({
      where: (activity, { eq }) => eq(activity.userId, testUser.id),
      orderBy: (activity, { desc }) => [desc(activity.createdAt)]
    });
    console.log('Activity entries:', activityEntries);

  } catch (error) {
    console.error('Error in test flow:', error);
  } finally {
    process.exit(0);
  }
}

testCreditFlow();
